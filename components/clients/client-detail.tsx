"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CodeRow } from "@/components/codes/code-row";
import { ClientFormDialog, CodeFormDialog, LocationFormDialog } from "@/components/clients/record-forms";
import { useVault } from "@/components/providers/vault-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AccessRecord, LocationRecord } from "@/lib/domain/types";

export function ClientDetail({ clientId }: { clientId: string }) {
  const app = useVault();
  const client = app.clients.find((item) => item.id === clientId);
  const locations = app.locations.filter((item) => item.clientId === clientId);
  const codes = app.codes.filter((item) => item.clientId === clientId);
  const [editClient, setEditClient] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationRecord | "new" | null>(null);
  const [codeForm, setCodeForm] = useState<AccessRecord | "new" | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: () => Promise<void> }>(null);

  useEffect(() => {
    if (!client) return;
    void app.touchClient(client);
    // Touch once per open. The client object changes after the timestamp write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!client) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-navy">Client not found</h1>
        <Link className="font-semibold text-teal-800" href="/clients">Back to clients</Link>
      </div>
    );
  }

  const categories = app.categories.map((category) => category.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/clients" className="text-sm font-semibold text-teal-800">All clients</Link>
          <h1 className="mt-2 text-3xl font-semibold text-navy">{client.name}</h1>
          <p className="mt-2 text-muted">{[client.businessName, client.contactPerson, client.phone, client.email, client.address].filter(Boolean).join(" · ") || "No contact details yet"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditClient(true)}>Edit</Button>
          <Button type="button" variant="secondary" onClick={() => void app.archiveClient(client, client.status === "archived" ? "active" : "archived")}>
            {client.status === "archived" ? "Restore" : "Archive"}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirm({
              title: `Delete ${client.name}?`,
              body: "This permanently removes the client, locations, and encrypted codes. This cannot be undone.",
              action: async () => {
                await app.deleteClient(client);
              },
            })}
          >
            Delete
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setLocationForm("new")}>Add location</Button>
        <Button type="button" variant="secondary" onClick={() => setCodeForm("new")}>Add code</Button>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Locations</h2>
        {locations.length === 0 ? <p className="text-sm text-muted">No locations yet. Codes can still be saved against the client.</p> : locations.map((location) => (
          <div key={location.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div>
              <p className="font-semibold">{location.name}</p>
              <p className="text-sm text-muted">{location.address || location.status}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setLocationForm(location)}>Edit</Button>
              <Button type="button" variant="secondary" onClick={() => void app.archiveLocation(location, location.status === "archived" ? "active" : "archived")}>
                {location.status === "archived" ? "Restore" : "Archive"}
              </Button>
              <Button type="button" variant="danger" onClick={() => setConfirm({
                title: `Delete ${location.name}?`,
                body: "Codes at this location stay on the client, without a location.",
                action: () => app.deleteLocation(location),
              })}>Delete</Button>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Access codes</h2>
        {codes.length === 0 ? <p className="text-sm text-muted">No codes yet.</p> : codes.map((code) => (
          <CodeRow
            key={code.id}
            code={code}
            locationName={locations.find((location) => location.id === code.locationId)?.name ?? null}
            revealedValue={app.revealed[code.id] ?? null}
            onReveal={() => void app.reveal(code.id)}
            onHide={() => app.hide(code.id)}
            onCopy={() => void app.copyCode(code.id)}
            onEdit={() => setCodeForm(code)}
            onArchive={() => void app.archiveCode(code, code.status === "archived" ? "active" : "archived")}
            onDelete={() => setConfirm({
              title: `Delete ${code.title}?`,
              body: "The encrypted secret is removed permanently.",
              action: () => app.deleteCode(code),
            })}
          />
        ))}
      </section>
      {editClient ? (
        <ClientFormDialog
          open
          clients={app.clients}
          existing={client}
          onClose={() => setEditClient(false)}
          onSave={(input, requestId) => app.saveClient(input, requestId, client).then(() => undefined)}
        />
      ) : null}
      {locationForm ? (
        <LocationFormDialog
          open
          clientId={client.id}
          existing={locationForm === "new" ? undefined : locationForm}
          onClose={() => setLocationForm(null)}
          onSave={(input, requestId) => app.saveLocation(input, requestId, locationForm === "new" ? undefined : locationForm)}
        />
      ) : null}
      {codeForm ? (
        <CodeFormDialog
          open
          clientId={client.id}
          locations={locations}
          categories={categories}
          existing={codeForm === "new" ? undefined : codeForm}
          onClose={() => setCodeForm(null)}
          onSave={(input, requestId) => app.saveCode(input, requestId, codeForm === "new" ? undefined : codeForm)}
          onCreateCategory={app.addCategory}
        />
      ) : null}
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">{confirm?.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">{confirm?.body}</DialogDescription>
          <div className="mt-5 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={() => {
              const action = confirm?.action;
              setConfirm(null);
              if (action) void action();
            }}>Confirm delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
