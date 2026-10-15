import { createVaultMaterial } from "@/lib/crypto/vault-crypto";
import type { KdfChoice } from "@/lib/crypto/kdf";
import type { AccessRecord, ClientRecord, Dataset, LocationRecord, VaultRecord } from "@/lib/domain/types";
import { newId, nowIso } from "@/lib/utils";

export const TEST_KDF: KdfChoice = {
  kdf: "argon2id",
  params: { m: 32, t: 1, p: 1, dkLen: 32 },
};

export const TEST_PBKDF2: KdfChoice = {
  kdf: "pbkdf2-sha256",
  params: { iterations: 1000, hash: "SHA-256", dkLen: 32 },
};

export async function makeVault(userId = newId(), passphrase = "correct horse battery"): Promise<{ vault: VaultRecord; key: CryptoKey; recoveryKey: string }> {
  const material = await createVaultMaterial(passphrase, TEST_KDF);
  const timestamp = nowIso();
  return {
    key: material.dek,
    recoveryKey: material.recoveryKey,
    vault: {
      id: newId(),
      userId,
      ...material.fields,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function makeClient(userId: string, name: string, overrides: Partial<ClientRecord> = {}): ClientRecord {
  const timestamp = nowIso();
  return {
    id: newId(),
    userId,
    name,
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    notesCiphertext: null,
    notesNonce: null,
    tags: [],
    status: "active",
    version: 1,
    lastAccessedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: newId(),
    ...overrides,
  };
}

export function emptyDataset(): Dataset {
  return { clients: [], locations: [], accessRecords: [], categories: [] };
}

export function makeLocation(userId: string, clientId: string, name: string): LocationRecord {
  const timestamp = nowIso();
  return {
    id: newId(),
    userId,
    clientId,
    name,
    address: "",
    notesCiphertext: null,
    notesNonce: null,
    status: "active",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: newId(),
  };
}

export function makeCode(userId: string, clientId: string, title: string, overrides: Partial<AccessRecord> = {}): AccessRecord {
  const timestamp = nowIso();
  return {
    id: newId(),
    userId,
    clientId,
    locationId: null,
    title,
    category: "Door",
    secretCiphertext: "cipher",
    secretNonce: "nonce",
    instructionsCiphertext: null,
    instructionsNonce: null,
    notesCiphertext: null,
    notesNonce: null,
    expiresAt: null,
    status: "active",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: newId(),
    ...overrides,
  };
}
