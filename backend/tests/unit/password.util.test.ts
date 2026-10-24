// Unit tests for password hashing and verification utility.
import { describe, expect, it } from "@jest/globals";
import {
  hashPassword,
  verifyPassword,
} from "../../src/common/utils/password.util.js";

describe("Password Utility", () => {
  it("hashes a plain-text password into salt:key format", async () => {
    const plain = "SuperSecretPassword123!";
    const hash = await hashPassword(plain);

    expect(hash).toContain(":");
    const [salt, derivedKey] = hash.split(":");
    expect(salt).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(derivedKey).toHaveLength(128); // 64 bytes in hex = 128 chars
  });

  it("generates distinct hashes for identical passwords due to random salting", async () => {
    const password = "SamePasswordEveryTime";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it("successfully verifies correct password against hash", async () => {
    const plain = "CorrectHorseBatteryStaple";
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const plain = "CorrectPassword";
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword("WrongPassword", hash);
    expect(isValid).toBe(false);
  });

  it("rejects malformed hashes safely without throwing", async () => {
    expect(await verifyPassword("password", "")).toBe(false);
    expect(await verifyPassword("password", "no-colon-hash")).toBe(false);
    expect(await verifyPassword("password", ":")).toBe(false);
    expect(await verifyPassword("password", "salt:")).toBe(false);
    expect(await verifyPassword("password", ":derivedKey")).toBe(false);
    expect(
      await verifyPassword("password", "invalid_salt_hex:invalid_key_hex"),
    ).toBe(false);
    expect(await verifyPassword("", "abc:def")).toBe(false);
  });

  it("throws when attempting to hash an empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow(
      "Password must be a non-empty string",
    );
  });
});
