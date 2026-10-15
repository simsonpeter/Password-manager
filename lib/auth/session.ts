export function isSessionExpired(expiresAtSeconds: number | null | undefined, nowMs = Date.now(), skewMs = 5_000): boolean {
  if (!expiresAtSeconds || !Number.isFinite(expiresAtSeconds)) return true;
  return expiresAtSeconds * 1000 <= nowMs + skewMs;
}
