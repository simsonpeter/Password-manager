import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/auth-screens";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}>
      <LoginScreen />
    </Suspense>
  );
}
