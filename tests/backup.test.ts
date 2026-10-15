import { describe, expect, it } from "vitest";
import { applyRestore, buildEncryptedBackup, buildPlaintextExport, parseEncryptedBackup, planRestore } from "@/lib/backup/backup";
import { BackupError } from "@/lib/errors";
import { MemoryRepository } from "@/lib/data/memory-repository";
import { createAccessCode, createClientRecord } from "@/lib/vault/operations";
import { makeVault } from "./helpers";

describe("backup and restore", () => {
  it("exports ciphertext by default and requires an explicit plaintext confirmation", async () => {
    const userId = crypto.randomUUID();
    const { vault, key } = await makeVault(userId);
    const repo = new MemoryRepository();
    const ctx = { userId, repo, key };
    const client = await createClientRecord(ctx, { name: "Depot", businessName: "", contactPerson: "", phone: "", email: "", address: "9 Yard", tags: [] }, crypto.randomUUID());
    const code = await createAccessCode(ctx, { clientId: client.id, locationId: null, title: "Gate", category: "Port gate", secret: "001100", instructions: "", notes: "leave open", expiresAt: null }, crypto.randomUUID());
    const dataset = { clients: await repo.listClients(userId), locations: [], accessRecords: await repo.listAccessRecords(userId), categories: [] };
    const backup = buildEncryptedBackup(vault, dataset);
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain("001100");
    expect(serialized).not.toContain("leave open");
    expect(parseEncryptedBackup(serialized).accessRecords[0]?.id).toBe(code.id);
    await expect(buildPlaintextExport(dataset, key, false)).rejects.toBeInstanceOf(BackupError);
    const plaintext = await buildPlaintextExport(dataset, key, true);
    expect(plaintext.clients[0]?.codes[0]?.code).toBe("001100");
    expect(plaintext.warning.toLowerCase()).toContain("not encrypted");
  });

  it("restores newer backup rows and keeps newer local rows unless asked", async () => {
    const userId = crypto.randomUUID();
    const { vault, key } = await makeVault(userId);
    const repo = new MemoryRepository();
    const ctx = { userId, repo, key };
    const client = await createClientRecord(ctx, { name: "Local name", businessName: "", contactPerson: "", phone: "", email: "", address: "", tags: [] }, crypto.randomUUID());
    const local = { clients: await repo.listClients(userId), locations: [], accessRecords: [], categories: [] };
    const backup = buildEncryptedBackup(vault, {
      clients: [{ ...client, name: "Backup name", updatedAt: "1999-01-01T00:00:00.000Z" }],
      locations: [],
      accessRecords: [],
      categories: [],
    });
    const plan = planRestore(local, backup, userId);
    expect(plan.clientConflicts).toHaveLength(1);
    const kept = await applyRestore(repo, userId, vault, local, backup, "keep-local");
    expect(kept.skipped).toBe(1);
    expect((await repo.listClients(userId))[0]?.name).toBe("Local name");
    const replaced = await applyRestore(repo, userId, vault, await fresh(repo, userId), backup, "use-backup");
    expect(replaced.applied).toBe(1);
    expect((await repo.listClients(userId))[0]?.name).toBe("Backup name");
  });

  it("refuses a backup from a different vault", async () => {
    const userId = crypto.randomUUID();
    const current = await makeVault(userId);
    const other = await makeVault(userId);
    const repo = new MemoryRepository();
    const backup = buildEncryptedBackup(other.vault, { clients: [], locations: [], accessRecords: [], categories: [] });
    await expect(applyRestore(repo, userId, current.vault, { clients: [], locations: [], accessRecords: [], categories: [] }, backup, "keep-local")).rejects.toThrow(/different vault/);
  });
});

async function fresh(repo: MemoryRepository, userId: string) {
  return {
    clients: await repo.listClients(userId),
    locations: await repo.listLocations(userId),
    accessRecords: await repo.listAccessRecords(userId),
    categories: await repo.listCategories(userId),
  };
}
