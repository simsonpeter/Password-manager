import { decryptString } from "@/lib/crypto/aesgcm";
import { AAD_INSTRUCTIONS, AAD_NOTES, AAD_SECRET } from "@/lib/crypto/vault-crypto";
import type {
  AccessRecord,
  CategoryRecord,
  ClientRecord,
  Dataset,
  LocationRecord,
  VaultRecord,
} from "@/lib/domain/types";
import { BackupError } from "@/lib/errors";
import type { Repository } from "@/lib/data/repository";
import { nowIso } from "@/lib/utils";

export const ENCRYPTED_BACKUP_FORMAT = "accessvault-encrypted-backup";
export const PLAINTEXT_EXPORT_FORMAT = "accessvault-plaintext-export";
export const PLAINTEXT_WARNING =
  "This file contains readable access codes and notes. It is not encrypted. Store it somewhere safe and delete it when you no longer need it.";

const FORBIDDEN_KEYS = ["secret", "passphrase", "password", "dek", "recoverykey", "recovery_key"];

export interface EncryptedBackupFile {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  vault: VaultRecord;
  clients: ClientRecord[];
  locations: LocationRecord[];
  accessRecords: AccessRecord[];
  categories: CategoryRecord[];
}

export interface PlaintextCode {
  title: string;
  category: string;
  location: string | null;
  code: string;
  instructions: string;
  notes: string;
  expiresAt: string | null;
  status: string;
}

export interface PlaintextExportFile {
  format: typeof PLAINTEXT_EXPORT_FORMAT;
  warning: string;
  exportedAt: string;
  clients: Array<{
    name: string;
    businessName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    tags: string[];
    locations: Array<{ name: string; address: string; notes: string }>;
    codes: PlaintextCode[];
  }>;
}

export interface RestoreConflict {
  kind: "client" | "location" | "code" | "category";
  id: string;
  name: string;
  localUpdatedAt: string;
  incomingUpdatedAt: string;
}

export interface RestorePlan {
  clientInserts: ClientRecord[];
  clientUpdates: ClientRecord[];
  clientConflicts: Array<{ local: ClientRecord; incoming: ClientRecord }>;
  locationInserts: LocationRecord[];
  locationUpdates: LocationRecord[];
  locationConflicts: Array<{ local: LocationRecord; incoming: LocationRecord }>;
  codeInserts: AccessRecord[];
  codeUpdates: AccessRecord[];
  codeConflicts: Array<{ local: AccessRecord; incoming: AccessRecord }>;
  categoryInserts: CategoryRecord[];
}

function rejectForbidden(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) rejectForbidden(item);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      throw new BackupError("This file contains plaintext secret fields and cannot be imported as an encrypted backup.");
    }
    if (entry && typeof entry === "object") rejectForbidden(entry);
  }
}

export function buildEncryptedBackup(vault: VaultRecord, data: Dataset, exportedAt = nowIso()): EncryptedBackupFile {
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    exportedAt,
    vault,
    clients: data.clients,
    locations: data.locations,
    accessRecords: data.accessRecords,
    categories: data.categories,
  };
}

export function parseEncryptedBackup(raw: string): EncryptedBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError("The backup file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new BackupError("The backup file is empty.");
  const record = parsed as Partial<EncryptedBackupFile>;
  if (record.format !== ENCRYPTED_BACKUP_FORMAT || record.version !== 1 || !record.vault) {
    throw new BackupError("This file is not an AccessVault encrypted backup.");
  }
  rejectForbidden(parsed);
  for (const code of record.accessRecords ?? []) {
    if (!code.secretCiphertext || !code.secretNonce) {
      throw new BackupError("The backup is missing encrypted code payloads.");
    }
  }
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    exportedAt: record.exportedAt ?? nowIso(),
    vault: record.vault,
    clients: record.clients ?? [],
    locations: record.locations ?? [],
    accessRecords: record.accessRecords ?? [],
    categories: record.categories ?? [],
  };
}

function samePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withoutSync<T extends { version: number; updatedAt: string }>(row: T): Omit<T, "version" | "updatedAt"> {
  const copy = { ...row };
  delete (copy as { version?: number }).version;
  delete (copy as { updatedAt?: string }).updatedAt;
  return copy;
}

export function planRestore(local: Dataset, backup: EncryptedBackupFile, userId: string): RestorePlan {
  const plan: RestorePlan = {
    clientInserts: [],
    clientUpdates: [],
    clientConflicts: [],
    locationInserts: [],
    locationUpdates: [],
    locationConflicts: [],
    codeInserts: [],
    codeUpdates: [],
    codeConflicts: [],
    categoryInserts: [],
  };

  const clients = new Map(local.clients.map((row) => [row.id, row]));
  for (const incoming of backup.clients) {
    const stamped = { ...incoming, userId };
    const current = clients.get(incoming.id);
    if (!current) {
      plan.clientInserts.push(stamped);
      continue;
    }
    if (samePayload(withoutSync(current), withoutSync(stamped))) continue;
    if (current.updatedAt > incoming.updatedAt) plan.clientConflicts.push({ local: current, incoming: stamped });
    else plan.clientUpdates.push({ ...stamped, version: current.version + 1 });
  }

  const locations = new Map(local.locations.map((row) => [row.id, row]));
  for (const incoming of backup.locations) {
    const stamped = { ...incoming, userId };
    const current = locations.get(incoming.id);
    if (!current) {
      plan.locationInserts.push(stamped);
      continue;
    }
    if (samePayload(withoutSync(current), withoutSync(stamped))) continue;
    if (current.updatedAt > incoming.updatedAt) plan.locationConflicts.push({ local: current, incoming: stamped });
    else plan.locationUpdates.push({ ...stamped, version: current.version + 1 });
  }

  const codes = new Map(local.accessRecords.map((row) => [row.id, row]));
  for (const incoming of backup.accessRecords) {
    const stamped = { ...incoming, userId };
    const current = codes.get(incoming.id);
    if (!current) {
      plan.codeInserts.push(stamped);
      continue;
    }
    if (samePayload(withoutSync(current), withoutSync(stamped))) continue;
    if (current.updatedAt > incoming.updatedAt) plan.codeConflicts.push({ local: current, incoming: stamped });
    else plan.codeUpdates.push({ ...stamped, version: current.version + 1 });
  }

  const categoryNames = new Set(local.categories.map((row) => row.name.toLowerCase()));
  for (const incoming of backup.categories) {
    if (categoryNames.has(incoming.name.toLowerCase())) continue;
    plan.categoryInserts.push({ ...incoming, userId });
  }

  return plan;
}

export function assertVaultCompatible(current: VaultRecord | null, backup: EncryptedBackupFile): void {
  if (!current) return;
  if (current.id !== backup.vault.id) {
    throw new BackupError(
      "This backup belongs to a different vault. Restoring it would leave the codes unreadable with your current passphrase.",
    );
  }
}

export async function applyRestore(
  repo: Repository,
  userId: string,
  currentVault: VaultRecord | null,
  local: Dataset,
  backup: EncryptedBackupFile,
  choice: "keep-local" | "use-backup",
): Promise<{ applied: number; skipped: number }> {
  assertVaultCompatible(currentVault, backup);
  const plan = planRestore(local, backup, userId);
  let applied = 0;
  let skipped = 0;

  for (const row of plan.clientInserts) {
    await repo.createClient({ ...row, userId, version: 1 });
    applied += 1;
  }
  for (const row of plan.clientUpdates) {
    const current = local.clients.find((item) => item.id === row.id);
    if (!current) continue;
    await repo.updateClient({ ...row, userId }, current.version);
    applied += 1;
  }
  for (const conflict of plan.clientConflicts) {
    if (choice === "keep-local") {
      skipped += 1;
      continue;
    }
    await repo.updateClient({ ...conflict.incoming, userId, version: conflict.local.version + 1 }, conflict.local.version);
    applied += 1;
  }

  for (const row of plan.locationInserts) {
    await repo.createLocation({ ...row, userId, version: 1 });
    applied += 1;
  }
  for (const row of plan.locationUpdates) {
    const current = local.locations.find((item) => item.id === row.id);
    if (!current) continue;
    await repo.updateLocation({ ...row, userId }, current.version);
    applied += 1;
  }
  for (const conflict of plan.locationConflicts) {
    if (choice === "keep-local") {
      skipped += 1;
      continue;
    }
    await repo.updateLocation({ ...conflict.incoming, userId, version: conflict.local.version + 1 }, conflict.local.version);
    applied += 1;
  }

  for (const row of plan.codeInserts) {
    await repo.createAccessRecord({ ...row, userId, version: 1 });
    applied += 1;
  }
  for (const row of plan.codeUpdates) {
    const current = local.accessRecords.find((item) => item.id === row.id);
    if (!current) continue;
    await repo.updateAccessRecord({ ...row, userId }, current.version);
    applied += 1;
  }
  for (const conflict of plan.codeConflicts) {
    if (choice === "keep-local") {
      skipped += 1;
      continue;
    }
    await repo.updateAccessRecord({ ...conflict.incoming, userId, version: conflict.local.version + 1 }, conflict.local.version);
    applied += 1;
  }

  for (const row of plan.categoryInserts) {
    await repo.createCategory({ ...row, userId });
    applied += 1;
  }

  return { applied, skipped };
}

export function restoreConflicts(plan: RestorePlan): RestoreConflict[] {
  return [
    ...plan.clientConflicts.map((item) => ({
      kind: "client" as const,
      id: item.local.id,
      name: item.local.name,
      localUpdatedAt: item.local.updatedAt,
      incomingUpdatedAt: item.incoming.updatedAt,
    })),
    ...plan.locationConflicts.map((item) => ({
      kind: "location" as const,
      id: item.local.id,
      name: item.local.name,
      localUpdatedAt: item.local.updatedAt,
      incomingUpdatedAt: item.incoming.updatedAt,
    })),
    ...plan.codeConflicts.map((item) => ({
      kind: "code" as const,
      id: item.local.id,
      name: item.local.title,
      localUpdatedAt: item.local.updatedAt,
      incomingUpdatedAt: item.incoming.updatedAt,
    })),
  ];
}

export async function buildPlaintextExport(
  data: Dataset,
  key: CryptoKey,
  confirmPlaintext: boolean,
): Promise<PlaintextExportFile> {
  if (confirmPlaintext !== true) {
    throw new BackupError("Plaintext export must be explicitly confirmed.");
  }
  const locationsByClient = new Map<string, LocationRecord[]>();
  for (const location of data.locations) {
    const list = locationsByClient.get(location.clientId) ?? [];
    list.push(location);
    locationsByClient.set(location.clientId, list);
  }
  const codesByClient = new Map<string, AccessRecord[]>();
  for (const code of data.accessRecords) {
    const list = codesByClient.get(code.clientId) ?? [];
    list.push(code);
    codesByClient.set(code.clientId, list);
  }
  const locationNames = new Map(data.locations.map((location) => [location.id, location.name]));

  const clients = [];
  for (const client of data.clients) {
    const notes = client.notesCiphertext
      ? await decryptString(key, { ciphertext: client.notesCiphertext, nonce: client.notesNonce ?? "" }, AAD_NOTES)
      : "";
    const locations = [];
    for (const location of locationsByClient.get(client.id) ?? []) {
      locations.push({
        name: location.name,
        address: location.address,
        notes: location.notesCiphertext
          ? await decryptString(key, { ciphertext: location.notesCiphertext, nonce: location.notesNonce ?? "" }, AAD_NOTES)
          : "",
      });
    }
    const codes: PlaintextCode[] = [];
    for (const code of codesByClient.get(client.id) ?? []) {
      codes.push({
        title: code.title,
        category: code.category,
        location: code.locationId ? (locationNames.get(code.locationId) ?? null) : null,
        code: await decryptString(key, { ciphertext: code.secretCiphertext, nonce: code.secretNonce }, AAD_SECRET),
        instructions: code.instructionsCiphertext
          ? await decryptString(
              key,
              { ciphertext: code.instructionsCiphertext, nonce: code.instructionsNonce ?? "" },
              AAD_INSTRUCTIONS,
            )
          : "",
        notes: code.notesCiphertext
          ? await decryptString(key, { ciphertext: code.notesCiphertext, nonce: code.notesNonce ?? "" }, AAD_NOTES)
          : "",
        expiresAt: code.expiresAt,
        status: code.status,
      });
    }
    clients.push({
      name: client.name,
      businessName: client.businessName,
      contactPerson: client.contactPerson,
      phone: client.phone,
      email: client.email,
      address: client.address,
      notes,
      tags: client.tags,
      locations,
      codes,
    });
  }

  return {
    format: PLAINTEXT_EXPORT_FORMAT,
    warning: PLAINTEXT_WARNING,
    exportedAt: nowIso(),
    clients,
  };
}

export function checkVaultMatch(current: VaultRecord | null, backup: EncryptedBackupFile): string | null {
  if (!current) return null;
  if (current.id !== backup.vault.id) {
    return "This backup belongs to a different vault. AccessVault will not mix it with your current codes.";
  }
  return null;
}
