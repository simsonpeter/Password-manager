import { addDays, isoDate } from "@/lib/domain/dates";
import type { AccessRecord, ClientRecord, Dataset, LocationRecord } from "@/lib/domain/types";

export interface ExpiringCodeSummary {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  locationName: string | null;
  expiresAt: string;
  category: string;
}

export interface VaultStats {
  totalClients: number;
  activeLocations: number;
  totalAccessRecords: number;
  expiringCodes: number;
  expiring: ExpiringCodeSummary[];
}

export function expiringCodes(data: Dataset, now = new Date(), withinDays = 30): ExpiringCodeSummary[] {
  const today = isoDate(now);
  const limit = isoDate(addDays(now, withinDays));
  const clients = new Map(data.clients.map((client) => [client.id, client]));
  const locations = new Map(data.locations.map((location) => [location.id, location]));
  return data.accessRecords
    .filter((record) => record.status !== "archived" && record.expiresAt && record.expiresAt >= today && record.expiresAt <= limit)
    .map((record) => ({
      id: record.id,
      title: record.title,
      clientId: record.clientId,
      clientName: clients.get(record.clientId)?.name ?? "Client",
      locationName: record.locationId ? (locations.get(record.locationId)?.name ?? null) : null,
      expiresAt: record.expiresAt ?? "",
      category: record.category,
    }))
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));
}

export function computeStats(data: Dataset, now = new Date()): VaultStats {
  const expiring = expiringCodes(data, now);
  return {
    totalClients: data.clients.length,
    activeLocations: data.locations.filter((location: LocationRecord) => location.status === "active").length,
    totalAccessRecords: data.accessRecords.length,
    expiringCodes: expiring.length,
    expiring,
  };
}

export function recentlyAccessed(clients: ClientRecord[], limit = 6): ClientRecord[] {
  return clients
    .filter((client) => client.status === "active" && client.lastAccessedAt)
    .sort((left, right) => (right.lastAccessedAt ?? "").localeCompare(left.lastAccessedAt ?? ""))
    .slice(0, limit);
}

export function assertSummaryHasNoSecrets(summary: ExpiringCodeSummary, secret: string): boolean {
  const encoded = JSON.stringify(summary);
  return !encoded.includes(secret) && !("secret" in summary);
}

export type { AccessRecord };
