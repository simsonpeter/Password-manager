import { useEffect, useState } from "react";
import {
  BackIcon,
  CategoryMark,
  CopyIcon,
  EyeIcon,
  ShareIcon,
  StarIcon,
  TrashIcon,
} from "../components/Icons";
import type { Entry } from "../lib/types";
import { CATEGORIES } from "../lib/types";
import { formatRelative } from "../lib/config";

type Props = {
  entry: Entry | null;
  onBack: () => void;
  onEdit: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onCopy: (code: string) => void;
  onShare: () => void;
  emptyAction?: () => void;
};

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function DetailPane({
  entry,
  onBack,
  onEdit,
  onFavorite,
  onDelete,
  onCopy,
  onShare,
  emptyAction,
}: Props) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setRevealed({});
  }, [entry?.id]);

  if (!entry) {
    return (
      <main className="detail-pane empty-detail">
        <div className="empty-hero">
          <span className="cat-orb cat-gate large">
            <CategoryMark category="gate" />
          </span>
          <h2>Select a key</h2>
          <p>Open a saved gate from the list, or add a new one to the vault.</p>
          {emptyAction && (
            <button type="button" className="btn-brass" onClick={emptyAction}>
              Add a code
            </button>
          )}
        </div>
      </main>
    );
  }

  const category = CATEGORIES.find((c) => c.id === entry.category)?.label ?? "Other";

  return (
    <main className="detail-pane">
      <header className="detail-head">
        <button type="button" className="icon-btn mobile-only" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <div className="detail-title">
          <p className="eyebrow">
            {category} · {formatRelative(entry.lastUsedAt)}
          </p>
          <h2>{entry.name}</h2>
        </div>
        <button
          type="button"
          className={`star-btn ${entry.favorite ? "on" : ""}`}
          aria-label={entry.favorite ? "Remove from kept" : "Keep"}
          onClick={onFavorite}
        >
          <StarIcon filled={entry.favorite} />
        </button>
      </header>

      {entry.notes && <p className="detail-notes">{entry.notes}</p>}

      <div className="code-stack">
        {entry.codes.length === 0 && <p className="muted">No codes on this key yet.</p>}
        {entry.codes.map((code, index) => {
          const open = revealed[index];
          return (
            <button
              type="button"
              key={`${entry.id}-${index}`}
              className={`code-plate ${open ? "open" : ""}`}
              onClick={() => setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))}
            >
              <span className="plate-meta">
                {ordinal(index + 1)} code
                <EyeIcon />
              </span>
              <span className="plate-value">{open ? code : "••••"}</span>
            </button>
          );
        })}
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => entry.codes[0] && onCopy(entry.codes[0])}
          disabled={!entry.codes[0]}
        >
          <CopyIcon /> Copy first
        </button>
        <button type="button" className="btn-ghost" onClick={onShare}>
          <ShareIcon /> Share
        </button>
        <button type="button" className="btn-brass" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn-danger-text" onClick={onDelete}>
          <TrashIcon /> Delete
        </button>
      </div>
    </main>
  );
}
