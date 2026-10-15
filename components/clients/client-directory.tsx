"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientFormDialog } from "@/components/clients/record-forms";
import { useVault } from "@/components/providers/vault-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paginate, sortClients, type SearchSort } from "@/lib/domain/search";

const PAGE_SIZE = 24;

export function ClientDirectory() {
  const app = useVault();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SearchSort>("name");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = app.clients.filter((client) => {
      if (!showArchived && client.status === "archived") return false;
      if (!needle) return true;
      const haystack = [client.name, client.businessName, client.address, client.tags.join(" ")].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
    return sortClients(rows, sort);
  }, [app.clients, query, showArchived, sort]);
  const paged = paginate(filtered, page, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Clients</h1>
          <p className="mt-2 text-muted">Search by name, trading name, address, or tag.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Add client</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search clients" aria-label="Search clients" />
        <select className="h-11 rounded-lg border border-line bg-white px-3" value={sort} aria-label="Sort clients" onChange={(event) => setSort(event.target.value as SearchSort)}>
          <option value="name">Name</option>
          <option value="updated">Last updated</option>
          <option value="recent">Recently opened</option>
        </select>
        <label className="flex h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="grid gap-3">
        {paged.items.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-muted">No clients match this search.</p> : paged.items.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`} className="rounded-2xl border border-line bg-white p-4 shadow-card hover:border-teal">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{client.name}</h2>
                <p className="text-sm text-muted">{[client.businessName, client.address, client.phone].filter(Boolean).join(" · ") || "No address yet"}</p>
              </div>
              <Badge className={client.status === "archived" ? "bg-canvas text-muted" : undefined}>{client.status}</Badge>
            </div>
            {client.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {client.tags.map((tag) => <Badge key={tag} className="bg-canvas text-muted">{tag}</Badge>)}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted">{paged.total} clients</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={paged.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <Button type="button" variant="secondary" disabled={paged.page >= paged.pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>
      {open ? (
        <ClientFormDialog
          open={open}
          clients={app.clients}
          onClose={() => setOpen(false)}
          onSave={async (input, requestId) => {
            await app.saveClient(input, requestId);
          }}
        />
      ) : null}
    </div>
  );
}
