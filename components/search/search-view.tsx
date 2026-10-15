"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVault } from "@/components/providers/vault-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buildSearchDocuments, EMPTY_FILTERS, querySearch, type SearchFilters, type SearchSort, type SearchStatus } from "@/lib/domain/search";

export function SearchView() {
  const app = useVault();
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [secretIndex, setSecretIndex] = useState<Map<string, string> | undefined>(undefined);
  const documents = useMemo(
    () => buildSearchDocuments({ clients: app.clients, locations: app.locations, accessRecords: app.codes, categories: app.categories }),
    [app.clients, app.locations, app.codes, app.categories],
  );
  const hits = querySearch(documents, filters, app.profile?.secretSearchOptIn ? secretIndex : undefined);

  async function onQuery(value: string) {
    setFilters((current) => ({ ...current, query: value }));
    if (app.profile?.secretSearchOptIn && value.trim()) {
      setSecretIndex(await app.secretSearchIndex());
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Search</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Search names, addresses, tags, code titles, and categories. Code values are not included unless you opt in from Settings, and even then they are matched only in memory on this device.
        </p>
      </div>
      {app.profile?.secretSearchOptIn ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Secret search is on. Matching uses decrypted codes in memory. Results still do not show the code.
        </p>
      ) : null}
      <Input value={filters.query} onChange={(event) => void onQuery(event.target.value)} placeholder="Search clients, locations, and code titles" aria-label="Search the vault" className="h-14 text-lg" />
      <div className="grid gap-3 md:grid-cols-4">
        <select className="h-11 rounded-lg border border-line bg-white px-3" aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
          <option value="all">All categories</option>
          {app.categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-line bg-white px-3" aria-label="Filter by client" value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value, locationId: "all" }))}>
          <option value="all">All clients</option>
          {app.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-line bg-white px-3" aria-label="Filter by location" value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))}>
          <option value="all">All locations</option>
          {app.locations.filter((location) => filters.clientId === "all" || location.clientId === filters.clientId).map((location) => (
            <option key={location.id} value={location.id}>{location.name}</option>
          ))}
        </select>
        <select className="h-11 rounded-lg border border-line bg-white px-3" aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as SearchStatus }))}>
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        Sort
        <select className="h-11 rounded-lg border border-line bg-white px-3" aria-label="Sort results" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as SearchSort }))}>
          <option value="name">Client name</option>
          <option value="updated">Last updated</option>
          <option value="recent">Recently opened</option>
        </select>
      </label>
      <div className="space-y-3">
        {hits.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-muted">No matches.</p> : hits.map((hit) => (
          <Link key={hit.key} href={`/clients/${hit.clientId}`} className="block rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{hit.title}</p>
              <Badge>{hit.kind}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{hit.subtitle || hit.clientName}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
