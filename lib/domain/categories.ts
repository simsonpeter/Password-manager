export const DEFAULT_CATEGORIES = [
  "Port gate",
  "Garage",
  "Door",
  "Key safe",
  "Warehouse",
  "Alarm",
  "Intercom",
  "Parking",
  "Other",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];
