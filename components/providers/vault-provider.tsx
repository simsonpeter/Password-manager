"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { applyRestore, buildEncryptedBackup, buildPlaintextExport, checkVaultMatch, parseEncryptedBackup } from "@/lib/backup/backup";
import { downloadJson } from "@/lib/backup/download";
import { decryptString } from "@/lib/crypto/aesgcm";
import { AAD_SECRET } from "@/lib/crypto/vault-crypto";
import { createVaultMaterial, rewrapWithPassphrase, rotateRecoveryWrap, unlockWithPassphrase, unlockWithRecoveryKey } from "@/lib/crypto/vault-crypto";
import type { AuditEvent, CategoryRecord, ClientInput, ClientRecord, CodeInput, LocationInput, LocationRecord, Profile, RecordStatus, VaultRecord } from "@/lib/domain/types";
import { reauthenticate, registerWithEmail, requestPasswordReset, signInWithEmail, updateAccountPassword, type AuthResult } from "@/lib/auth/service";
import { isSessionExpired } from "@/lib/auth/session";
import { copyText } from "@/lib/security/clipboard";
import { loginRateLimiter } from "@/lib/security/rate-limit";
import { commitWithRetry, isRetryableError } from "@/lib/sync/retry";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import { BackupError, NotConfiguredError, SessionExpiredError, SyncConflictError, VaultLockedError } from "@/lib/errors";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  addCustomCategory,
  createAccessCode,
  createClientRecord,
  createLocationRecord,
  ensureDefaultCategories,
  removeAccessCode,
  removeClient,
  removeLocation,
  revealAccessSecret,
  setAccessStatus,
  setClientStatus,
  setLocationStatus,
  updateAccessCode,
  updateClientRecord,
  updateLocationRecord,
} from "@/lib/vault/operations";
import { createInactivityLock, VaultSession } from "@/lib/vault/session";
import { newId, nowIso } from "@/lib/utils";

export type SyncStatus =
  | { kind: "idle" | "syncing" | "offline" }
  | { kind: "saved"; at: string }
  | { kind: "error" | "conflict"; message: string };

interface VaultContextValue {
  configured: boolean;
  loading: boolean;
  email: string | null;
  userId: string | null;
  profile: Profile | null;
  vault: VaultRecord | null;
  unlocked: boolean;
  clients: ClientRecord[];
  locations: LocationRecord[];
  codes: import("@/lib/domain/types").AccessRecord[];
  categories: CategoryRecord[];
  auditEvents: AuditEvent[];
  sync: SyncStatus;
  offline: boolean;
  revealed: Readonly<Record<string, string>>;
  recoveryKeyPending: string | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  changePassword: (password: string) => Promise<void>;
  confirmPassword: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setupVault: (passphrase: string) => Promise<void>;
  acknowledgeRecovery: () => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  unlockRecovery: (recoveryKey: string) => Promise<void>;
  lock: () => void;
  changeVaultPassphrase: (current: string, next: string) => Promise<void>;
  rotateRecoveryKey: (passphrase: string) => Promise<string>;
  reveal: (accessId: string) => Promise<void>;
  hide: (accessId: string) => void;
  copyCode: (accessId: string) => Promise<void>;
  saveClient: (input: ClientInput, requestId: string, existing?: ClientRecord) => Promise<ClientRecord>;
  archiveClient: (client: ClientRecord, status: RecordStatus) => Promise<void>;
  deleteClient: (client: ClientRecord) => Promise<void>;
  touchClient: (client: ClientRecord) => Promise<void>;
  saveLocation: (input: LocationInput, requestId: string, existing?: LocationRecord) => Promise<void>;
  archiveLocation: (location: LocationRecord, status: RecordStatus) => Promise<void>;
  deleteLocation: (location: LocationRecord) => Promise<void>;
  saveCode: (input: CodeInput, requestId: string, existing?: import("@/lib/domain/types").AccessRecord) => Promise<void>;
  archiveCode: (code: import("@/lib/domain/types").AccessRecord, status: RecordStatus) => Promise<void>;
  deleteCode: (code: import("@/lib/domain/types").AccessRecord) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  removeCategory: (category: CategoryRecord) => Promise<void>;
  updateSettings: (patch: Partial<Pick<Profile, "displayName" | "inactivityLockMinutes" | "secretSearchOptIn">>) => Promise<void>;
  downloadEncryptedBackup: () => Promise<void>;
  restoreBackup: (raw: string, choice: "keep-local" | "use-backup") => Promise<{ applied: number; skipped: number }>;
  downloadPlaintextExport: (password: string, passphrase: string) => Promise<void>;
  deleteVaultData: (password: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  loadAudit: () => Promise<void>;
  pruneAudit: () => Promise<void>;
  secretSearchIndex: () => Promise<Map<string, string> | undefined>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used inside VaultProvider.");
  return value;
}

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const supabase = useMemo(() => {
    try {
      return createBrowserSupabase();
    } catch {
      return null;
    }
  }, []);
  const repo = useMemo(() => (supabase ? new SupabaseRepository(supabase) : null), [supabase]);
  const sessionRef = useRef(new VaultSession());
  const secretIndexRef = useRef<Map<string, string> | null>(null);
  const secretStampRef = useRef("");
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vault, setVault] = useState<VaultRecord | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [codes, setCodes] = useState<import("@/lib/domain/types").AccessRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncStatus>({ kind: "idle" });
  const [offline, setOffline] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [recoveryKeyPending, setRecoveryKeyPending] = useState<string | null>(null);

  const lock = useCallback(() => {
    sessionRef.current.lock();
    secretIndexRef.current = null;
    secretStampRef.current = "";
    setUnlocked(false);
    setRevealed({});
  }, []);

  const ctx = useCallback(() => {
    if (!repo || !userId) throw new NotConfiguredError();
    return { userId, repo, key: sessionRef.current.getKey() };
  }, [repo, userId]);

  const markFailure = useCallback((error: unknown) => {
    if (error instanceof SyncConflictError) {
      setSync({ kind: "conflict", message: "A newer cloud copy exists. Nothing was overwritten." });
      return;
    }
    if (error instanceof SessionExpiredError) {
      setSync({ kind: "error", message: "Your session expired." });
      return;
    }
    setSync({ kind: "error", message: "Not synced. The server did not confirm this change." });
  }, []);

  const refresh = useCallback(async () => {
    if (!repo || !userId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setSync({ kind: "offline" });
      return;
    }
    setSync({ kind: "syncing" });
    try {
      let profileRow = await repo.getProfile(userId);
      if (!profileRow) {
        profileRow = await repo.upsertProfile({
          id: userId,
          displayName: "",
          inactivityLockMinutes: 5,
          secretSearchOptIn: false,
          recoveryAcknowledged: false,
          version: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
      const vaultRow = await repo.getVault(userId);
      const [clientRows, locationRows, codeRows, categoryRows] = await Promise.all([
        repo.listClients(userId),
        repo.listLocations(userId),
        repo.listAccessRecords(userId),
        repo.listCategories(userId),
      ]);
      const nextCategories = vaultRow
        ? await ensureDefaultCategories({ userId, repo, key: sessionRef.current.getKey() }, categoryRows)
        : categoryRows;
      setProfile(profileRow);
      setVault(vaultRow);
      setClients(clientRows);
      setLocations(locationRows);
      setCodes(codeRows);
      setCategories(nextCategories);
      setSync({ kind: "saved", at: nowIso() });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        lock();
        await supabase?.auth.signOut();
        routerRef.current.replace("/login?reason=session");
        return;
      }
      markFailure(error);
    }
  }, [repo, userId, supabase, lock, markFailure]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (!session) {
        lock();
        setProfile(null);
        setVault(null);
        setClients([]);
        setLocations([]);
        setCodes([]);
        setCategories([]);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, lock]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  useEffect(() => {
    const control = createInactivityLock({
      getMinutes: () => profile?.inactivityLockMinutes ?? 5,
      isActive: () => sessionRef.current.isUnlocked(),
      onLock: () => {
        lock();
        toast.message("Vault locked after inactivity.");
      },
    });
    const signal = () => control.signalActivity();
    window.addEventListener("pointerdown", signal);
    window.addEventListener("keydown", signal);
    control.arm();
    return () => {
      control.stop();
      window.removeEventListener("pointerdown", signal);
      window.removeEventListener("keydown", signal);
    };
  }, [profile?.inactivityLockMinutes, unlocked, lock]);

  useEffect(() => {
    const onStatus = () => setOffline(!navigator.onLine);
    onStatus();
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    return () => {
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const check = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session || isSessionExpired(data.session.expires_at)) {
          lock();
          void supabase.auth.signOut();
          if (userId) router.replace("/login?reason=session");
        }
      });
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [supabase, lock, router, userId]);

  const value = useMemo<VaultContextValue>(() => {
    const requireOnline = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        setSync({ kind: "offline" });
        throw new Error("You are offline. This change was not sent.");
      }
    };

    return {
      configured: Boolean(supabase && repo),
      loading,
      email,
      userId,
      profile,
      vault,
      unlocked,
      clients,
      locations,
      codes,
      categories,
      auditEvents,
      sync,
      offline,
      revealed,
      recoveryKeyPending,
      refresh,
      async signIn(nextEmail, password) {
        if (!supabase) return { ok: false, status: "error", message: "Add the Supabase environment variables before signing in." };
        const limit = loginRateLimiter.attempt(nextEmail.toLowerCase());
        if (!limit.allowed) return { ok: false, status: "rate_limited", message: "Too many attempts. Wait a minute and try again." };
        const result = await signInWithEmail(supabase, nextEmail, password);
        if (result.ok) {
          loginRateLimiter.reset(nextEmail.toLowerCase());
          const signedInUser = (await supabase.auth.getUser()).data.user;
          if (signedInUser && repo) {
            void repo.addAudit({
              id: newId(),
              userId: signedInUser.id,
              action: "login",
              entityType: null,
              entityId: null,
              metadata: {},
              createdAt: nowIso(),
            }).catch(() => undefined);
          }
        }
        return result;
      },
      async signUp(nextEmail, password) {
        if (!supabase) return { ok: false, status: "error", message: "Add the Supabase environment variables before creating an account." };
        return registerWithEmail(supabase, nextEmail, password, `${appOrigin()}/auth/callback`);
      },
      async sendPasswordReset(nextEmail) {
        if (!supabase) return { ok: false, status: "error", message: "Supabase is not configured." };
        return requestPasswordReset(supabase, nextEmail, `${appOrigin()}/reset-password`);
      },
      async changePassword(password) {
        if (!supabase) throw new NotConfiguredError();
        await updateAccountPassword(supabase, password);
      },
      async confirmPassword(password) {
        if (!supabase || !email) return false;
        return reauthenticate(supabase, email, password);
      },
      async signOut() {
        lock();
        await repo?.addAudit({
          id: newId(),
          userId: userId ?? "",
          action: "logout",
          entityType: null,
          entityId: null,
          metadata: {},
          createdAt: nowIso(),
        }).catch(() => undefined);
        await supabase?.auth.signOut();
        router.replace("/login");
      },
      async setupVault(passphrase) {
        requireOnline();
        const current = ctx();
        setSync({ kind: "syncing" });
        const material = await createVaultMaterial(passphrase);
        const timestamp = nowIso();
        const saved = await current.repo.createVault({
          id: newId(),
          userId: current.userId,
          ...material.fields,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        sessionRef.current.unlock(material.dek);
        setVault(saved);
        setUnlocked(true);
        setRecoveryKeyPending(material.recoveryKey);
        const seeded = await ensureDefaultCategories({ ...current, key: material.dek }, categories);
        setCategories(seeded);
        setSync({ kind: "saved", at: nowIso() });
      },
      async acknowledgeRecovery() {
        if (!profile || !repo) return;
        const saved = await repo.updateProfile({ ...profile, recoveryAcknowledged: true }, profile.version);
        setProfile(saved);
        setRecoveryKeyPending(null);
      },
      async unlock(passphrase) {
        if (!vault || !repo || !userId) throw new NotConfiguredError();
        const key = await unlockWithPassphrase(vault, passphrase);
        sessionRef.current.unlock(key);
        setUnlocked(true);
        await repo.addAudit({ id: newId(), userId, action: "unlock", entityType: "vault", entityId: vault.id, metadata: {}, createdAt: nowIso() });
      },
      async unlockRecovery(recoveryKey) {
        if (!vault || !repo || !userId) throw new NotConfiguredError();
        const key = await unlockWithRecoveryKey(vault, recoveryKey);
        sessionRef.current.unlock(key);
        setUnlocked(true);
        await repo.addAudit({ id: newId(), userId, action: "unlock", entityType: "vault", entityId: vault.id, metadata: {}, createdAt: nowIso() });
      },
      lock() {
        lock();
        toast.message("Vault locked.");
      },
      async changeVaultPassphrase(currentPassphrase, nextPassphrase) {
        if (!vault || !repo) throw new NotConfiguredError();
        requireOnline();
        const fields = await rewrapWithPassphrase(vault, currentPassphrase, nextPassphrase);
        const saved = await repo.updateVault({ ...vault, ...fields }, vault.version);
        setVault(saved);
        setSync({ kind: "saved", at: nowIso() });
      },
      async rotateRecoveryKey(passphrase) {
        if (!vault || !repo) throw new NotConfiguredError();
        requireOnline();
        const rotated = await rotateRecoveryWrap(vault, passphrase);
        const saved = await repo.updateVault(
          {
            ...vault,
            recoveryWrappedDek: rotated.recoveryWrappedDek,
            recoveryWrappedDekNonce: rotated.recoveryWrappedDekNonce,
          },
          vault.version,
        );
        setVault(saved);
        if (profile) {
          const nextProfile = await repo.updateProfile({ ...profile, recoveryAcknowledged: false }, profile.version);
          setProfile(nextProfile);
        }
        setSync({ kind: "saved", at: nowIso() });
        return rotated.recoveryKey;
      },
      async reveal(accessId) {
        const record = codes.find((item) => item.id === accessId);
        if (!record) return;
        const secret = await revealAccessSecret(ctx(), record);
        sessionRef.current.cacheSecret(accessId, secret);
        setRevealed((current) => ({ ...current, [accessId]: secret }));
      },
      hide(accessId) {
        sessionRef.current.forgetSecret(accessId);
        setRevealed((current) => {
          const next = { ...current };
          delete next[accessId];
          return next;
        });
      },
      async copyCode(accessId) {
        const record = codes.find((item) => item.id === accessId);
        const key = sessionRef.current.getKey();
        if (!record || !key || !repo || !userId) throw new VaultLockedError();
        const secret = await decryptString(key, { ciphertext: record.secretCiphertext, nonce: record.secretNonce }, AAD_SECRET);
        await copyText(secret, navigator.clipboard);
        await repo.addAudit({ id: newId(), userId, action: "copy", entityType: "access_record", entityId: record.id, metadata: {}, createdAt: nowIso() });
        toast.success("Copied. AccessVault will try to clear the clipboard. Some devices do not allow that.");
      },
      async saveClient(input, requestId, existing) {
        requireOnline();
        setSync({ kind: "syncing" });
        try {
          const saved = await commitWithRetry(() =>
            existing ? updateClientRecord(ctx(), existing, input) : createClientRecord(ctx(), input, requestId),
          );
          setClients((current) => {
            const index = current.findIndex((item) => item.id === saved.id);
            if (index < 0) return [...current, saved];
            const next = [...current];
            next[index] = saved;
            return next;
          });
          setSync({ kind: "saved", at: nowIso() });
          return saved;
        } catch (error) {
          markFailure(error);
          if (isRetryableError(error)) throw new Error("Not synced. Try again when you are online.");
          throw error;
        }
      },
      async archiveClient(client, status) {
        requireOnline();
        const saved = await setClientStatus(ctx(), client, status);
        setClients((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setSync({ kind: "saved", at: nowIso() });
      },
      async deleteClient(client) {
        requireOnline();
        await removeClient(ctx(), client);
        setClients((current) => current.filter((item) => item.id !== client.id));
        setLocations((current) => current.filter((item) => item.clientId !== client.id));
        setCodes((current) => current.filter((item) => item.clientId !== client.id));
        setSync({ kind: "saved", at: nowIso() });
      },
      async touchClient(client) {
        if (!repo || !userId) return;
        const at = nowIso();
        try {
          await repo.touchClient(userId, client.id, at);
          setClients((current) => current.map((item) => (item.id === client.id ? { ...item, lastAccessedAt: at } : item)));
        } catch {
          // Opening a client should not block the page when the timestamp write fails.
        }
      },
      async saveLocation(input, requestId, existing) {
        requireOnline();
        setSync({ kind: "syncing" });
        try {
          const saved = await commitWithRetry(() =>
            existing ? updateLocationRecord(ctx(), existing, input) : createLocationRecord(ctx(), input, requestId),
          );
          setLocations((current) => {
            const index = current.findIndex((item) => item.id === saved.id);
            if (index < 0) return [...current, saved];
            const next = [...current];
            next[index] = saved;
            return next;
          });
          setSync({ kind: "saved", at: nowIso() });
        } catch (error) {
          markFailure(error);
          throw error;
        }
      },
      async archiveLocation(location, status) {
        requireOnline();
        const saved = await setLocationStatus(ctx(), location, status);
        setLocations((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setSync({ kind: "saved", at: nowIso() });
      },
      async deleteLocation(location) {
        requireOnline();
        await removeLocation(ctx(), location);
        setLocations((current) => current.filter((item) => item.id !== location.id));
        setCodes((current) => current.map((item) => (item.locationId === location.id ? { ...item, locationId: null } : item)));
        setSync({ kind: "saved", at: nowIso() });
      },
      async saveCode(input, requestId, existing) {
        requireOnline();
        setSync({ kind: "syncing" });
        try {
          const saved = await commitWithRetry(() =>
            existing ? updateAccessCode(ctx(), existing, input) : createAccessCode(ctx(), input, requestId),
          );
          setCodes((current) => {
            const index = current.findIndex((item) => item.id === saved.id);
            if (index < 0) return [...current, saved];
            const next = [...current];
            next[index] = saved;
            return next;
          });
          if (input.secret !== undefined) {
            sessionRef.current.forgetSecret(saved.id);
            setRevealed((current) => {
              const next = { ...current };
              delete next[saved.id];
              return next;
            });
          }
          setSync({ kind: "saved", at: nowIso() });
        } catch (error) {
          markFailure(error);
          throw error;
        }
      },
      async archiveCode(code, status) {
        requireOnline();
        const saved = await setAccessStatus(ctx(), code, status);
        setCodes((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setSync({ kind: "saved", at: nowIso() });
      },
      async deleteCode(code) {
        requireOnline();
        await removeAccessCode(ctx(), code);
        sessionRef.current.forgetSecret(code.id);
        setCodes((current) => current.filter((item) => item.id !== code.id));
        setSync({ kind: "saved", at: nowIso() });
      },
      async addCategory(name) {
        requireOnline();
        const saved = await addCustomCategory(ctx(), name);
        setCategories((current) => (current.some((item) => item.id === saved.id) ? current : [...current, saved]));
        setSync({ kind: "saved", at: nowIso() });
      },
      async removeCategory(category) {
        requireOnline();
        if (!repo || !userId) return;
        await repo.deleteCategory(userId, category.id);
        setCategories((current) => current.filter((item) => item.id !== category.id));
        setSync({ kind: "saved", at: nowIso() });
      },
      async updateSettings(patch) {
        if (!profile || !repo) throw new NotConfiguredError();
        requireOnline();
        const saved = await repo.updateProfile({ ...profile, ...patch }, profile.version);
        setProfile(saved);
        setSync({ kind: "saved", at: nowIso() });
      },
      async downloadEncryptedBackup() {
        if (!vault) throw new NotConfiguredError();
        const file = buildEncryptedBackup(vault, { clients, locations, accessRecords: codes, categories });
        downloadJson(`accessvault-backup-${new Date().toISOString().slice(0, 10)}.json`, file);
        if (repo && userId) {
          await repo.addAudit({ id: newId(), userId, action: "encrypted_backup", entityType: "vault", entityId: vault.id, metadata: {}, createdAt: nowIso() });
        }
        setSync({ kind: "saved", at: nowIso() });
      },
      async restoreBackup(raw, choice) {
        if (!repo || !userId) throw new NotConfiguredError();
        requireOnline();
        const backup = parseEncryptedBackup(raw);
        const mismatch = checkVaultMatch(vault, backup);
        if (mismatch) throw new BackupError(mismatch);
        let currentVault = vault;
        if (!currentVault) {
          currentVault = await repo.createVault({ ...backup.vault, userId, version: 1, createdAt: nowIso(), updatedAt: nowIso() });
          setVault(currentVault);
        }
        setSync({ kind: "syncing" });
        const result = await applyRestore(repo, userId, currentVault, { clients, locations, accessRecords: codes, categories }, backup, choice);
        await repo.addAudit({ id: newId(), userId, action: "backup_restore", entityType: "vault", entityId: currentVault.id, metadata: { applied: result.applied }, createdAt: nowIso() });
        await refresh();
        return result;
      },
      async downloadPlaintextExport(password, passphrase) {
        if (!supabase || !email || !vault) throw new NotConfiguredError();
        const accepted = await reauthenticate(supabase, email, password);
        if (!accepted) throw new Error("Account password was not accepted.");
        await unlockWithPassphrase(vault, passphrase);
        const key = sessionRef.current.getKey();
        if (!key) throw new VaultLockedError();
        const file = await buildPlaintextExport({ clients, locations, accessRecords: codes, categories }, key, true);
        downloadJson(`accessvault-plaintext-${new Date().toISOString().slice(0, 10)}.json`, file);
        if (repo && userId) {
          await repo.addAudit({ id: newId(), userId, action: "plaintext_export", entityType: "vault", entityId: vault.id, metadata: {}, createdAt: nowIso() });
        }
      },
      async deleteVaultData(password) {
        if (!supabase || !email || !repo || !userId) throw new NotConfiguredError();
        const accepted = await reauthenticate(supabase, email, password);
        if (!accepted) throw new Error("Account password was not accepted.");
        await repo.deleteAllData(userId);
        lock();
        setVault(null);
        setClients([]);
        setLocations([]);
        setCodes([]);
        setCategories([]);
        setSync({ kind: "saved", at: nowIso() });
      },
      async deleteAccount(password) {
        if (!supabase || !email || !repo) throw new NotConfiguredError();
        const accepted = await reauthenticate(supabase, email, password);
        if (!accepted) throw new Error("Account password was not accepted.");
        await repo.deleteAccount();
        lock();
        await supabase.auth.signOut();
        router.replace("/");
      },
      async loadAudit() {
        if (!repo || !userId) return;
        setAuditEvents(await repo.listAudit(userId, 50));
      },
      async pruneAudit() {
        if (!repo || !userId) return;
        const cutoff = new Date();
        cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
        await repo.pruneAudit(userId, cutoff.toISOString());
        setAuditEvents(await repo.listAudit(userId, 50));
        setSync({ kind: "saved", at: nowIso() });
      },
      async secretSearchIndex() {
        if (!profile?.secretSearchOptIn) return undefined;
        const key = sessionRef.current.getKey();
        if (!key) return undefined;
        const stamp = codes.map((code) => `${code.id}:${code.secretNonce}`).join("|");
        if (secretIndexRef.current && secretStampRef.current === stamp) return secretIndexRef.current;
        const map = new Map<string, string>();
        for (const code of codes) {
          map.set(code.id, await decryptString(key, { ciphertext: code.secretCiphertext, nonce: code.secretNonce }, AAD_SECRET));
        }
        secretIndexRef.current = map;
        secretStampRef.current = stamp;
        return map;
      },
    };
  }, [
    supabase,
    repo,
    loading,
    email,
    userId,
    profile,
    vault,
    unlocked,
    clients,
    locations,
    codes,
    categories,
    auditEvents,
    sync,
    offline,
    revealed,
    recoveryKeyPending,
    refresh,
    lock,
    ctx,
    markFailure,
    router,
  ]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
