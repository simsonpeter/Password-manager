import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VaultAPI } from "./api";
import type { CloudConfig, Draft, Entry, Session } from "./types";
import { isCategory } from "./types";

type Row = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  codes: string[] | null;
  notes: string | null;
  favorite: boolean | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Row): Entry {
  return {
    id: row.id,
    name: row.name,
    category: isCategory(row.category) ? row.category : "other",
    codes: row.codes ?? [],
    notes: row.notes ?? "",
    favorite: Boolean(row.favorite),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionFrom(user: { id: string; email?: string | null } | null): Session | null {
  if (!user?.email) return null;
  return { userId: user.id, email: user.email };
}

export function createCloudApi(config: CloudConfig): VaultAPI {
  const client: SupabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  async function requireUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error("You are signed out.");
    return data.user.id;
  }

  return {
    kind: "cloud",

    async getSession() {
      const { data } = await client.auth.getSession();
      return sessionFrom(data.session?.user ?? null);
    },

    onAuthChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        cb(sessionFrom(session?.user ?? null));
      });
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(error.message);
    },

    async signUp(email, password) {
      if (password.length < 6) throw new Error("Use at least 6 characters.");
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error("Check your email to confirm the account, then sign in.");
      }
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },

    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw new Error(error.message);
    },

    async updatePassword(current, next) {
      if (next.length < 6) throw new Error("Use at least 6 characters.");
      const { data } = await client.auth.getSession();
      const email = data.session?.user.email;
      if (!email) throw new Error("You are signed out.");
      const challenge = await client.auth.signInWithPassword({ email, password: current });
      if (challenge.error) throw new Error("Current password is incorrect.");
      const { error } = await client.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
    },

    async listEntries() {
      const { data, error } = await client
        .from("entries")
        .select("*")
        .order("favorite", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data as Row[]).map(mapRow);
    },

    async saveEntry(draft: Draft) {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        name: draft.name.trim(),
        category: draft.category,
        codes: draft.codes.map((c) => c.trim()).filter(Boolean),
        notes: draft.notes.trim(),
        favorite: draft.favorite,
      };
      if (draft.id) {
        const { data, error } = await client
          .from("entries")
          .update(payload)
          .eq("id", draft.id)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return mapRow(data as Row);
      }
      const { data, error } = await client.from("entries").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return mapRow(data as Row);
    },

    async deleteEntry(id) {
      const { error } = await client.from("entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setFavorite(id, favorite) {
      const { error } = await client.from("entries").update({ favorite }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async markUsed(id) {
      const { error } = await client
        .from("entries")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
