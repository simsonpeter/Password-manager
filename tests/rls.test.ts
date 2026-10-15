import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../supabase/migrations/20261015000000_init.sql", import.meta.url), "utf8");

const TABLES = ["profiles", "vaults", "clients", "locations", "categories", "access_records", "audit_events"];

describe("row level security", () => {
  it("enables RLS and writes explicit policies for every user-owned table", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`create policy ${table}_select`);
      expect(sql).toContain(`create policy ${table}_insert`);
      expect(sql).toContain(`create policy ${table}_delete`);
      if (table === "audit_events") {
        expect(sql).not.toContain("create policy audit_events_update");
      } else {
        expect(sql).toContain(`create policy ${table}_update`);
        expect(sql).toMatch(new RegExp(`create policy ${table}_update[\\s\\S]*with check`, "m"));
      }
    }
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("user_id cannot be changed");
    expect(sql).not.toMatch(/service_role/i);
  });

  it("stores ciphertext columns and does not add a plaintext code column", () => {
    expect(sql).toContain("secret_ciphertext");
    expect(sql).toContain("secret_nonce");
    expect(sql).not.toMatch(/\bcode\s+text\b/i);
    expect(sql).not.toMatch(/\bpassphrase\s+text\b/i);
    expect(sql).not.toMatch(/\bvault_password\b/i);
  });
});
