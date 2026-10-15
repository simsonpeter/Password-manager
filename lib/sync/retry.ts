import { NetworkError, SessionExpiredError, SyncConflictError, VaultLockedError, VaultPassphraseError } from "@/lib/errors";

export function isRetryableError(error: unknown): boolean {
  if (error instanceof SyncConflictError) return false;
  if (error instanceof SessionExpiredError) return false;
  if (error instanceof VaultLockedError) return false;
  if (error instanceof VaultPassphraseError) return false;
  if (error instanceof NetworkError) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|failed to fetch|timeout|offline|503|502|504/i.test(message);
}

export async function commitWithRetry<T>(
  operation: () => Promise<T>,
  options?: {
    retries?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 250;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === retries) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
