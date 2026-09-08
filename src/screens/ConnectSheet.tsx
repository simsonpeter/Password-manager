import { useState, type FormEvent } from "react";
import { Sheet } from "../components/Sheet";
import { testCloudConnection } from "../lib/connect";
import { isEnvLocked, saveCloudConfig } from "../lib/config";
import { SCHEMA_SQL } from "../lib/schema";

type Props = {
  onClose: () => void;
  onToast: (message: string) => void;
};

export function ConnectSheet({ onClose, onToast }: Props) {
  const locked = isEnvLocked();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSql, setShowSql] = useState(false);

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL);
      onToast("SQL copied");
    } catch {
      onToast("Copy was blocked — select the SQL below instead.");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const config = await testCloudConnection(url, key);
      saveCloudConfig(config);
      onToast("Supabase connected. Reloading…");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Connect Supabase" onClose={onClose} wide>
      <ol className="setup-steps">
        <li>
          Create a free project at{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            supabase.com/dashboard
          </a>
          . Wait until it finishes provisioning.
        </li>
        <li>
          Authentication → Sign In / Providers → Email: turn <strong>Confirm email</strong> off so
          you can sign in on your phone immediately.
        </li>
        <li>
          SQL Editor → New query. Paste the Keystone SQL and click <strong>Run</strong>.
          <div className="setup-sql">
            <button type="button" className="text-link" onClick={() => void copySql()}>
              Copy SQL
            </button>
            <button type="button" className="text-link" onClick={() => setShowSql((open) => !open)}>
              {showSql ? "Hide SQL" : "Show SQL"}
            </button>
            {showSql && <pre>{SCHEMA_SQL}</pre>}
          </div>
        </li>
        <li>
          Open the project <strong>Connect</strong> dialog, or Settings → API Keys. Copy the{" "}
          <strong>Project URL</strong> and the <strong>publishable</strong> key (
          <code>sb_publishable_…</code>). The legacy <code>anon</code> key also works. Never paste a
          secret or <code>service_role</code> key.
        </li>
      </ol>

      {locked ? (
        <p className="muted">This build already has cloud credentials baked in.</p>
      ) : (
        <form className="editor" onSubmit={(event) => void onSubmit(event)}>
          <p className="muted">
            After connecting, create a cloud account. Codes already saved on this device stay on
            this device.
          </p>
          <label>
            Project URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              autoComplete="off"
              required
            />
          </label>
          <label>
            Publishable or anon key
            <textarea
              rows={3}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sb_publishable_… or eyJ…"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="sheet-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-brass" disabled={busy}>
              {busy ? "Testing…" : "Test and connect"}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
