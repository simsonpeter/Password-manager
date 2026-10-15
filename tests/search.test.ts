import { describe, expect, it } from "vitest";
import { findSimilarClients } from "@/lib/domain/duplicates";
import { buildSearchDocuments, querySearch } from "@/lib/domain/search";
import { effectiveAccessStatus } from "@/lib/domain/status";
import { computeStats } from "@/lib/domain/stats";
import { makeClient, makeCode, makeLocation } from "./helpers";

describe("search and filters", () => {
  it("matches metadata and never puts a secret in the result", () => {
    const userId = crypto.randomUUID();
    const client = makeClient(userId, "River Freight", { businessName: "River Freight Ltd", address: "12 Canal", tags: ["night"] });
    const location = makeLocation(userId, client.id, "Warehouse bay");
    const code = makeCode(userId, client.id, "Roller door", { category: "Warehouse", locationId: location.id, secretCiphertext: "not-the-code" });
    const documents = buildSearchDocuments({ clients: [client], locations: [location], accessRecords: [code], categories: [] });
    const hits = querySearch(documents, { query: "roller", category: "Warehouse", clientId: client.id, locationId: location.id, status: "active", sort: "name" });
    expect(hits).toHaveLength(1);
    expect(JSON.stringify(hits)).not.toContain("not-the-code");
    expect(hits[0]).not.toHaveProperty("secret");
    const secretHits = querySearch(documents, { query: "001999", category: "all", clientId: "all", locationId: "all", status: "all", sort: "updated" }, new Map([[code.id, "001999"]]));
    expect(secretHits).toHaveLength(1);
    expect(JSON.stringify(secretHits)).not.toContain("001999");
  });

  it("filters expired and archived codes", () => {
    const userId = crypto.randomUUID();
    const client = makeClient(userId, "Client");
    const expired = makeCode(userId, client.id, "Old gate", { expiresAt: "2000-01-01" });
    const archived = makeCode(userId, client.id, "Stored", { status: "archived", expiresAt: "2000-01-01" });
    expect(effectiveAccessStatus(expired, new Date("2026-10-15T00:00:00Z"))).toBe("expired");
    expect(effectiveAccessStatus(archived, new Date("2026-10-15T00:00:00Z"))).toBe("archived");
    const documents = buildSearchDocuments({ clients: [client], locations: [], accessRecords: [expired, archived], categories: [] }, new Date("2026-10-15T00:00:00Z"));
    const expiredHits = querySearch(documents, { query: "", category: "all", clientId: "all", locationId: "all", status: "expired", sort: "name" });
    expect(expiredHits.map((hit) => hit.title)).toEqual(["Old gate"]);
  });

  it("counts expiring codes without exposing secrets", () => {
    const userId = crypto.randomUUID();
    const client = makeClient(userId, "Client");
    const code = makeCode(userId, client.id, "Alarm panel", { expiresAt: "2026-10-20", secretCiphertext: "998877" });
    const stats = computeStats({ clients: [client], locations: [], accessRecords: [code], categories: [] }, new Date("2026-10-15T00:00:00Z"));
    expect(stats.expiringCodes).toBe(1);
    expect(JSON.stringify(stats.expiring)).not.toContain("998877");
  });

  it("warns on similar names without blocking the match list", () => {
    const matches = findSimilarClients("Harbour Cafe", [
      { id: "1", name: "Harbor Cafe" },
      { id: "2", name: "Completely Different" },
    ]);
    expect(matches.map((match) => match.id)).toEqual(["1"]);
  });
});
