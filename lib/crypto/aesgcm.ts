import { b64ToBytes, bytesToB64, bytesToUtf8, toArrayBuffer, utf8ToBytes, wipe } from "@/lib/crypto/bytes";

export const AES_NONCE_BYTES = 12;

export interface CipherBundle {
  ciphertext: string;
  nonce: string;
}

export interface RawCipher {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export async function importAesKey(raw: Uint8Array, extractable = false): Promise<CryptoKey> {
  if (raw.byteLength !== 32) {
    throw new Error("AES-256 keys must be 32 bytes.");
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), { name: "AES-GCM" }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

export async function generateDek(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const key = await importAesKey(raw, false);
  return { key, raw };
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: string,
): Promise<RawCipher> {
  const nonce = new Uint8Array(AES_NONCE_BYTES);
  crypto.getRandomValues(nonce);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(utf8ToBytes(aad)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(plaintext),
  );
  return { ciphertext: new Uint8Array(encrypted), nonce };
}

export async function decryptBytes(
  key: CryptoKey,
  payload: RawCipher,
  aad: string,
): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(payload.nonce),
      additionalData: toArrayBuffer(utf8ToBytes(aad)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(payload.ciphertext),
  );
  return new Uint8Array(plain);
}

export async function encryptString(key: CryptoKey, plaintext: string, aad: string): Promise<CipherBundle> {
  const raw = await encryptBytes(key, utf8ToBytes(plaintext), aad);
  const bundle = {
    ciphertext: bytesToB64(raw.ciphertext),
    nonce: bytesToB64(raw.nonce),
  };
  wipe(raw.ciphertext);
  return bundle;
}

export async function decryptString(key: CryptoKey, payload: CipherBundle, aad: string): Promise<string> {
  const plain = await decryptBytes(
    key,
    { ciphertext: b64ToBytes(payload.ciphertext), nonce: b64ToBytes(payload.nonce) },
    aad,
  );
  const text = bytesToUtf8(plain);
  wipe(plain);
  return text;
}
