export class VaultLockedError extends Error {
  constructor(message = "Unlock the vault before viewing or changing encrypted fields.") {
    super(message);
    this.name = "VaultLockedError";
  }
}

export class VaultPassphraseError extends Error {
  constructor(message = "That vault passphrase or recovery key is not correct.") {
    super(message);
    this.name = "VaultPassphraseError";
  }
}

export class SyncConflictError<T = unknown> extends Error {
  readonly server: T;

  constructor(server: T) {
    super("The cloud copy changed before this save finished.");
    this.name = "SyncConflictError";
    this.server = server;
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Your session expired. Sign in again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class NotAuthorizedError extends Error {
  constructor(message = "You do not have access to that record.") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "That record was not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class NetworkError extends Error {
  constructor(message = "The network request failed.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class NotConfiguredError extends Error {
  constructor(message = "Supabase is not configured.") {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}
