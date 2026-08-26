import crypto from "crypto";
import fs from "fs";
import path from "path";

const FORMAT_VERSION = 1;
const ALGORITHM = "AES-256-GCM+RSA-OAEP-SHA256";
const PUBLIC_KEY_PATH = path.resolve(
  process.env.BLOCKCHAIN_PUBLIC_KEY_PATH ?? "keys/public.pem"
);
const PRIVATE_KEY_PATH = path.resolve(
  process.env.BLOCKCHAIN_PRIVATE_KEY_PATH ?? "keys/private.pem"
);

function readKey(keyPath, keyType) {
  try {
    return fs.readFileSync(keyPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `No se encontro la clave ${keyType} en ${keyPath}. Ejecuta npm run keys:generate.`
      );
    }
    throw error;
  }
}

export function isEncryptedPayload(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.version === FORMAT_VERSION &&
    value.algorithm === ALGORITHM
  );
}

export function encryptJson(value) {
  const publicKey = readKey(PUBLIC_KEY_PATH, "publica");
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    aesKey
  );

  return {
    version: FORMAT_VERSION,
    algorithm: ALGORITHM,
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptJson(payload) {
  if (!isEncryptedPayload(payload)) {
    throw new Error("El archivo no tiene un formato cifrado compatible.");
  }

  const privateKey = readKey(PRIVATE_KEY_PATH, "privada");
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    Buffer.from(payload.encryptedKey, "base64")
  );
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesKey,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}
