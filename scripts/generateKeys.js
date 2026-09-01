import crypto from "crypto";
import fs from "fs";
import path from "path";

const keysDirectory = path.resolve("keys");
const publicKeyPath = path.join(keysDirectory, "public.pem");
const privateKeyPath = path.join(keysDirectory, "private.pem");

if (fs.existsSync(publicKeyPath) || fs.existsSync(privateKeyPath)) {
  throw new Error(
    "Ya existe al menos una clave en keys/. Eliminala manualmente si deseas rotar el par."
  );
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

fs.mkdirSync(keysDirectory, { recursive: true });
fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });
fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });

console.log(`Clave publica creada en ${publicKeyPath}`);
console.log(`Clave privada creada en ${privateKeyPath}`);
