export interface RateLimiter {
  attempt: (key: string, now?: number) => { allowed: boolean; retryAfterMs: number };
  reset: (key: string) => void;
}

export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    attempt(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < options.windowMs);
      if (recent.length >= options.limit) {
        const oldest = recent[0] ?? now;
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: options.windowMs - (now - oldest) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

export const loginRateLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
