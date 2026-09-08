import { createClient } from "@supabase/supabase-js";
import type { CloudConfig } from "./types";

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json) as { role?: string };
  } catch {
    return null;
  }
}

export function normalizeProjectUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function validateCloudConfig(url: string, key: string): CloudConfig {
  const projectUrl = normalizeProjectUrl(url);
  const anonKey = key.trim();

  const hosted = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(projectUrl);
  if (!hosted && !local) {
    throw new Error("Project URL should look like https://abcdxyz.supabase.co");
  }

  if (!anonKey) throw new Error("Paste your publishable or anon key.");
  if (anonKey.startsWith("sb_secret_")) {
    throw new Error("That is a secret key. Use the publishable key (sb_publishable_…).");
  }

  if (anonKey.startsWith("eyJ")) {
    const payload = decodeJwtPayload(anonKey);
    if (payload?.role === "service_role") {
      throw new Error("That is the service_role key. Use the anon or publishable key instead.");
    }
  } else if (!anonKey.startsWith("sb_publishable_") && anonKey.length < 20) {
    throw new Error("Paste the publishable key (sb_publishable_…) or the legacy anon key.");
  }

  return { url: projectUrl, anonKey };
}

export async function testCloudConnection(url: string, key: string): Promise<CloudConfig> {
  const config = validateCloudConfig(url, key);
  const client = createClient(config.url, config.anonKey);
  const { error } = await client.from("entries").select("id").limit(1);

  if (!error) return config;

  const message = error.message.toLowerCase();
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  ) {
    throw new Error(
      "The keys work, but the entries table is missing. Copy the SQL in this screen, paste it in the SQL editor, and run it.",
    );
  }
  if (error.code === "42501" || message.includes("permission denied")) {
    throw new Error("Table exists, but permissions are missing. Run the full SQL again.");
  }
  if (
    error.code === "401" ||
    message.includes("invalid api key") ||
    message.includes("unauthorized") ||
    message.includes("invalid jwt")
  ) {
    throw new Error("That key was rejected. Copy the publishable key from Settings → API Keys.");
  }
  throw new Error(error.message);
}
