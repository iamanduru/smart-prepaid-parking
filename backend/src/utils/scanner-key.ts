import crypto from "crypto";

export function generateScannerApiKey() {

  const secret = crypto
    .randomBytes(32)
    .toString("base64url");

  return `spk_${secret}`;
}

export function hashScannerApiKey(
  apiKey: string
) {
  return crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");
}