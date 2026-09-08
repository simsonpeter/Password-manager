import { CategoryMark, PlusIcon, SearchIcon, StarIcon } from "../components/Icons";
import { CATEGORIES, type Category, type Entry } from "../lib/types";
import { formatRelative } from "../lib/config";

type Filter = "all" | "favorites" | Category;

type Props = {
  email: string;
  greeting: string;
  entries: Entry[];
  query: string;
  filter: Filter;
  selectedId: string | null;
  onQuery: (value: string) => void;
  onFilter: (value: Filter) => void;
  onSelect: (id: string) => void;
  onFavorite: (entry: Entry) => void;
  onCreate: () => void;
  onSettings: () => void;
  onSeed?: () => void;
};

export function VaultPane({
  email,
  greeting,
  entries,
  query,
  filter,
  selectedId,
  onQuery,
  onFilter,
  onSelect,
  onFavorite,
  onCreate,
  onSettings,
  onSeed,
}: Props) {
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Kept" },
    ...CATEGORIES,
  ];

  return (
    <aside className="vault-pane">
      <header className="vault-head">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1>Your vault</h1>
          <p className="muted truncate">{email}</p>
        </div>
        <button type="button" className="text-link" onClick={onSettings}>
          Settings
        </button>
      </header>

      <label className="search">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find a gate, port, door…"
          autoComplete="off"
        />
      </label>

      <div className="chips" role="tablist" aria-label="Filter">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "chip active" : "chip"}
            onClick={() => onFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="vault-list">
        {entries.length === 0 ? (
          <div className="empty-list">
            <p>Nothing here yet.</p>
            <p className="muted">Add the first code you never want to forget.</p>
            {onSeed && (
              <button type="button" className="text-link" onClick={onSeed}>
                Or load a few sample keys
              </button>
            )}
          </div>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`entry-card ${selectedId === entry.id ? "selected" : ""}`}
            >
              <button type="button" className="entry-main" onClick={() => onSelect(entry.id)}>
                <span className={`cat-orb cat-${entry.category}`}>
                  <CategoryMark category={entry.category} />
                </span>
                <span className="entry-copy">
                  <strong>{entry.name}</strong>
                  <span className="muted">
                    {entry.codes.length} {entry.codes.length === 1 ? "code" : "codes"} ·{" "}
                    {formatRelative(entry.lastUsedAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`star-btn ${entry.favorite ? "on" : ""}`}
                aria-label={entry.favorite ? "Remove from kept" : "Keep"}
                onClick={() => onFavorite(entry)}
              >
                <StarIcon filled={entry.favorite} />
              </button>
            </article>
          ))
        )}
      </div>

      <button type="button" className="fab" onClick={onCreate}>
        <PlusIcon />
        <span>New code</span>
      </button>
    </aside>
  );
}
