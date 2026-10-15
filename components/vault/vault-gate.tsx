"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, syncLabelFor } from "@/components/shell/app-shell";
import { useVault } from "@/components/providers/vault-provider";
import { passwordSchema } from "@/lib/domain/schema";
import { VaultPassphraseError } from "@/lib/errors";

export function VaultGate({ children }: { children: ReactNode }) {
  const app = useVault();
  if (!app.configured) return <ConfigureScreen />;
  if (app.loading) return <StatusScreen title="Opening your vault" body="Checking your session and encrypted records." />;
  if (!app.userId) return <StatusScreen title="Sign in required" body="Your session is missing. Sign in again to continue." href="/login" action="Sign in" />;
  if (app.recoveryKeyPending) return <RecoveryKeyScreen />;
  if (!app.vault) return <VaultSetupScreen />;
  if (!app.unlocked) return <VaultUnlockScreen />;
  return (
    <AppShell email={app.email} syncLabel={syncLabelFor(app.sync.kind)} offline={app.offline} onLock={app.lock}>
      {children}
    </AppShell>
  );
}

function StatusScreen({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 py-8">
          <h1 className="text-2xl font-semibold text-navy">{title}</h1>
          <p className="text-muted">{body}</p>
          {href && action ? (
            <a href={href} className="inline-flex h-11 items-center rounded-lg bg-navy px-4 font-semibold text-white">
              {action}
            </a>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export function ConfigureScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-4 py-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">Setup required</p>
          <h1 className="text-3xl font-semibold text-navy">Connect Supabase before using AccessVault</h1>
          <p className="text-muted">
            The app is installed, but this environment does not have a Supabase URL and anon key. AccessVault will not invent credentials or store codes locally.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
            <li>Create a Supabase project and run the SQL migration in <code>supabase/migrations</code>.</li>
            <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
            <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</li>
            <li>Restart the dev server. Never add the service-role key.</li>
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}

function VaultSetupScreen() {
  const app = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(passphrase);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Use a longer passphrase.");
      return;
    }
    if (passphrase !== confirm) {
      setError("The passphrases do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await app.setupVault(passphrase);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The vault could not be created.");
    } finally {
      setPassphrase("");
      setConfirm("");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-5 py-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-navy">Create your vault passphrase</h1>
              <p className="text-sm text-muted">This is separate from your account password.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              If you lose this passphrase and the recovery key, your access codes cannot be restored. AccessVault does not keep a copy of the passphrase or a server master key.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="vault-passphrase">Vault passphrase</Label>
              <Input id="vault-passphrase" type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="vault-confirm">Confirm passphrase</Label>
              <Input id="vault-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating encrypted vault…" : "Create vault"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function RecoveryKeyScreen() {
  const app = useVault();
  const [saved, setSaved] = useState(false);
  const key = app.recoveryKeyPending ?? "";

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-5 py-8">
          <h1 className="text-2xl font-semibold text-navy">Save your recovery key</h1>
          <p className="text-muted">
            This key can unlock the vault if you forget the passphrase. It is shown only now. AccessVault cannot show it again. Anyone with this key can decrypt your codes.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-navy px-4 py-4 font-mono text-sm leading-7 text-white">{key}</pre>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(key);
              }}
            >
              Copy recovery key
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const blob = new Blob(
                  ["AccessVault recovery key\nStore this offline.\nAnyone with this key can decrypt your codes.\n\n", key, "\n"],
                  { type: "text/plain" },
                );
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "accessvault-recovery-key.txt";
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1500);
              }}
            >
              Download recovery key
            </Button>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            I have stored this recovery key somewhere I can find it later.
          </label>
          <Button type="button" disabled={!saved} onClick={() => void app.acknowledgeRecovery()}>
            Continue to the vault
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function VaultUnlockScreen() {
  const app = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [recovery, setRecovery] = useState("");
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (mode === "passphrase") await app.unlock(passphrase);
      else await app.unlockRecovery(recovery);
    } catch (cause) {
      setError(cause instanceof VaultPassphraseError ? cause.message : "The vault could not be unlocked.");
    } finally {
      setPassphrase("");
      setRecovery("");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 py-8">
          <h1 className="text-2xl font-semibold text-navy">Unlock vault</h1>
          <p className="text-sm text-muted">
            Signed in as {app.email}. The encryption key stays in memory until you lock the vault, go idle, or reload the page.
          </p>
          {!app.profile?.recoveryAcknowledged ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Your recovery key has not been confirmed. If you still know the passphrase, rotate the recovery key in Settings after unlocking.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "passphrase" ? (
              <div>
                <Label htmlFor="unlock-passphrase">Vault passphrase</Label>
                <Input id="unlock-passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} required />
              </div>
            ) : (
              <div>
                <Label htmlFor="unlock-recovery">Recovery key</Label>
                <Input id="unlock-recovery" autoComplete="off" value={recovery} onChange={(event) => setRecovery(event.target.value)} required />
              </div>
            )}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
          <button type="button" className="text-sm font-semibold text-teal-800" onClick={() => setMode(mode === "passphrase" ? "recovery" : "passphrase")}>
            {mode === "passphrase" ? "Use recovery key" : "Use vault passphrase"}
          </button>
          <button type="button" className="block text-sm text-muted" onClick={() => void app.signOut()}>
            Sign out
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
