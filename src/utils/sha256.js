import crypto from "crypto";

export function generateHash(data) {
  return crypto
    .createHash("sha256")
    .update(data, "utf8")
    .digest("hex");
}
