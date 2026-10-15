import { argon2idAsync } from "@noble/hashes/argon2";
import { toArrayBuffer, utf8ToBytes, wipe } from "@/lib/crypto/bytes";
import type { Argon2Params, KdfName, KdfParams, Pbkdf2Params } from "@/lib/domain/types";

/** OWASP interactive Argon2id guidance: 19 MiB, 2 iterations, parallelism 1. */
export const PRODUCTION_ARGON2: Argon2Params = { m: 19456, t: 2, p: 1, dkLen: 32 };

/** OWASP PBKDF2-SHA-256 guidance for the fallback path. */
export const PRODUCTION_PBKDF2: Pbkdf2Params = { iterations: 600_000, hash: "SHA-256", dkLen: 32 };

export const KDF_BENCHMARK_LIMIT_MS = 3000;

export interface KdfChoice {
  kdf: KdfName;
  params: KdfParams;
}

export function isArgon2Params(params: KdfParams): params is Argon2Params {
  return "m" in params && "t" in params && "p" in params;
}

export function isPbkdf2Params(params: KdfParams): params is Pbkdf2Params {
  return "iterations" in params;
}

export async function deriveArgon2id(passphrase: string, salt: Uint8Array, params: Argon2Params): Promise<Uint8Array> {
  if (params.dkLen !== 32 || params.m < 8 || params.t < 1 || params.p < 1) {
    throw new Error("Invalid Argon2id parameters.");
  }
  const derived = await argon2idAsync(utf8ToBytes(passphrase), salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: params.dkLen,
  });
  return derived;
}

export async function derivePbkdf2(passphrase: string, salt: Uint8Array, params: Pbkdf2Params): Promise<Uint8Array> {
  if (params.iterations < 1 || params.hash !== "SHA-256" || params.dkLen !== 32) {
    throw new Error("Invalid PBKDF2 parameters.");
  }
  const baseKey = await crypto.subtle.importKey("raw", toArrayBuffer(utf8ToBytes(passphrase)), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: params.iterations, hash: "SHA-256" },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

export async function deriveKeyMaterial(
  passphrase: string,
  salt: Uint8Array,
  choice: KdfChoice,
): Promise<Uint8Array> {
  if (choice.kdf === "argon2id") {
    if (!isArgon2Params(choice.params)) throw new Error("Argon2id parameters are missing.");
    return deriveArgon2id(passphrase, salt, choice.params);
  }
  if (!isPbkdf2Params(choice.params)) throw new Error("PBKDF2 parameters are missing.");
  return derivePbkdf2(passphrase, salt, choice.params);
}

export async function benchmarkKdf(options?: {
  argon?: (passphrase: string, salt: Uint8Array, params: Argon2Params) => Promise<Uint8Array>;
  now?: () => number;
  maxMs?: number;
  salt?: Uint8Array;
}): Promise<KdfChoice> {
  const argon = options?.argon ?? deriveArgon2id;
  const now = options?.now ?? (() => performance.now());
  const maxMs = options?.maxMs ?? KDF_BENCHMARK_LIMIT_MS;
  const salt = options?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const started = now();
  try {
    const derived = await argon("accessvault-kdf-benchmark", salt, PRODUCTION_ARGON2);
    wipe(derived);
    const elapsed = now() - started;
    if (elapsed > maxMs) {
      return { kdf: "pbkdf2-sha256", params: PRODUCTION_PBKDF2 };
    }
    return { kdf: "argon2id", params: PRODUCTION_ARGON2 };
  } catch {
    return { kdf: "pbkdf2-sha256", params: PRODUCTION_PBKDF2 };
  }
}
