import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const hexKeyPattern = /^[0-9a-fA-F]{64}$/;
const base64Pattern = /^[A-Za-z0-9+/=]+$/;

const resolveKey = (): Buffer => {
  const rawKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is required for token encryption");
  }

  if (hexKeyPattern.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  if (base64Pattern.test(rawKey)) {
    const decoded = Buffer.from(rawKey, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  }

  if (rawKey.length === 32) {
    return Buffer.from(rawKey, "utf8");
  }

  throw new Error(
    "OAUTH_TOKEN_ENCRYPTION_KEY must be 32 bytes (utf8), 64-char hex, or base64-encoded 32 bytes"
  );
};

export const encryptToken = (value: string): string => {
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(
    ":"
  );
};

export const decryptToken = (payload: string): string => {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = payload.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted token payload");
  }

  const key = resolveKey();
  const iv = Buffer.from(ivEncoded, "base64");
  const tag = Buffer.from(tagEncoded, "base64");
  const encrypted = Buffer.from(encryptedEncoded, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};
