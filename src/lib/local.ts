import { newId, nowIso, sha256 } from "./config";
import { SAMPLE_ENTRIES } from "./demo";
import type { VaultAPI } from "./api";
import type { Entry, Session } from "./types";
import { isCategory } from "./types";

const USERS_KEY = "keystone.local.users";
const SESSION_KEY = "keystone.local.session";

type LocalUser = { id: string; email: string; passwordHash: string };

function users(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as LocalUser[];
  } catch {
    return [];
  }
}

function saveUsers(list: LocalUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function entriesKey(userId: string): string {
  return `keystone.local.entries.${userId}`;
}

function readEntries(userId: string): Entry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(entriesKey(userId)) || "[]") as Entry[];
    return raw.map(normalizeEntry);
  } catch {
    return [];
  }
}

function writeEntries(userId: string, list: Entry[]): void {
  localStorage.setItem(entriesKey(userId), JSON.stringify(list));
}

function normalizeEntry(row: Entry): Entry {
  return {
    ...row,
    category: isCategory(row.category) ? row.category : "other",
    codes: Array.isArray(row.codes) ? row.codes : [],
    notes: row.notes || "",
    favorite: Boolean(row.favorite),
    lastUsedAt: row.lastUsedAt ?? null,
  };
}

function requireUser(): LocalUser {
  const session = readSession();
  if (!session) throw new Error("You are signed out.");
  const user = users().find((u) => u.id === session.userId);
  if (!user) throw new Error("You are signed out.");
  return user;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<(session: Session | null) => void>();

function emit(session: Session | null): void {
  listeners.forEach((cb) => cb(session));
}

export function createLocalApi(): VaultAPI {
  return {
    kind: "local",

    async getSession() {
      return readSession();
    },

    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signIn(email, password) {
      const hash = await sha256(password);
      const user = users().find(
        (u) => u.email === email.trim().toLowerCase() && u.passwordHash === hash,
      );
      if (!user) throw new Error("Email or password is incorrect.");
      const session = { userId: user.id, email: user.email };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      emit(session);
    },

    async signUp(email, password) {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) throw new Error("Enter a valid email.");
      if (password.length < 6) throw new Error("Use at least 6 characters.");
      const list = users();
      if (list.some((u) => u.email === normalized)) {
        throw new Error("That email already has a vault on this device.");
      }
      const user: LocalUser = {
        id: newId(),
        email: normalized,
        passwordHash: await sha256(password),
      };
      saveUsers([...list, user]);
      const session = { userId: user.id, email: user.email };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      emit(session);
    },

    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emit(null);
    },

    async resetPassword() {
      throw new Error(
        "On-device vaults cannot email a reset link. Sign in, or clear site data for this page.",
      );
    },

    async updatePassword(current, next) {
      if (next.length < 6) throw new Error("Use at least 6 characters.");
      const user = requireUser();
      const hash = await sha256(current);
      if (user.passwordHash !== hash) throw new Error("Current password is incorrect.");
      const nextHash = await sha256(next);
      saveUsers(users().map((u) => (u.id === user.id ? { ...u, passwordHash: nextHash } : u)));
    },

    async listEntries() {
      return readEntries(requireUser().id).sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    async saveEntry(draft) {
      const user = requireUser();
      const list = readEntries(user.id);
      const stamp = nowIso();
      if (draft.id) {
        const index = list.findIndex((e) => e.id === draft.id);
        if (index < 0) throw new Error("Entry not found.");
        const next: Entry = {
          ...list[index],
          name: draft.name.trim(),
          category: draft.category,
          codes: draft.codes.map((c) => c.trim()).filter(Boolean),
          notes: draft.notes.trim(),
          favorite: draft.favorite,
          updatedAt: stamp,
        };
        list[index] = next;
        writeEntries(user.id, list);
        return next;
      }
      const created: Entry = {
        id: newId(),
        name: draft.name.trim(),
        category: draft.category,
        codes: draft.codes.map((c) => c.trim()).filter(Boolean),
        notes: draft.notes.trim(),
        favorite: draft.favorite,
        lastUsedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      writeEntries(user.id, [...list, created]);
      return created;
    },

    async deleteEntry(id) {
      const user = requireUser();
      writeEntries(
        user.id,
        readEntries(user.id).filter((e) => e.id !== id),
      );
    },

    async setFavorite(id, favorite) {
      const user = requireUser();
      writeEntries(
        user.id,
        readEntries(user.id).map((e) =>
          e.id === id ? { ...e, favorite, updatedAt: nowIso() } : e,
        ),
      );
    },

    async markUsed(id) {
      const user = requireUser();
      const stamp = nowIso();
      writeEntries(
        user.id,
        readEntries(user.id).map((e) =>
          e.id === id ? { ...e, lastUsedAt: stamp, updatedAt: stamp } : e,
        ),
      );
    },
  };
}

export function seedSampleEntries(userId: string): void {
  if (readEntries(userId).length) return;
  const stamp = nowIso();
  writeEntries(
    userId,
    SAMPLE_ENTRIES.map((row) => ({
      ...row,
      id: newId(),
      createdAt: stamp,
      updatedAt: stamp,
    })),
  );
}
