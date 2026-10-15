import { decryptString, encryptString } from "@/lib/crypto/aesgcm";
import { AAD_INSTRUCTIONS, AAD_NOTES, AAD_SECRET } from "@/lib/crypto/vault-crypto";
import { DEFAULT_CATEGORIES } from "@/lib/domain/categories";
import type {
  AccessRecord,
  AuditAction,
  CategoryRecord,
  ClientInput,
  ClientRecord,
  CodeInput,
  LocationInput,
  LocationRecord,
  RecordStatus,
} from "@/lib/domain/types";
import { VaultLockedError } from "@/lib/errors";
import type { Repository } from "@/lib/data/repository";
import { newId, nowIso } from "@/lib/utils";

export interface OpContext {
  userId: string;
  repo: Repository;
  key: CryptoKey | null;
}

function requireKey(ctx: OpContext): CryptoKey {
  if (!ctx.key) throw new VaultLockedError();
  return ctx.key;
}

async function encryptOptional(key: CryptoKey, value: string | undefined, aad: string): Promise<{ ciphertext: string; nonce: string } | null> {
  if (!value) return null;
  return encryptString(key, value, aad);
}

export async function decryptField(
  key: CryptoKey,
  ciphertext: string | null,
  nonce: string | null,
  aad: string,
): Promise<string> {
  if (!ciphertext || !nonce) return "";
  return decryptString(key, { ciphertext, nonce }, aad);
}

export async function ensureDefaultCategories(ctx: OpContext, existing: CategoryRecord[]): Promise<CategoryRecord[]> {
  const known = new Set(existing.map((category) => category.name.toLowerCase()));
  const created = [...existing];
  for (const name of DEFAULT_CATEGORIES) {
    if (known.has(name.toLowerCase())) continue;
    const row = await ctx.repo.createCategory({
      id: newId(),
      userId: ctx.userId,
      name,
      isDefault: true,
      createdAt: nowIso(),
      clientRequestId: newId(),
    });
    created.push(row);
    known.add(row.name.toLowerCase());
  }
  return created;
}

async function audit(ctx: OpContext, action: AuditAction, entityType: string | null, entityId: string | null): Promise<void> {
  await ctx.repo.addAudit({
    id: newId(),
    userId: ctx.userId,
    action,
    entityType,
    entityId,
    metadata: {},
    createdAt: nowIso(),
  });
}

export async function createClientRecord(ctx: OpContext, input: ClientInput, requestId: string): Promise<ClientRecord> {
  const notes = input.notes ? await encryptOptional(requireKey(ctx), input.notes, AAD_NOTES) : null;
  const timestamp = nowIso();
  const row: ClientRecord = {
    id: newId(),
    userId: ctx.userId,
    name: input.name.trim(),
    businessName: input.businessName.trim(),
    contactPerson: input.contactPerson.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    notesCiphertext: notes?.ciphertext ?? null,
    notesNonce: notes?.nonce ?? null,
    tags: input.tags,
    status: "active",
    version: 1,
    lastAccessedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: requestId,
  };
  const saved = await ctx.repo.createClient(row);
  await audit(ctx, "create", "client", saved.id);
  return saved;
}

export async function updateClientRecord(ctx: OpContext, current: ClientRecord, input: ClientInput): Promise<ClientRecord> {
  let notesCiphertext = current.notesCiphertext;
  let notesNonce = current.notesNonce;
  if (input.notes !== undefined) {
    if (!input.notes) {
      notesCiphertext = null;
      notesNonce = null;
    } else {
      const notes = await encryptString(requireKey(ctx), input.notes, AAD_NOTES);
      notesCiphertext = notes.ciphertext;
      notesNonce = notes.nonce;
    }
  }
  const next: ClientRecord = {
    ...current,
    name: input.name.trim(),
    businessName: input.businessName.trim(),
    contactPerson: input.contactPerson.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    notesCiphertext,
    notesNonce,
    tags: input.tags,
    updatedAt: nowIso(),
    version: current.version + 1,
  };
  const saved = await ctx.repo.updateClient(next, current.version);
  await audit(ctx, "update", "client", saved.id);
  return saved;
}

export async function setClientStatus(ctx: OpContext, current: ClientRecord, status: RecordStatus): Promise<ClientRecord> {
  const saved = await ctx.repo.updateClient({ ...current, status, updatedAt: nowIso(), version: current.version + 1 }, current.version);
  await audit(ctx, status === "archived" ? "archive" : "restore", "client", saved.id);
  return saved;
}

export async function removeClient(ctx: OpContext, current: ClientRecord): Promise<void> {
  await ctx.repo.deleteClient(ctx.userId, current.id);
  await audit(ctx, "delete", "client", current.id);
}

export async function createLocationRecord(ctx: OpContext, input: LocationInput, requestId: string): Promise<LocationRecord> {
  const notes = input.notes ? await encryptOptional(requireKey(ctx), input.notes, AAD_NOTES) : null;
  const timestamp = nowIso();
  const row: LocationRecord = {
    id: newId(),
    userId: ctx.userId,
    clientId: input.clientId,
    name: input.name.trim(),
    address: input.address.trim(),
    notesCiphertext: notes?.ciphertext ?? null,
    notesNonce: notes?.nonce ?? null,
    status: "active",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: requestId,
  };
  const saved = await ctx.repo.createLocation(row);
  await audit(ctx, "create", "location", saved.id);
  return saved;
}

export async function updateLocationRecord(ctx: OpContext, current: LocationRecord, input: LocationInput): Promise<LocationRecord> {
  let notesCiphertext = current.notesCiphertext;
  let notesNonce = current.notesNonce;
  if (input.notes !== undefined) {
    if (input.notes && !ctx.key) throw new VaultLockedError();
    const notes = input.notes ? await encryptString(requireKey(ctx), input.notes, AAD_NOTES) : null;
    notesCiphertext = notes?.ciphertext ?? null;
    notesNonce = notes?.nonce ?? null;
  }
  const next: LocationRecord = {
    ...current,
    name: input.name.trim(),
    address: input.address.trim(),
    clientId: input.clientId,
    notesCiphertext,
    notesNonce,
    updatedAt: nowIso(),
    version: current.version + 1,
  };
  const saved = await ctx.repo.updateLocation(next, current.version);
  await audit(ctx, "update", "location", saved.id);
  return saved;
}

export async function setLocationStatus(ctx: OpContext, current: LocationRecord, status: RecordStatus): Promise<LocationRecord> {
  const saved = await ctx.repo.updateLocation(
    { ...current, status, updatedAt: nowIso(), version: current.version + 1 },
    current.version,
  );
  await audit(ctx, status === "archived" ? "archive" : "restore", "location", saved.id);
  return saved;
}

export async function removeLocation(ctx: OpContext, current: LocationRecord): Promise<void> {
  await ctx.repo.deleteLocation(ctx.userId, current.id);
  await audit(ctx, "delete", "location", current.id);
}

export async function createAccessCode(ctx: OpContext, input: CodeInput, requestId: string): Promise<AccessRecord> {
  if (!input.secret) throw new Error("Code is required.");
  const key = requireKey(ctx);
  const secret = await encryptString(key, input.secret, AAD_SECRET);
  const instructions = await encryptOptional(key, input.instructions, AAD_INSTRUCTIONS);
  const notes = await encryptOptional(key, input.notes, AAD_NOTES);
  const timestamp = nowIso();
  const row: AccessRecord = {
    id: newId(),
    userId: ctx.userId,
    clientId: input.clientId,
    locationId: input.locationId,
    title: input.title.trim(),
    category: input.category.trim(),
    secretCiphertext: secret.ciphertext,
    secretNonce: secret.nonce,
    instructionsCiphertext: instructions?.ciphertext ?? null,
    instructionsNonce: instructions?.nonce ?? null,
    notesCiphertext: notes?.ciphertext ?? null,
    notesNonce: notes?.nonce ?? null,
    expiresAt: input.expiresAt,
    status: "active",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    clientRequestId: requestId,
  };
  const saved = await ctx.repo.createAccessRecord(row);
  await audit(ctx, "create", "access_record", saved.id);
  return saved;
}

export async function updateAccessCode(ctx: OpContext, current: AccessRecord, input: CodeInput): Promise<AccessRecord> {
  let secretCiphertext = current.secretCiphertext;
  let secretNonce = current.secretNonce;
  let instructionsCiphertext = current.instructionsCiphertext;
  let instructionsNonce = current.instructionsNonce;
  let notesCiphertext = current.notesCiphertext;
  let notesNonce = current.notesNonce;

  if (input.secret !== undefined) {
    const secret = await encryptString(requireKey(ctx), input.secret, AAD_SECRET);
    secretCiphertext = secret.ciphertext;
    secretNonce = secret.nonce;
  }
  if (input.instructions !== undefined) {
    const instructions = input.instructions
      ? await encryptString(requireKey(ctx), input.instructions, AAD_INSTRUCTIONS)
      : null;
    instructionsCiphertext = instructions?.ciphertext ?? null;
    instructionsNonce = instructions?.nonce ?? null;
  }
  if (input.notes !== undefined) {
    const notes = input.notes ? await encryptString(requireKey(ctx), input.notes, AAD_NOTES) : null;
    notesCiphertext = notes?.ciphertext ?? null;
    notesNonce = notes?.nonce ?? null;
  }

  const next: AccessRecord = {
    ...current,
    clientId: input.clientId,
    locationId: input.locationId,
    title: input.title.trim(),
    category: input.category.trim(),
    secretCiphertext,
    secretNonce,
    instructionsCiphertext,
    instructionsNonce,
    notesCiphertext,
    notesNonce,
    expiresAt: input.expiresAt,
    updatedAt: nowIso(),
    version: current.version + 1,
  };
  const saved = await ctx.repo.updateAccessRecord(next, current.version);
  await audit(ctx, "update", "access_record", saved.id);
  return saved;
}

export async function setAccessStatus(ctx: OpContext, current: AccessRecord, status: RecordStatus): Promise<AccessRecord> {
  const saved = await ctx.repo.updateAccessRecord(
    { ...current, status, updatedAt: nowIso(), version: current.version + 1 },
    current.version,
  );
  await audit(ctx, status === "archived" ? "archive" : "restore", "access_record", saved.id);
  return saved;
}

export async function removeAccessCode(ctx: OpContext, current: AccessRecord): Promise<void> {
  await ctx.repo.deleteAccessRecord(ctx.userId, current.id);
  await audit(ctx, "delete", "access_record", current.id);
}

export async function revealAccessSecret(ctx: OpContext, record: AccessRecord): Promise<string> {
  const secret = await decryptString(
    requireKey(ctx),
    { ciphertext: record.secretCiphertext, nonce: record.secretNonce },
    AAD_SECRET,
  );
  await audit(ctx, "reveal", "access_record", record.id);
  return secret;
}

export async function addCustomCategory(ctx: OpContext, name: string): Promise<CategoryRecord> {
  return ctx.repo.createCategory({
    id: newId(),
    userId: ctx.userId,
    name: name.trim(),
    isDefault: false,
    createdAt: nowIso(),
    clientRequestId: newId(),
  });
}
