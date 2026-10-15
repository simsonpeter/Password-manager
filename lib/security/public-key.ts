export function jwtRole(token: string): string | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

export function assertBrowserSafeSupabaseKey(anonKey: string | undefined): void {
  if (!anonKey) return;
  const role = jwtRole(anonKey);
  if (role === "service_role" || anonKey.toLowerCase().includes("service_role")) {
    throw new Error("Refusing to start. The Supabase service-role key must never be used in the browser.");
  }
}

export function readPublicSupabaseConfig(env?: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): { url: string; anonKey: string } | null {
  const source = env ?? {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  if (url.includes("YOUR_PROJECT_REF") || anonKey.includes("YOUR_SUPABASE_ANON_KEY")) return null;
  assertBrowserSafeSupabaseKey(anonKey);
  return { url, anonKey };
}
