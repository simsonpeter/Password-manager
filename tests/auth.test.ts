import { describe, expect, it } from "vitest";
import { registerWithEmail, requestPasswordReset, signInWithEmail, type AuthClient } from "@/lib/auth/service";
import { isSessionExpired } from "@/lib/auth/session";
import { assertBrowserSafeSupabaseKey, jwtRole } from "@/lib/security/public-key";
import { copyText } from "@/lib/security/clipboard";
import { contentSecurityPolicy } from "@/lib/security/headers";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { redact } from "@/lib/security/redact";

function authClient(response: { session?: object; error?: { message: string; status?: number } }): AuthClient {
  const payload = {
    data: { session: response.session, user: response.session ? { email: "user@example.com", identities: [{}] } : null },
    error: response.error ?? null,
  };
  return {
    auth: {
      signInWithPassword: async () => payload,
      signUp: async () => payload,
      resetPasswordForEmail: async () => ({ error: response.error ?? null }),
      updateUser: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}

describe("authentication and session handling", () => {
  it("maps sign-in, verification, and reset results", async () => {
    await expect(signInWithEmail(authClient({ session: { access_token: "token" } }), "user@example.com", "password")).resolves.toMatchObject({ ok: true, status: "signed_in" });
    await expect(signInWithEmail(authClient({ error: { message: "Invalid login credentials" } }), "user@example.com", "nope")).resolves.toMatchObject({ status: "invalid_credentials" });
    await expect(signInWithEmail(authClient({ error: { message: "Email not confirmed" } }), "user@example.com", "password")).resolves.toMatchObject({ status: "email_not_confirmed" });
    await expect(registerWithEmail(authClient({}), "user@example.com", "password", "http://localhost/auth/callback")).resolves.toMatchObject({ status: "verification_sent" });
    await expect(requestPasswordReset(authClient({ error: { message: "User not found" } }), "missing@example.com", "http://localhost/reset-password")).resolves.toMatchObject({ status: "reset_sent" });
  });

  it("detects an expired session", () => {
    const now = Date.parse("2026-10-15T12:00:00Z");
    expect(isSessionExpired(Math.floor(now / 1000) - 10, now)).toBe(true);
    expect(isSessionExpired(Math.floor(now / 1000) + 3600, now)).toBe(false);
    expect(isSessionExpired(null, now)).toBe(true);
  });

  it("limits repeated login attempts", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
    for (let attempt = 0; attempt < 5; attempt += 1) expect(limiter.attempt("user@example.com", 1_000).allowed).toBe(true);
    expect(limiter.attempt("user@example.com", 1_000).allowed).toBe(false);
  });

  it("refuses a service-role key and redacts sensitive logs", () => {
    const header = btoa(JSON.stringify({ alg: "none" }));
    const service = `${header}.${btoa(JSON.stringify({ role: "service_role" }))}.sig`;
    expect(jwtRole(service)).toBe("service_role");
    expect(() => assertBrowserSafeSupabaseKey(service)).toThrow(/service-role/);
    expect(redact({ secret: "0012", name: "Client", passphrase: "hidden" })).toEqual({
      secret: "[redacted]",
      name: "Client",
      passphrase: "[redacted]",
    });
  });

  it("copies text and clears the clipboard only when it still matches", async () => {
    let current = "";
    const writes: string[] = [];
    let scheduled: (() => void) | undefined;
    await copyText("0012", {
      writeText: async (value) => {
        current = value;
        writes.push(value);
      },
      readText: async () => current,
    }, { schedule: (callback) => { scheduled = callback; } });
    expect(writes).toEqual(["0012"]);
    current = "something else";
    scheduled?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(writes).toEqual(["0012"]);
    current = "0012";
    scheduled?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(writes.at(-1)).toBe("");
  });

  it("sends a locked-down content security policy", () => {
    const policy = contentSecurityPolicy();
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("https://*.supabase.co");
    expect(policy).toContain("object-src 'none'");
  });
});
