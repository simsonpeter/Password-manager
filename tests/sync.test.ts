import { describe, expect, it, vi } from "vitest";
import { SyncConflictError, NetworkError } from "@/lib/errors";
import { commitWithRetry } from "@/lib/sync/retry";

describe("sync retries", () => {
  it("retries network failures and then returns the confirmed value", async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;
    const result = await commitWithRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new NetworkError("offline");
      return { id: "saved" };
    }, { retries: 3, sleep });
    expect(result).toEqual({ id: "saved" });
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry a conflict", async () => {
    let attempts = 0;
    await expect(
      commitWithRetry(async () => {
        attempts += 1;
        throw new SyncConflictError({ id: "server" });
      }),
    ).rejects.toBeInstanceOf(SyncConflictError);
    expect(attempts).toBe(1);
  });
});
