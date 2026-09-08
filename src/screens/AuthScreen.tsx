import { useState, type FormEvent } from "react";
import { ArchMark, KeyholeIcon } from "../components/Icons";
import type { VaultAPI } from "../lib/api";

type Mode = "signin" | "signup" | "reset";

type Props = {
  api: VaultAPI;
  onToast: (message: string) => void;
  onConnect: () => void;
};

export function AuthScreen({ api, onToast, onConnect }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cloud = api.kind === "cloud";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "reset") {
        await api.resetPassword(email);
        onToast("Reset link sent — check your inbox.");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        if (password !== confirm) throw new Error("Passwords do not match.");
        await api.signUp(email, password);
        onToast(cloud ? "Vault created." : "On-device vault created.");
        return;
      }
      await api.signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth-stage">
        <ArchMark className="auth-arch" />
        <div className="auth-copy">
          <p className="eyebrow">Access vault</p>
          <h1>
            Keystone
            <em> keeps every gate</em>
          </h1>
          <p className="lede">
            A quiet place for port codes, door pins, and the numbers you never want to hunt for
            again.
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-mark">
          <KeyholeIcon />
        </div>
        <p className="backend-pill">
          {cloud ? "Synced with Supabase" : "Saved on this device"}
        </p>
        {!cloud && (
          <button type="button" className="btn-ghost btn-block" onClick={onConnect}>
            Connect Supabase
          </button>
        )}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === "signin" ? "active" : ""}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Create vault
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-brass" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "reset"
                ? "Send reset link"
                : mode === "signup"
                  ? "Create vault"
                  : "Enter"}
          </button>
        </form>

        {mode === "signin" && cloud && (
          <p className="auth-foot">
            <button type="button" className="text-link" onClick={() => setMode("reset")}>
              Forgot password?
            </button>
          </p>
        )}
        {mode === "reset" && (
          <p className="auth-foot">
            <button type="button" className="text-link" onClick={() => setMode("signin")}>
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
