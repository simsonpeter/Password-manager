"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useVault } from "@/components/providers/vault-provider";
import { computeStats, recentlyAccessed } from "@/lib/domain/stats";

export function DashboardView() {
  const app = useVault();
  const stats = computeStats({
    clients: app.clients,
    locations: app.locations,
    accessRecords: app.codes,
    categories: app.categories,
  });
  const recent = recentlyAccessed(app.clients);
  const cards = [
    { label: "Total clients", value: stats.totalClients },
    { label: "Active locations", value: stats.activeLocations },
    { label: "Access records", value: stats.totalAccessRecords },
    { label: "Expiring in 30 days", value: stats.expiringCodes },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">Find a client, reveal the gate code, and copy it. Secrets stay masked until you ask for them.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="py-5">
              <p className="text-sm font-medium text-muted">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-navy">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recently opened</h2>
          <div className="space-y-3">
            {recent.length === 0 ? <Empty text="Clients you open will show up here." /> : recent.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-card hover:border-teal">
                <p className="font-semibold">{client.name}</p>
                <p className="text-sm text-muted">{client.businessName || client.address || "No trading name"}</p>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Expiring codes</h2>
          <div className="space-y-3">
            {stats.expiring.length === 0 ? <Empty text="No codes expire in the next 30 days." /> : stats.expiring.map((item) => (
              <Link key={item.id} href={`/clients/${item.clientId}`} className="block rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted">{item.clientName}{item.locationName ? ` · ${item.locationName}` : ""} · {item.category}</p>
                <p className="mt-1 text-sm font-medium text-teal-800">Expires {item.expiresAt}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-muted">{text}</p>;
}
