import { describe, expect, it, vi } from "vitest";
import { importAesKey } from "@/lib/crypto/aesgcm";
import { createInactivityLock, VaultSession } from "@/lib/vault/session";

describe("vault lock", () => {
  it("keeps the key only while unlocked and clears cached secrets", async () => {
    const session = new VaultSession();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw, false);
    session.unlock(key);
    session.cacheSecret("code-1", "0012");
    expect(session.isUnlocked()).toBe(true);
    expect(session.readSecret("code-1")).toBe("0012");
    session.lock();
    expect(session.isUnlocked()).toBe(false);
    expect(session.getKey()).toBeNull();
    expect(session.readSecret("code-1")).toBeNull();
    expect(session.secretCount()).toBe(0);
  });

  it("refuses an extractable key", async () => {
    const session = new VaultSession();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await importAesKey(raw, true);
    expect(() => session.unlock(key)).toThrow(/extractable/);
  });

  it("locks after inactivity and resets the timer on activity", () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    let active = true;
    const control = createInactivityLock({
      getMinutes: () => 5,
      isActive: () => active,
      onLock,
    });
    control.arm();
    vi.advanceTimersByTime(4 * 60_000);
    control.signalActivity();
    vi.advanceTimersByTime(4 * 60_000);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onLock).toHaveBeenCalledOnce();
    active = false;
    control.arm();
    vi.advanceTimersByTime(10 * 60_000);
    expect(onLock).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
