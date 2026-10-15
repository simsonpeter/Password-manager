import { z } from "zod";

export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(200);

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(200);

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  businessName: z.string().trim().max(160),
  contactPerson: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter a valid email or leave it blank."),
  address: z.string().trim().max(400),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});

export const locationInputSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1, "Location name is required.").max(160),
  address: z.string().trim().max(400),
  notes: z.string().max(4000).optional(),
});

export const codeInputSchema = z.object({
  clientId: z.string().uuid(),
  locationId: z.string().uuid().nullable(),
  title: z.string().trim().min(1, "Title is required.").max(120),
  category: z.string().trim().min(1, "Category is required.").max(60),
  secret: z.string().min(1, "Code is required.").max(512).optional(),
  instructions: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .nullable(),
});

export function normalizeTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, 20);
}
