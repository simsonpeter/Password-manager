import { useCallback, useEffect, useMemo, useState } from "react";
import { Toast } from "./components/Toast";
import { KeyholeIcon } from "./components/Icons";
import { greeting } from "./lib/config";
import { seedSampleEntries } from "./lib/local";
import { createVault } from "./lib/vault";
import type { VaultAPI } from "./lib/api";
import type { Category, Draft, Entry, Session } from "./lib/types";
import { AuthScreen } from "./screens/AuthScreen";
import { DetailPane } from "./screens/DetailPane";
import { EditorSheet } from "./screens/EditorSheet";
import { SettingsSheet } from "./screens/SettingsSheet";
import { VaultPane } from "./screens/VaultPane";

const api: VaultAPI = createVault();

type Filter = "all" | "favorites" | Category;

function matches(entry: Entry, query: string, filter: Filter): boolean {
  if (filter === "favorites" && !entry.favorite) return false;
  if (filter !== "all" && filter !== "favorites" && entry.category !== filter) return false;
  if (!query.trim()) return true;
  const hay = `${entry.name} ${entry.notes} ${entry.codes.join(" ")}`.toLowerCase();
  return hay.includes(query.trim().toLowerCase());
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  const refresh = useCallback(async () => {
    const list = await api.listEntries();
    setEntries(list);
    return list;
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const current = await api.getSession();
      setSession(current);
      if (current) {
        try {
          await refresh();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Could not load vault.");
        }
      }
      unsub = api.onAuthChange(async (next) => {
        setSession(next);
        if (next) {
          try {
            const list = await refresh();
            setSelectedId((id) => id ?? list[0]?.id ?? null);
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Could not load vault.");
          }
        } else {
          setEntries([]);
          setSelectedId(null);
        }
      });
      setBooting(false);
    })();
    return () => unsub();
  }, [refresh, showToast]);

  const visible = useMemo(
    () => entries.filter((entry) => matches(entry, query, filter)),
    [entries, query, filter],
  );

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied");
      if (selectedId) {
        await api.markUsed(selectedId);
        await refresh();
      }
    } catch {
      showToast("Copy was blocked by the browser.");
    }
  }

  async function shareEntry(entry: Entry) {
    const lines = [entry.name, ""];
    entry.codes.forEach((code, i) => lines.push(`${i + 1}. ${code}`));
    if (entry.notes) lines.push("", entry.notes);
    const text = lines.join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: entry.name, text });
        await api.markUsed(entry.id);
        await refresh();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    await copyText(text);
  }

  async function toggleFavorite(entry: Entry) {
    await api.setFavorite(entry.id, !entry.favorite);
    await refresh();
  }

  async function saveDraft(draft: Draft) {
    const saved = await api.saveEntry(draft);
    const list = await refresh();
    setSelectedId(saved.id);
    setMobileDetail(true);
    setEditing(undefined);
    showToast(list.length ? "Saved" : "Saved");
  }

  async function removeEntry(entry: Entry) {
    if (!window.confirm(`Delete “${entry.name}”?`)) return;
    await api.deleteEntry(entry.id);
    const list = await refresh();
    setSelectedId(list[0]?.id ?? null);
    setMobileDetail(false);
    showToast("Deleted");
  }

  async function seed() {
    if (!session || api.kind !== "local") return;
    seedSampleEntries(session.userId);
    const list = await refresh();
    setSelectedId(list[0]?.id ?? null);
    setSettings(false);
  }

  if (booting) {
    return (
      <div className="splash">
        <KeyholeIcon />
        <p>Opening the vault…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen api={api} onToast={showToast} />
        <Toast message={toast} />
      </>
    );
  }

  return (
    <>
      <div className={`shell ${mobileDetail && selected ? "has-detail" : ""}`}>
        <VaultPane
          email={session.email}
          greeting={greeting()}
          entries={visible}
          query={query}
          filter={filter}
          selectedId={selectedId}
          onQuery={setQuery}
          onFilter={setFilter}
          onSelect={(id) => {
            setSelectedId(id);
            setMobileDetail(true);
          }}
          onFavorite={toggleFavorite}
          onCreate={() => setEditing(null)}
          onSettings={() => setSettings(true)}
          onSeed={api.kind === "local" ? () => void seed() : undefined}
        />
        <DetailPane
          entry={selected}
          onBack={() => setMobileDetail(false)}
          onEdit={() => selected && setEditing(selected)}
          onFavorite={() => selected && toggleFavorite(selected)}
          onDelete={() => selected && removeEntry(selected)}
          onCopy={copyText}
          onShare={() => selected && shareEntry(selected)}
          emptyAction={() => setEditing(null)}
        />
      </div>
      {editing !== undefined && (
        <EditorSheet
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSave={saveDraft}
        />
      )}
      {settings && (
        <SettingsSheet
          api={api}
          email={session.email}
          onClose={() => setSettings(false)}
          onToast={showToast}
          onSeed={seed}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
