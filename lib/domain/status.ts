import { isoDate } from "@/lib/domain/dates";
import type { AccessLifecycle, AccessRecord } from "@/lib/domain/types";

export function effectiveAccessStatus(record: Pick<AccessRecord, "status" | "expiresAt">, now = new Date()): AccessLifecycle {
  if (record.status === "archived") return "archived";
  if (record.expiresAt && record.expiresAt < isoDate(now)) return "expired";
  return "active";
}
