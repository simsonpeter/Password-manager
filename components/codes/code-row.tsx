"use client";

import { Copy, Eye, EyeOff, Pencil, Archive, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { effectiveAccessStatus } from "@/lib/domain/status";
import type { AccessRecord } from "@/lib/domain/types";

export function SecretValue({ value, revealed }: { value: string | null; revealed: boolean }) {
  if (!revealed || value === null) {
    return (
      <span className="secret-text text-base text-ink" aria-label="Hidden code">
        ••••••••
      </span>
    );
  }
  return <span className="secret-text break-all text-base text-ink">{value}</span>;
}

export function CodeRow({
  code,
  locationName,
  revealedValue,
  onReveal,
  onHide,
  onCopy,
  onEdit,
  onArchive,
  onDelete,
}: {
  code: AccessRecord;
  locationName: string | null;
  revealedValue: string | null;
  onReveal: () => void;
  onHide: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const status = effectiveAccessStatus(code);
  const revealed = revealedValue !== null;
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{code.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{code.category}</Badge>
            <Badge className="bg-canvas text-muted">{status}</Badge>
            {locationName ? <Badge className="bg-canvas text-muted">{locationName}</Badge> : null}
            {code.expiresAt ? <Badge className="bg-canvas text-muted">Expires {code.expiresAt}</Badge> : null}
          </div>
        </div>
        <SecretValue value={revealedValue} revealed={revealed} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {revealed ? (
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold" onClick={onHide}>
            <EyeOff className="h-4 w-4" /> Hide
          </button>
        ) : (
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold" onClick={onReveal}>
            <Eye className="h-4 w-4" /> Reveal
          </button>
        )}
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy px-3 text-sm font-semibold text-white" onClick={onCopy}>
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line" aria-label="Edit code" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line" aria-label={code.status === "archived" ? "Restore code" : "Archive code"} onClick={onArchive}>
          <Archive className="h-4 w-4" />
        </button>
        <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-200 text-danger" aria-label="Delete code" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
