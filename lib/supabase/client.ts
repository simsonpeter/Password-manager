import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseConfig } from "@/lib/security/public-key";

export function createBrowserSupabase(): SupabaseClient | null {
  const config = readPublicSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
