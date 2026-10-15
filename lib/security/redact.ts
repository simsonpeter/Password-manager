const SENSITIVE_KEY = /passphrase|password|secret|ciphertext|nonce|token|authorization|recovery|notes|instructions|dek|key|code/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1);
    }
    return output;
  }
  return value;
}

export function safeLog(message: string, details?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(message, details === undefined ? "" : redact(details));
}
