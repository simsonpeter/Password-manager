import type { ReactNode } from "react";
import { VaultGate } from "@/components/vault/vault-gate";

export const dynamic = "force-dynamic";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <VaultGate>{children}</VaultGate>;
}
