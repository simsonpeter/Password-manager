import { encryptBytes, decryptBytes, encryptString, decryptString, importAesKey, generateDek } from "@/lib/crypto/aesgcm";
import { b64ToBytes, bytesToB64, randomBytes, wipe } from "@/lib/crypto/bytes";
import { benchmarkKdf, deriveKeyMaterial, type KdfChoice } from "@/lib/crypto/kdf";
import { decodeRecoveryKey, encodeRecoveryKey, generateRecoveryKeyBytes } from "@/lib/crypto/recovery-key";
import type { VaultRecord } from "@/lib/domain/types";
import { VaultPassphraseError } from "@/lib/errors";

export const VERIFIER_TEXT = "accessvault-verifier-v1";
export const AAD_DEK_PASSPHRASE = "av-dek-passphrase-v1";
export const AAD_DEK_RECOVERY = "av-dek-recovery-v1";
export const AAD_VERIFIER = "av-verifier-v1";
export const AAD_SECRET = "av-secret-v1";
export const AAD_NOTES = "av-notes-v1";
export const AAD_INSTRUCTIONS = "av-instructions-v1";

export interface VaultMaterial {
  fields: Pick<
    VaultRecord,
    | "kdf"
    | "kdfSalt"
    | "kdfParams"
    | "wrappedDek"
    | "wrappedDekNonce"
    | "recoveryWrappedDek"
    | "recoveryWrappedDekNonce"
    | "verifierCiphertext"
    | "verifierNonce"
  >;
  dek: CryptoKey;
  recoveryKey: string;
}

async function unwrapDek(key: CryptoKey, ciphertext: string, nonce: string, aad: string): Promise<Uint8Array> {
  return decryptBytes(
    key,
    { ciphertext: b64ToBytes(ciphertext), nonce: b64ToBytes(nonce) },
    aad,
  );
}

async function assertVerifier(dek: CryptoKey, vault: Pick<VaultRecord, "verifierCiphertext" | "verifierNonce">): Promise<void> {
  const text = await decryptString(
    dek,
    { ciphertext: vault.verifierCiphertext, nonce: vault.verifierNonce },
    AAD_VERIFIER,
  );
  if (text !== VERIFIER_TEXT) {
    throw new VaultPassphraseError();
  }
}

export async function createVaultMaterial(passphrase: string, choice?: KdfChoice): Promise<VaultMaterial> {
  const selected = choice ?? (await benchmarkKdf());
  const salt = randomBytes(16);
  const kekRaw = await deriveKeyMaterial(passphrase, salt, selected);
  const kek = await importAesKey(kekRaw, false);
  wipe(kekRaw);

  const generated = await generateDek();
  const wrapped = await encryptBytes(kek, generated.raw, AAD_DEK_PASSPHRASE);
  const recoveryRaw = generateRecoveryKeyBytes();
  const recoveryAes = await importAesKey(recoveryRaw, false);
  const recoveryWrapped = await encryptBytes(recoveryAes, generated.raw, AAD_DEK_RECOVERY);
  const verifier = await encryptString(generated.key, VERIFIER_TEXT, AAD_VERIFIER);
  const recoveryKey = encodeRecoveryKey(recoveryRaw);

  wipe(generated.raw);
  wipe(recoveryRaw);

  return {
    dek: generated.key,
    recoveryKey,
    fields: {
      kdf: selected.kdf,
      kdfSalt: bytesToB64(salt),
      kdfParams: selected.params,
      wrappedDek: bytesToB64(wrapped.ciphertext),
      wrappedDekNonce: bytesToB64(wrapped.nonce),
      recoveryWrappedDek: bytesToB64(recoveryWrapped.ciphertext),
      recoveryWrappedDekNonce: bytesToB64(recoveryWrapped.nonce),
      verifierCiphertext: verifier.ciphertext,
      verifierNonce: verifier.nonce,
    },
  };
}

export async function unlockWithPassphrase(vault: VaultRecord, passphrase: string): Promise<CryptoKey> {
  try {
    const kekRaw = await deriveKeyMaterial(passphrase, b64ToBytes(vault.kdfSalt), {
      kdf: vault.kdf,
      params: vault.kdfParams,
    });
    const kek = await importAesKey(kekRaw, false);
    wipe(kekRaw);
    const dekRaw = await unwrapDek(kek, vault.wrappedDek, vault.wrappedDekNonce, AAD_DEK_PASSPHRASE);
    const dek = await importAesKey(dekRaw, false);
    wipe(dekRaw);
    await assertVerifier(dek, vault);
    return dek;
  } catch (error) {
    if (error instanceof VaultPassphraseError) throw error;
    throw new VaultPassphraseError();
  }
}

export async function unlockWithRecoveryKey(vault: VaultRecord, recoveryKey: string): Promise<CryptoKey> {
  const recoveryRaw = decodeRecoveryKey(recoveryKey);
  try {
    const recoveryAes = await importAesKey(recoveryRaw, false);
    wipe(recoveryRaw);
    const dekRaw = await unwrapDek(
      recoveryAes,
      vault.recoveryWrappedDek,
      vault.recoveryWrappedDekNonce,
      AAD_DEK_RECOVERY,
    );
    const dek = await importAesKey(dekRaw, false);
    wipe(dekRaw);
    await assertVerifier(dek, vault);
    return dek;
  } catch (error) {
    wipe(recoveryRaw);
    if (error instanceof VaultPassphraseError) throw error;
    throw new VaultPassphraseError("That recovery key is not correct.");
  }
}

async function unwrapWithPassphrase(vault: VaultRecord, passphrase: string): Promise<Uint8Array> {
  const kekRaw = await deriveKeyMaterial(passphrase, b64ToBytes(vault.kdfSalt), {
    kdf: vault.kdf,
    params: vault.kdfParams,
  });
  const kek = await importAesKey(kekRaw, false);
  wipe(kekRaw);
  return unwrapDek(kek, vault.wrappedDek, vault.wrappedDekNonce, AAD_DEK_PASSPHRASE);
}

export async function rewrapWithPassphrase(
  vault: VaultRecord,
  currentPassphrase: string,
  nextPassphrase: string,
  choice?: KdfChoice,
): Promise<Pick<VaultRecord, "kdf" | "kdfSalt" | "kdfParams" | "wrappedDek" | "wrappedDekNonce">> {
  let dekRaw: Uint8Array | null = null;
  try {
    dekRaw = await unwrapWithPassphrase(vault, currentPassphrase);
    const selected = choice ?? { kdf: vault.kdf, params: vault.kdfParams };
    const salt = randomBytes(16);
    const kekRaw = await deriveKeyMaterial(nextPassphrase, salt, selected);
    const kek = await importAesKey(kekRaw, false);
    wipe(kekRaw);
    const wrapped = await encryptBytes(kek, dekRaw, AAD_DEK_PASSPHRASE);
    return {
      kdf: selected.kdf,
      kdfSalt: bytesToB64(salt),
      kdfParams: selected.params,
      wrappedDek: bytesToB64(wrapped.ciphertext),
      wrappedDekNonce: bytesToB64(wrapped.nonce),
    };
  } catch {
    throw new VaultPassphraseError("The current vault passphrase is not correct.");
  } finally {
    wipe(dekRaw);
  }
}

export async function rotateRecoveryWrap(
  vault: VaultRecord,
  passphrase: string,
): Promise<{ recoveryKey: string; recoveryWrappedDek: string; recoveryWrappedDekNonce: string }> {
  let dekRaw: Uint8Array | null = null;
  let recoveryRaw: Uint8Array | null = null;
  try {
    dekRaw = await unwrapWithPassphrase(vault, passphrase);
    recoveryRaw = generateRecoveryKeyBytes();
    const recoveryAes = await importAesKey(recoveryRaw, false);
    const wrapped = await encryptBytes(recoveryAes, dekRaw, AAD_DEK_RECOVERY);
    return {
      recoveryKey: encodeRecoveryKey(recoveryRaw),
      recoveryWrappedDek: bytesToB64(wrapped.ciphertext),
      recoveryWrappedDekNonce: bytesToB64(wrapped.nonce),
    };
  } catch {
    throw new VaultPassphraseError("The current vault passphrase is not correct.");
  } finally {
    wipe(dekRaw);
    wipe(recoveryRaw);
  }
}
