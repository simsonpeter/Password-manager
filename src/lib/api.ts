import type { Draft, Entry, Session } from "./types";

export type VaultAPI = {
  kind: "cloud" | "local";
  getSession(): Promise<Session | null>;
  onAuthChange(cb: (session: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(current: string, next: string): Promise<void>;
  listEntries(): Promise<Entry[]>;
  saveEntry(draft: Draft): Promise<Entry>;
  deleteEntry(id: string): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  markUsed(id: string): Promise<void>;
};
