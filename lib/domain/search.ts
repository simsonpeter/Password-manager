import { effectiveAccessStatus } from "@/lib/domain/status";
import type { AccessRecord, ClientRecord, Dataset } from "@/lib/domain/types";

export type SearchSort = "name" | "updated" | "recent";
export type SearchStatus = "all" | "active" | "expired" | "archived";

export interface SearchFilters {
  query: string;
  category: string;
  clientId: string;
  locationId: string;
  status: SearchStatus;
  sort: SearchSort;
}

export interface SearchDocument {
  key: string;
  kind: "client" | "location" | "code";
  clientId: string;
  locationId: string | null;
  accessId: string | null;
  title: string;
  subtitle: string;
  category: string | null;
  status: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  clientName: string;
  haystack: string;
}

export interface SearchHit {
  key: string;
  kind: "client" | "location" | "code";
  clientId: string;
  locationId: string | null;
  accessId: string | null;
  title: string;
  subtitle: string;
  category: string | null;
  status: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  clientName: string;
}

export const EMPTY_FILTERS: SearchFilters = {
  query: "",
  category: "all",
  clientId: "all",
  locationId: "all",
  status: "all",
  sort: "name",
};

function clientHaystack(client: ClientRecord): string {
  return [client.name, client.businessName, client.contactPerson, client.phone, client.email, client.address, client.tags.join(" ")]
    .join(" ")
    .toLowerCase();
}

export function buildSearchDocuments(data: Dataset, now = new Date()): SearchDocument[] {
  const clients = new Map(data.clients.map((client) => [client.id, client]));
  const locations = new Map(data.locations.map((location) => [location.id, location]));
  const documents: SearchDocument[] = [];

  for (const client of data.clients) {
    documents.push({
      key: `client:${client.id}`,
      kind: "client",
      clientId: client.id,
      locationId: null,
      accessId: null,
      title: client.name,
      subtitle: [client.businessName, client.address].filter(Boolean).join(" · "),
      category: null,
      status: client.status,
      updatedAt: client.updatedAt,
      lastAccessedAt: client.lastAccessedAt,
      clientName: client.name,
      haystack: clientHaystack(client),
    });
  }

  for (const location of data.locations) {
    const client = clients.get(location.clientId);
    documents.push({
      key: `location:${location.id}`,
      kind: "location",
      clientId: location.clientId,
      locationId: location.id,
      accessId: null,
      title: location.name,
      subtitle: [client?.name, location.address].filter(Boolean).join(" · "),
      category: null,
      status: location.status,
      updatedAt: location.updatedAt,
      lastAccessedAt: client?.lastAccessedAt ?? null,
      clientName: client?.name ?? "Client",
      haystack: [location.name, location.address, client?.name, client?.businessName].join(" ").toLowerCase(),
    });
  }

  for (const code of data.accessRecords) {
    const client = clients.get(code.clientId);
    const location = code.locationId ? locations.get(code.locationId) : undefined;
    const status = effectiveAccessStatus(code, now);
    documents.push({
      key: `code:${code.id}`,
      kind: "code",
      clientId: code.clientId,
      locationId: code.locationId,
      accessId: code.id,
      title: code.title,
      subtitle: [client?.name, location?.name, code.category].filter(Boolean).join(" · "),
      category: code.category,
      status,
      updatedAt: code.updatedAt,
      lastAccessedAt: client?.lastAccessedAt ?? null,
      clientName: client?.name ?? "Client",
      haystack: [code.title, code.category, client?.name, client?.businessName, location?.name, location?.address]
        .join(" ")
        .toLowerCase(),
    });
  }

  return documents;
}

function matchesStatus(document: SearchDocument, status: SearchStatus): boolean {
  if (status === "all") return true;
  return document.status === status;
}

export function toSearchHit(document: SearchDocument): SearchHit {
  return {
    key: document.key,
    kind: document.kind,
    clientId: document.clientId,
    locationId: document.locationId,
    accessId: document.accessId,
    title: document.title,
    subtitle: document.subtitle,
    category: document.category,
    status: document.status,
    updatedAt: document.updatedAt,
    lastAccessedAt: document.lastAccessedAt,
    clientName: document.clientName,
  };
}

export function querySearch(
  documents: SearchDocument[],
  filters: SearchFilters,
  secretIndex?: ReadonlyMap<string, string>,
): SearchHit[] {
  const query = filters.query.trim().toLowerCase();
  const filtered = documents.filter((document) => {
    if (filters.clientId !== "all" && document.clientId !== filters.clientId) return false;
    if (filters.locationId !== "all" && document.locationId !== filters.locationId) return false;
    if (filters.category !== "all") {
      if (document.kind !== "code" || document.category !== filters.category) return false;
    }
    if (!matchesStatus(document, filters.status)) return false;
    if (!query) return true;
    if (document.haystack.includes(query)) return true;
    if (document.kind === "code" && document.accessId && secretIndex) {
      const secret = secretIndex.get(document.accessId);
      if (secret && secret.toLowerCase().includes(query)) return true;
    }
    return false;
  });

  const sorted = [...filtered].sort((left, right) => compareDocuments(left, right, filters.sort));
  return sorted.map(toSearchHit);
}

function compareDocuments(left: SearchDocument, right: SearchDocument, sort: SearchSort): number {
  if (sort === "updated") return right.updatedAt.localeCompare(left.updatedAt);
  if (sort === "recent") {
    const leftStamp = left.lastAccessedAt ?? "";
    const rightStamp = right.lastAccessedAt ?? "";
    if (leftStamp !== rightStamp) return rightStamp.localeCompare(leftStamp);
  }
  return left.clientName.localeCompare(right.clientName) || left.title.localeCompare(right.title);
}

export function sortClients<T extends { name: string; updatedAt: string; lastAccessedAt: string | null }>(
  clients: T[],
  sort: SearchSort,
): T[] {
  return [...clients].sort((left, right) => {
    if (sort === "updated") return right.updatedAt.localeCompare(left.updatedAt);
    if (sort === "recent") return (right.lastAccessedAt ?? "").localeCompare(left.lastAccessedAt ?? "");
    return left.name.localeCompare(right.name);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; pageCount: number; total: number } {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, pageCount, total };
}

export function codeMatchesFilters(
  code: AccessRecord,
  filters: Pick<SearchFilters, "category" | "locationId" | "status">,
  now = new Date(),
): boolean {
  if (filters.category !== "all" && code.category !== filters.category) return false;
  if (filters.locationId !== "all" && code.locationId !== filters.locationId) return false;
  if (filters.status !== "all" && effectiveAccessStatus(code, now) !== filters.status) return false;
  return true;
}
