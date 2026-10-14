// Password hashing and verification utilities using native scrypt.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SALT_BYTE_LENGTH = 16;
const KEY_BYTE_LENGTH = 64;

/**
 * Hashes a plain-text password using Node.js crypto.scrypt with a cryptographically secure random salt.
 * Output format: `<salt_hex>:<derived_key_hex>`
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (typeof plainText !== "string" || plainText.length === 0) {
    throw new Error("Password must be a non-empty string");
  }

  const saltBuffer = randomBytes(SALT_BYTE_LENGTH);
  const salt = saltBuffer.toString("hex");

  const derivedKey = (await scryptAsync(
    plainText,
    saltBuffer,
    KEY_BYTE_LENGTH,
  )) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plain-text password against a stored `<salt_hex>:<derived_key_hex>` hash
 * using constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  if (
    typeof plainText !== "string" ||
    typeof hash !== "string" ||
    plainText.length === 0 ||
    hash.length === 0
  ) {
    return false;
  }

  const separatorIndex = hash.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === hash.length - 1) {
    return false;
  }

  const saltHex = hash.slice(0, separatorIndex);
  const keyHex = hash.slice(separatorIndex + 1);

  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(saltHex) || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    return false;
  }

  try {
    const saltBuffer = Buffer.from(saltHex, "hex");
    const storedKeyBuffer = Buffer.from(keyHex, "hex");

    if (storedKeyBuffer.length === 0 || saltBuffer.length === 0) {
      return false;
    }

    const calculatedKey = (await scryptAsync(
      plainText,
      saltBuffer,
      storedKeyBuffer.length,
    )) as Buffer;

    if (storedKeyBuffer.length !== calculatedKey.length) {
      return false;
    }

    return timingSafeEqual(storedKeyBuffer, calculatedKey);
  } catch {
    return false;
  }
}
