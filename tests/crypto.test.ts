import { describe, expect, it } from "vitest";
import { encryptString } from "@/lib/crypto/aesgcm";
import { PRODUCTION_ARGON2, PRODUCTION_PBKDF2, benchmarkKdf } from "@/lib/crypto/kdf";
import { decodeRecoveryKey, encodeRecoveryKey } from "@/lib/crypto/recovery-key";
import { AAD_SECRET, createVaultMaterial, unlockWithPassphrase, unlockWithRecoveryKey } from "@/lib/crypto/vault-crypto";
import { VaultPassphraseError } from "@/lib/errors";
import { TEST_KDF, TEST_PBKDF2 } from "./helpers";

describe("vault encryption", () => {
  it("round-trips a code and uses a unique nonce every time", async () => {
    const material = await createVaultMaterial("a long passphrase", TEST_KDF);
    const nonces = new Set<string>();
    for (let index = 0; index < 30; index += 1) {
      const encrypted = await encryptString(material.dek, "001234", AAD_SECRET);
      nonces.add(encrypted.nonce);
      expect(encrypted.ciphertext).not.toContain("001234");
    }
    expect(nonces.size).toBe(30);
  });

  it("preserves leading zeros", async () => {
    const material = await createVaultMaterial("a long passphrase", TEST_KDF);
    const encrypted = await encryptString(material.dek, "001234", AAD_SECRET);
    const { decryptString } = await import("@/lib/crypto/aesgcm");
    await expect(decryptString(material.dek, encrypted, AAD_SECRET)).resolves.toBe("001234");
  });

  it("rejects the wrong passphrase and accepts the recovery key", async () => {
    const material = await createVaultMaterial("a long passphrase", TEST_PBKDF2);
    const vault = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      ...material.fields,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await expect(unlockWithPassphrase(vault, "wrong passphrase")).rejects.toBeInstanceOf(VaultPassphraseError);
    const unlocked = await unlockWithRecoveryKey(vault, material.recoveryKey);
    expect(unlocked.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", unlocked)).rejects.toThrow();
  });

  it("encodes a 32-byte recovery key", () => {
    const bytes = new Uint8Array(32);
    bytes[0] = 1;
    bytes[31] = 255;
    const encoded = encodeRecoveryKey(bytes);
    expect(encoded.split("-")).toHaveLength(8);
    expect(Array.from(decodeRecoveryKey(encoded))).toEqual(Array.from(bytes));
    expect(() => decodeRecoveryKey("short")).toThrow();
  });

  it("keeps production KDF parameters at or above published guidance", () => {
    expect(PRODUCTION_ARGON2.m).toBeGreaterThanOrEqual(19456);
    expect(PRODUCTION_ARGON2.t).toBeGreaterThanOrEqual(2);
    expect(PRODUCTION_ARGON2.p).toBeGreaterThanOrEqual(1);
    expect(PRODUCTION_PBKDF2.iterations).toBeGreaterThanOrEqual(600_000);
  });

  it("falls back when Argon2id is too slow or unavailable", async () => {
    const slow = await benchmarkKdf({
      now: (() => {
        let tick = 0;
        return () => {
          tick += 4000;
          return tick;
        };
      })(),
      argon: async () => new Uint8Array(32),
    });
    expect(slow.kdf).toBe("pbkdf2-sha256");
    const failed = await benchmarkKdf({
      argon: async () => {
        throw new Error("unavailable");
      },
    });
    expect(failed.kdf).toBe("pbkdf2-sha256");
  });

  it("derives a production Argon2id key", async () => {
    const { deriveArgon2id } = await import("@/lib/crypto/kdf");
    const derived = await deriveArgon2id("benchmark-passphrase", crypto.getRandomValues(new Uint8Array(16)), PRODUCTION_ARGON2);
    expect(derived).toHaveLength(32);
  });
});
