import type { CloudConfig } from "./types";

const URL_KEY = "keystone.supabase.url";
const ANON_KEY = "keystone.supabase.anon";

export function readEnvCloud(): CloudConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !anonKey || url.includes("YOUR-PROJECT")) return null;
  return { url, anonKey };
}

export function readSavedCloud(): CloudConfig | null {
  const url = localStorage.getItem(URL_KEY)?.trim() ?? "";
  const anonKey = localStorage.getItem(ANON_KEY)?.trim() ?? "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getCloudConfig(): CloudConfig | null {
  return readEnvCloud() ?? readSavedCloud();
}

export function isEnvLocked(): boolean {
  return Boolean(readEnvCloud());
}

export function saveCloudConfig(config: CloudConfig): void {
  localStorage.setItem(URL_KEY, config.url.trim());
  localStorage.setItem(ANON_KEY, config.anonKey.trim());
}

export function clearSavedCloudConfig(): void {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(ANON_KEY);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function generatePin(length = 4): string {
  const n = 10 ** length;
  return String(Math.floor(Math.random() * n)).padStart(length, "0");
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never used";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
