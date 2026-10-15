export type VaultLockReason = "manual" | "inactivity" | "signout" | "reload";

type Listener = () => void;

/**
 * Holds the unlocked AES key in memory only.
 * The key is non-extractable. Locking drops the reference and clears cached plaintext.
 */
export class VaultSession {
  private key: CryptoKey | null = null;
  private secrets = new Map<string, string>();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  getKey(): CryptoKey | null {
    return this.key;
  }

  unlock(key: CryptoKey): void {
    if (key.extractable) {
      throw new Error("Refusing an extractable vault key.");
    }
    this.key = key;
    this.emit();
  }

  lock(): void {
    this.key = null;
    for (const id of this.secrets.keys()) {
      this.secrets.set(id, "");
    }
    this.secrets.clear();
    this.emit();
  }

  cacheSecret(id: string, value: string): void {
    this.secrets.set(id, value);
  }

  readSecret(id: string): string | null {
    return this.secrets.get(id) ?? null;
  }

  forgetSecret(id: string): void {
    if (this.secrets.has(id)) this.secrets.set(id, "");
    this.secrets.delete(id);
  }

  secretCount(): number {
    return this.secrets.size;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function createInactivityLock(options: {
  getMinutes: () => number;
  isActive: () => boolean;
  onLock: () => void;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}): { signalActivity: () => void; stop: () => void; arm: () => void } {
  const schedule = options.schedule ?? ((callback, ms) => setTimeout(callback, ms));
  const cancel = options.cancel ?? ((timer) => clearTimeout(timer));
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (timer) cancel(timer);
    timer = null;
  };

  const arm = () => {
    stop();
    if (!options.isActive()) return;
    const minutes = options.getMinutes();
    const ms = Math.max(1, minutes) * 60_000;
    timer = schedule(() => {
      timer = null;
      if (options.isActive()) options.onLock();
    }, ms);
  };

  return { signalActivity: arm, stop, arm };
}
