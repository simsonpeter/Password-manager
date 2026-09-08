import type { Category, Entry } from "./types";

export const SAMPLE_ENTRIES: Omit<Entry, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Harbour Gate A",
    category: "gate" as Category,
    codes: ["4821", "9033"],
    notes: "Staff entrance beside the boat yard. Second code is for after 10pm.",
    favorite: true,
    lastUsedAt: null,
  },
  {
    name: "North Port · Dock 12",
    category: "port" as Category,
    codes: ["7710"],
    notes: "Keypad on the left pillar. Hold * then the code.",
    favorite: false,
    lastUsedAt: null,
  },
  {
    name: "Studio rear door",
    category: "door" as Category,
    codes: ["2048"],
    notes: "Green box under the ivy.",
    favorite: false,
    lastUsedAt: null,
  },
  {
    name: "Building alarm",
    category: "alarm" as Category,
    codes: ["334455"],
    notes: "Disarm within 30 seconds of opening.",
    favorite: true,
    lastUsedAt: null,
  },
];
