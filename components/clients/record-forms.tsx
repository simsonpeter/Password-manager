"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findSimilarClients } from "@/lib/domain/duplicates";
import { clientInputSchema, codeInputSchema, locationInputSchema, normalizeTags } from "@/lib/domain/schema";
import type { AccessRecord, ClientRecord, LocationRecord } from "@/lib/domain/types";
import { SyncConflictError } from "@/lib/errors";
import { newId } from "@/lib/utils";

function issueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form.";
}

export function ClientFormDialog({
  open,
  clients,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  clients: ClientRecord[];
  existing?: ClientRecord;
  onClose: () => void;
  onSave: (input: {
    name: string;
    businessName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    notes?: string;
    tags: string[];
  }, requestId: string) => Promise<void>;
}) {
  const [requestId] = useState(() => existing?.clientRequestId ?? newId());
  const [name, setName] = useState(existing?.name ?? "");
  const [businessName, setBusinessName] = useState(existing?.businessName ?? "");
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const similar = findSimilarClients(name, clients, existing?.id);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = clientInputSchema.safeParse({
      name,
      businessName,
      contactPerson,
      phone,
      email,
      address,
      notes,
      tags: normalizeTags(tags),
    });
    if (!parsed.success) {
      setError(issueMessage(parsed.error));
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSave({ ...parsed.data, notes: notes ? parsed.data.notes : undefined }, requestId);
      onClose();
    } catch (cause) {
      setError(cause instanceof SyncConflictError ? "A newer cloud copy exists. Reload before editing again." : "The client was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold text-navy">{existing ? "Edit client" : "Add client"}</DialogTitle>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="client-name">Client or business name</Label>
            <Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          {similar.length > 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Similar name already saved: {similar.map((item) => item.name).join(", ")}. You can still save this record.
            </p>
          ) : null}
          <div>
            <Label htmlFor="business-name">Trading name, if different</Label>
            <Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="contact">Contact person</Label>
              <Input id="contact" value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Telephone</Label>
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
            </div>
          </div>
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Separate tags with commas" />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Encrypted before it is saved" />
            {existing?.notesCiphertext ? <p className="mt-1 text-xs text-muted">Saved notes stay encrypted until you type a replacement.</p> : null}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save client"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationFormDialog({
  open,
  clientId,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  clientId: string;
  existing?: LocationRecord;
  onClose: () => void;
  onSave: (input: { clientId: string; name: string; address: string; notes?: string }, requestId: string) => Promise<void>;
}) {
  const [requestId] = useState(() => existing?.clientRequestId ?? newId());
  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = locationInputSchema.safeParse({ clientId, name, address, notes });
    if (!parsed.success) {
      setError(issueMessage(parsed.error));
      return;
    }
    setPending(true);
    try {
      await onSave({ ...parsed.data, notes: notes ? parsed.data.notes : undefined }, requestId);
      onClose();
    } catch (cause) {
      setError(cause instanceof SyncConflictError ? "A newer cloud copy exists. Reload before editing again." : "The location was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold text-navy">{existing ? "Edit location" : "Add location"}</DialogTitle>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="location-name">Location name</Label>
            <Input id="location-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="location-address">Address</Label>
            <Input id="location-address" value={address} onChange={(event) => setAddress(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="location-notes">Notes</Label>
            <Textarea id="location-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save location"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CodeFormDialog({
  open,
  clientId,
  locations,
  categories,
  existing,
  onClose,
  onSave,
  onCreateCategory,
}: {
  open: boolean;
  clientId: string;
  locations: LocationRecord[];
  categories: string[];
  existing?: AccessRecord;
  onClose: () => void;
  onSave: (
    input: {
      clientId: string;
      locationId: string | null;
      title: string;
      category: string;
      secret?: string;
      instructions?: string;
      notes?: string;
      expiresAt: string | null;
    },
    requestId: string,
  ) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
}) {
  const [requestId] = useState(() => existing?.clientRequestId ?? newId());
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? categories[0] ?? "Other");
  const [customCategory, setCustomCategory] = useState("");
  const [locationId, setLocationId] = useState(existing?.locationId ?? "");
  const [secret, setSecret] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const chosenCategory = category === "__custom" ? customCategory : category;
    if (category === "__custom" && customCategory.trim()) {
      await onCreateCategory(customCategory.trim());
    }
    const parsed = codeInputSchema.safeParse({
      clientId,
      locationId: locationId || null,
      title,
      category: chosenCategory,
      secret: secret || undefined,
      instructions,
      notes,
      expiresAt: expiresAt || null,
    });
    if (!parsed.success) {
      setError(issueMessage(parsed.error));
      return;
    }
    if (!existing && !parsed.data.secret) {
      setError("Code is required.");
      return;
    }
    setPending(true);
    try {
      await onSave(
        {
          ...parsed.data,
          secret: secret ? parsed.data.secret : undefined,
          instructions: instructions ? parsed.data.instructions : undefined,
          notes: notes ? parsed.data.notes : undefined,
        },
        requestId,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof SyncConflictError ? "A newer cloud copy exists. Reload before editing again." : "The code was not saved.");
    } finally {
      setSecret("");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold text-navy">{existing ? "Edit access code" : "Add access code"}</DialogTitle>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="code-title">Code title</Label>
            <Input id="code-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="code-category">Category</Label>
            <select id="code-category" className="h-11 w-full rounded-lg border border-line bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
              <option value="__custom">Custom category…</option>
            </select>
          </div>
          {category === "__custom" ? (
            <div>
              <Label htmlFor="custom-category">Custom category</Label>
              <Input id="custom-category" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="code-location">Location</Label>
            <select id="code-location" className="h-11 w-full rounded-lg border border-line bg-white px-3" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">Client, no specific location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="code-secret">Code</Label>
            <Input
              id="code-secret"
              className="font-mono"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={existing ? "Leave blank to keep the saved code" : "Enter the code exactly, including leading zeros"}
            />
          </div>
          <div>
            <Label htmlFor="code-instructions">Instructions</Label>
            <Textarea id="code-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="code-notes">Notes</Label>
            <Textarea id="code-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="code-expiry">Expiry date</Label>
            <Input id="code-expiry" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save code"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
