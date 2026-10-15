"use client";

import { FormEvent, useEffect, useState } from "react";
import { useVault } from "@/components/providers/vault-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DATA_RETENTION_POLICY } from "@/lib/domain/retention";
import { passwordSchema } from "@/lib/domain/schema";
import { restoreConflicts, parseEncryptedBackup, planRestore } from "@/lib/backup/backup";

export function SettingsView() {
  const app = useVault();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [plaintextOpen, setPlaintextOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<"data" | "account" | null>(null);
  const [restoreChoice, setRestoreChoice] = useState<"keep-local" | "use-backup">("keep-local");
  const [restorePreview, setRestorePreview] = useState<string>("");
  const [restoreRaw, setRestoreRaw] = useState<string | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    void app.loadAudit();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    // Load the audit list once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.userId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Settings and security</h1>
        <p className="mt-2 max-w-2xl text-muted">Account access, vault locking, encrypted backup, and retention.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-muted">Signed in as {app.email}</p>
          <PasswordChange />
          <Button type="button" variant="secondary" onClick={() => void app.signOut()}>Sign out</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Vault</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Lock after inactivity</p>
              <p className="text-sm text-muted">The encryption key is dropped. You stay signed in.</p>
            </div>
            <select
              className="h-11 rounded-lg border border-line bg-white px-3"
              aria-label="Inactivity lock"
              value={app.profile?.inactivityLockMinutes ?? 5}
              onChange={(event) => void app.updateSettings({ inactivityLockMinutes: Number(event.target.value) })}
            >
              {[1, 5, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={app.lock}>Lock now</Button>
          <PassphraseChange onError={setError} onMessage={setMessage} />
          <RecoveryRotate onKey={setRecoveryKey} onError={setError} />
          {recoveryKey ? <pre className="overflow-x-auto rounded-xl bg-navy p-4 font-mono text-sm text-white">{recoveryKey}</pre> : null}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Search inside code values</p>
              <p className="text-sm text-muted">Off by default. When on, codes are decrypted in memory on this device only and are never uploaded for search. Results still hide the code.</p>
            </div>
            <Switch
              checked={app.profile?.secretSearchOptIn ?? false}
              aria-label="Search inside code values"
              onCheckedChange={(checked) => void app.updateSettings({ secretSearchOptIn: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Categories</h2>
          <CategoryEditor />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Backup and restore</h2>
          <p className="text-sm text-muted">Encrypted backups contain ciphertext and wrapped keys. They do not contain readable codes.</p>
          <Button type="button" onClick={() => void app.downloadEncryptedBackup().catch((cause: Error) => setError(cause.message))}>Download encrypted backup</Button>
          <div>
            <Label htmlFor="restore-file">Restore encrypted backup</Label>
            <Input id="restore-file" type="file" accept="application/json" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const backup = parseEncryptedBackup(text);
                const plan = planRestore({ clients: app.clients, locations: app.locations, accessRecords: app.codes, categories: app.categories }, backup, app.userId ?? "");
                const conflicts = restoreConflicts(plan);
                setRestoreRaw(text);
                setRestorePreview(`${plan.clientInserts.length + plan.locationInserts.length + plan.codeInserts.length} additions, ${plan.clientUpdates.length + plan.locationUpdates.length + plan.codeUpdates.length} updates, ${conflicts.length} conflicts.`);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "The backup could not be read.");
              }
            }} />
          </div>
          {restorePreview ? <p className="text-sm">{restorePreview}</p> : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={restoreChoice === "keep-local"} onChange={() => setRestoreChoice("keep-local")} />
            Keep current cloud data when both copies changed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={restoreChoice === "use-backup"} onChange={() => setRestoreChoice("use-backup")} />
            Replace conflicts with the backup
          </label>
          <Button type="button" variant="secondary" disabled={!restoreRaw} onClick={() => {
            if (!restoreRaw) return;
            void app.restoreBackup(restoreRaw, restoreChoice).then((result) => {
              setMessage(`Restore finished. ${result.applied} changes synced. ${result.skipped} kept the current cloud copy.`);
              setRestoreRaw(null);
            }).catch((cause: Error) => setError(cause.message));
          }}>Restore</Button>
          <div className="border-t border-line pt-4">
            <p className="font-medium">Plaintext export</p>
            <p className="text-sm text-muted">This downloads readable codes. It stays off until you confirm it for this download. The file is created in the browser and is not stored on the server.</p>
            <Button type="button" variant="danger" onClick={() => setPlaintextOpen(true)}>Export readable codes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-lg font-semibold">Data retention</h2>
          {DATA_RETENTION_POLICY.split("\n").map((line) => <p key={line} className="text-sm text-muted">{line}</p>)}
          <Button type="button" variant="secondary" onClick={() => void app.pruneAudit()}>Delete audit events older than 12 months</Button>
          <ul className="space-y-1 text-sm text-muted">
            {app.auditEvents.map((event) => (
              <li key={event.id}>{event.createdAt.slice(0, 16).replace("T", " ")} · {event.action} {event.entityType ?? ""}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-lg font-semibold">Install</h2>
          <p className="text-sm text-muted">Install AccessVault on a phone or computer. On iPhone, use Share and then Add to Home Screen. The installed app still needs a connection to read codes.</p>
          {installEvent ? <Button type="button" onClick={() => void installEvent.prompt()}>Install AccessVault</Button> : <p className="text-sm text-muted">If the browser can install this app, the button appears here.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-lg font-semibold">Danger zone</h2>
          <Button type="button" variant="danger" onClick={() => setDeleteOpen("data")}>Delete vault data</Button>
          <Button type="button" variant="secondary" onClick={() => setDeleteOpen("account")}>Delete account</Button>
        </CardContent>
      </Card>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}

      <PlaintextDialog open={plaintextOpen} onClose={() => setPlaintextOpen(false)} />
      <ReauthDialog
        open={deleteOpen !== null}
        title={deleteOpen === "account" ? "Delete the account?" : "Delete all vault data?"}
        body={deleteOpen === "account" ? "This removes the sign-in and the encrypted vault. It cannot be undone." : "This removes encrypted clients and codes. Your sign-in remains."}
        onClose={() => setDeleteOpen(null)}
        onConfirm={async (password) => {
          if (deleteOpen === "account") await app.deleteAccount(password);
          else await app.deleteVaultData(password);
        }}
      />
    </div>
  );
}

function PasswordChange() {
  const app = useVault();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Use a stronger password.");
      return;
    }
    const accepted = await app.confirmPassword(current);
    if (!accepted) {
      setError("Current password was not accepted.");
      return;
    }
    await app.changePassword(next);
    setCurrent("");
    setNext("");
    setError("");
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="Current password" aria-label="Current password" />
      <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="New password" aria-label="New password" />
      {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
      <Button type="submit" variant="secondary">Change account password</Button>
    </form>
  );
}

function PassphraseChange({ onError, onMessage }: { onError: (value: string) => void; onMessage: (value: string) => void }) {
  const app = useVault();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const parsed = passwordSchema.safeParse(next);
      if (!parsed.success) {
        onError(parsed.error.issues[0]?.message ?? "Use a longer passphrase.");
        return;
      }
      void app.changeVaultPassphrase(current, next).then(() => {
        setCurrent("");
        setNext("");
        onMessage("Vault passphrase updated. The recovery key still unlocks the same codes.");
      }).catch((cause: Error) => onError(cause.message));
    }}>
      <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} placeholder="Current vault passphrase" aria-label="Current vault passphrase" />
      <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} placeholder="New vault passphrase" aria-label="New vault passphrase" />
      <Button type="submit" variant="secondary">Change vault passphrase</Button>
    </form>
  );
}

function RecoveryRotate({ onKey, onError }: { onKey: (value: string) => void; onError: (value: string) => void }) {
  const app = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      void (async () => {
        const accepted = await app.confirmPassword(password);
        if (!accepted) {
          onError("Account password was not accepted.");
          return;
        }
        const key = await app.rotateRecoveryKey(passphrase);
        setPassphrase("");
        setPassword("");
        onKey(key);
      })().catch((cause: Error) => onError(cause.message));
    }}>
      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Account password" aria-label="Account password for recovery rotation" />
      <Input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Vault passphrase" aria-label="Vault passphrase for recovery rotation" />
      <Button type="submit" variant="secondary">Rotate recovery key</Button>
    </form>
  );
}

function CategoryEditor() {
  const app = useVault();
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {app.categories.map((category) => (
          <span key={category.id} className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-sm">
            {category.name}
            {category.isDefault ? null : (
              <button type="button" className="font-semibold text-danger" onClick={() => void app.removeCategory(category)} aria-label={`Remove ${category.name}`}>
                Remove
              </button>
            )}
          </span>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        void app.addCategory(name.trim());
        setName("");
      }}>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Custom category" aria-label="Custom category" />
        <Button type="submit" variant="secondary">Add</Button>
      </form>
    </div>
  );
}

function PlaintextDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useVault();
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>Export readable codes?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          The download will contain access codes in plain text. Anyone with the file can read them. AccessVault does not encrypt this export and does not keep a server copy.
        </DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!accepted) {
            setError("Confirm that you understand the file is not encrypted.");
            return;
          }
          void app.downloadPlaintextExport(password, passphrase).then(() => {
            setPassword("");
            setPassphrase("");
            onClose();
          }).catch((cause: Error) => setError(cause.message));
        }}>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            I understand this file is not encrypted.
          </label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Account password" aria-label="Account password" />
          <Input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Vault passphrase" aria-label="Vault passphrase" />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="danger">Download plaintext export</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReauthDialog({
  open,
  title,
  body,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">{body}</DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          void onConfirm(password).then(onClose).catch((cause: Error) => setError(cause.message));
        }}>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Account password" aria-label="Confirm account password" required />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="danger">Confirm</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
