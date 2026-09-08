import { useState, type FormEvent } from "react";
import { CloudIcon, DeviceIcon } from "../components/Icons";
import { Sheet } from "../components/Sheet";
import { clearSavedCloudConfig, isEnvLocked } from "../lib/config";
import type { VaultAPI } from "../lib/api";

type Props = {
  api: VaultAPI;
  email: string;
  onClose: () => void;
  onToast: (message: string) => void;
  onSeed: () => Promise<void>;
  onConnect: () => void;
};

export function SettingsSheet({ api, email, onClose, onToast, onSeed, onConnect }: Props) {
  const locked = isEnvLocked();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function disconnect() {
    clearSavedCloudConfig();
    onToast("Cloud disconnected. Reloading…");
    window.setTimeout(() => window.location.reload(), 600);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.updatePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      onToast("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api.signOut();
    onClose();
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="settings">
        <section className="setting-card">
          <p className="eyebrow">Signed in</p>
          <p className="setting-email">{email}</p>
          <p className="backend-pill">
            {api.kind === "cloud" ? <CloudIcon /> : <DeviceIcon />}
            {api.kind === "cloud" ? "Supabase cloud" : "This device only"}
          </p>
        </section>

        <form className="editor" onSubmit={changePassword}>
          <h3>Password</h3>
          <label>
            Current
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm new
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="btn-ghost" disabled={busy}>
            Update password
          </button>
        </form>

        <section className="editor">
          <h3>Supabase</h3>
          {locked ? (
            <p className="muted">This build already has cloud credentials baked in.</p>
          ) : api.kind === "cloud" ? (
            <button type="button" className="btn-ghost" onClick={disconnect}>
              Use this device only
            </button>
          ) : (
            <button type="button" className="btn-brass" onClick={onConnect}>
              Connect Supabase
            </button>
          )}
        </section>

        {api.kind === "local" && (
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await onSeed();
              onToast("Sample keys added.");
            }}
          >
            Load sample keys
          </button>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="button" className="btn-danger-text" onClick={signOut}>
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
