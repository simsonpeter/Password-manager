import { bytesToHex, hexToBytes, randomBytes } from "@/lib/crypto/bytes";

const RECOVERY_BYTES = 32;

export function generateRecoveryKeyBytes(): Uint8Array {
  return randomBytes(RECOVERY_BYTES);
}

/** 32 random bytes shown as eight hyphenated hexadecimal groups. */
export function encodeRecoveryKey(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_BYTES) {
    throw new Error("Recovery key material must be 32 bytes.");
  }
  const hex = bytesToHex(bytes);
  const groups: string[] = [];
  for (let index = 0; index < hex.length; index += 8) {
    groups.push(hex.slice(index, index + 8));
  }
  return groups.join("-");
}

export function decodeRecoveryKey(input: string): Uint8Array {
  const hex = input.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== RECOVERY_BYTES * 2) {
    throw new Error("Enter the full recovery key.");
  }
  return hexToBytes(hex);
}
