import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_RETENTION_POLICY } from "@/lib/domain/retention";

describe("offline cache policy", () => {
  it("caches only static assets and falls back to the offline page", () => {
    const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(source).toContain('url.hostname.includes("supabase")');
    expect(source).toContain('url.pathname.startsWith("/api")');
    expect(source).toContain('caches.match("/offline.html")');
    expect(source).toContain('request.method !== "GET"');
    expect(source).not.toContain("access_records");
    expect(source).not.toContain("localStorage");
  });

  it("documents retention without promising recovery of a lost passphrase", () => {
    expect(DATA_RETENTION_POLICY).toMatch(/12 months/);
    expect(DATA_RETENTION_POLICY).toMatch(/no server-side master key/i);
    expect(DATA_RETENTION_POLICY).toMatch(/not encrypted/i);
  });
});
