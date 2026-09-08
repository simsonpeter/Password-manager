export type Category = "gate" | "port" | "door" | "alarm" | "locker" | "other";

export type Entry = {
  id: string;
  name: string;
  category: Category;
  codes: string[];
  notes: string;
  favorite: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  userId: string;
  email: string;
};

export type CloudConfig = {
  url: string;
  anonKey: string;
};

export type Draft = {
  id?: string;
  name: string;
  category: Category;
  codes: string[];
  notes: string;
  favorite: boolean;
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "gate", label: "Gate" },
  { id: "port", label: "Port" },
  { id: "door", label: "Door" },
  { id: "alarm", label: "Alarm" },
  { id: "locker", label: "Locker" },
  { id: "other", label: "Other" },
];

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.id === value);
}
