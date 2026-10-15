export type RecordStatus = "active" | "archived";
export type AccessLifecycle = "active" | "expired" | "archived";
export type KdfName = "argon2id" | "pbkdf2-sha256";
export type AuditAction =
  | "login"
  | "logout"
  | "unlock"
  | "lock"
  | "reveal"
  | "copy"
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "delete"
  | "encrypted_backup"
  | "plaintext_export"
  | "backup_restore";

export interface Argon2Params {
  m: number;
  t: number;
  p: number;
  dkLen: number;
}

export interface Pbkdf2Params {
  iterations: number;
  hash: "SHA-256";
  dkLen: number;
}

export type KdfParams = Argon2Params | Pbkdf2Params;

export interface Profile {
  id: string;
  displayName: string;
  inactivityLockMinutes: number;
  secretSearchOptIn: boolean;
  recoveryAcknowledged: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultRecord {
  id: string;
  userId: string;
  kdf: KdfName;
  kdfSalt: string;
  kdfParams: KdfParams;
  wrappedDek: string;
  wrappedDekNonce: string;
  recoveryWrappedDek: string;
  recoveryWrappedDekNonce: string;
  verifierCiphertext: string;
  verifierNonce: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecord {
  id: string;
  userId: string;
  name: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notesCiphertext: string | null;
  notesNonce: string | null;
  tags: string[];
  status: RecordStatus;
  version: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientRequestId: string;
}

export interface LocationRecord {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  address: string;
  notesCiphertext: string | null;
  notesNonce: string | null;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  clientRequestId: string;
}

export interface AccessRecord {
  id: string;
  userId: string;
  clientId: string;
  locationId: string | null;
  title: string;
  category: string;
  secretCiphertext: string;
  secretNonce: string;
  instructionsCiphertext: string | null;
  instructionsNonce: string | null;
  notesCiphertext: string | null;
  notesNonce: string | null;
  expiresAt: string | null;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  clientRequestId: string;
}

export interface CategoryRecord {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  clientRequestId: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface Dataset {
  clients: ClientRecord[];
  locations: LocationRecord[];
  accessRecords: AccessRecord[];
  categories: CategoryRecord[];
}

export interface ClientInput {
  name: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  tags: string[];
}

export interface LocationInput {
  clientId: string;
  name: string;
  address: string;
  notes?: string;
}

export interface CodeInput {
  clientId: string;
  locationId: string | null;
  title: string;
  category: string;
  secret?: string;
  instructions?: string;
  notes?: string;
  expiresAt: string | null;
}
