import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/data/memory-repository";
import { NotAuthorizedError, SyncConflictError } from "@/lib/errors";
import {
  createAccessCode,
  createClientRecord,
  createLocationRecord,
  revealAccessSecret,
  updateClientRecord,
} from "@/lib/vault/operations";
import { makeVault } from "./helpers";

describe("client, location, and code records", () => {
  it("creates several codes for one client and preserves leading zeros", async () => {
    const userId = crypto.randomUUID();
    const { key } = await makeVault(userId);
    const repo = new MemoryRepository();
    const ctx = { userId, repo, key };
    const client = await createClientRecord(
      ctx,
      { name: "North Dock", businessName: "North Dock Ltd", contactPerson: "Amina", phone: "07000000000", email: "desk@example.com", address: "1 Quay", notes: "Call ahead", tags: ["priority"] },
      crypto.randomUUID(),
    );
    const location = await createLocationRecord(ctx, { clientId: client.id, name: "Gate A", address: "1 Quay", notes: "" }, crypto.randomUUID());
    const first = await createAccessCode(ctx, { clientId: client.id, locationId: location.id, title: "Port gate", category: "Port gate", secret: "001234", instructions: "Press hash", notes: "", expiresAt: null }, crypto.randomUUID());
    const second = await createAccessCode(ctx, { clientId: client.id, locationId: null, title: "Side door", category: "Door", secret: "0007", instructions: "", notes: "", expiresAt: "2099-01-01" }, crypto.randomUUID());
    expect(await repo.listAccessRecords(userId)).toHaveLength(2);
    expect(first.secretCiphertext).not.toContain("001234");
    await expect(revealAccessSecret(ctx, first)).resolves.toBe("001234");
    await expect(revealAccessSecret(ctx, second)).resolves.toBe("0007");
  });

  it("retries an identical create without duplicating the client", async () => {
    const userId = crypto.randomUUID();
    const repo = new MemoryRepository();
    const ctx = { userId, repo, key: null };
    const requestId = crypto.randomUUID();
    const input = { name: "Harbour Cafe", businessName: "", contactPerson: "", phone: "", email: "", address: "", tags: [] };
    const first = await createClientRecord(ctx, input, requestId);
    const second = await createClientRecord(ctx, input, requestId);
    expect(second.id).toBe(first.id);
    expect(await repo.listClients(userId)).toHaveLength(1);
  });

  it("does not overwrite a newer client version", async () => {
    const userId = crypto.randomUUID();
    const repo = new MemoryRepository();
    const ctx = { userId, repo, key: null };
    const created = await createClientRecord(ctx, { name: "Original", businessName: "", contactPerson: "", phone: "", email: "", address: "", tags: [] }, crypto.randomUUID());
    const updated = await updateClientRecord(ctx, created, { ...created, name: "Updated", tags: [] });
    await expect(updateClientRecord(ctx, created, { ...created, name: "Stale", tags: [] })).rejects.toBeInstanceOf(SyncConflictError);
    expect((await repo.listClients(userId))[0]?.name).toBe("Updated");
    expect(updated.version).toBe(2);
  });

  it("isolates records by user", async () => {
    const owner = crypto.randomUUID();
    const other = crypto.randomUUID();
    const repo = new MemoryRepository();
    const client = await createClientRecord(
      { userId: owner, repo, key: null },
      { name: "Private Client", businessName: "", contactPerson: "", phone: "", email: "", address: "", tags: [] },
      crypto.randomUUID(),
    );
    expect(await repo.listClients(other)).toEqual([]);
    await expect(repo.updateClient({ ...client, userId: other, name: "Stolen" }, client.version)).rejects.toBeInstanceOf(NotAuthorizedError);
    await expect(repo.deleteClient(other, client.id)).rejects.toBeInstanceOf(NotAuthorizedError);
    await expect(repo.createLocation({
      id: crypto.randomUUID(),
      userId: other,
      clientId: client.id,
      name: "Annex",
      address: "",
      notesCiphertext: null,
      notesNonce: null,
      status: "active",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientRequestId: crypto.randomUUID(),
    })).rejects.toBeInstanceOf(NotAuthorizedError);
    expect((await repo.listClients(owner))[0]?.name).toBe("Private Client");
  });
});
