"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/components/providers/vault-provider";
import { emailSchema, passwordSchema } from "@/lib/domain/schema";

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">AccessVault</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
        </div>
        <Card>
          <CardContent className="py-6">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}

export function LoginScreen() {
  const app = useVault();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("reason") === "session" ? "Your session expired. Sign in again." : "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await app.signIn(email, password);
    setPassword("");
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(params.get("next") || "/dashboard");
  }

  return (
    <AuthLayout title="Sign in" subtitle="Use the account password for this device. You will unlock the vault separately.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending || !app.configured}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {!app.configured ? <p className="text-sm text-muted">Supabase is not configured yet. See the setup instructions on the home page.</p> : null}
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link className="font-semibold text-teal-800" href="/forgot-password">Forgot password</Link>
        <Link className="font-semibold text-teal-800" href="/register">Create account</Link>
      </div>
    </AuthLayout>
  );
}

export function RegisterScreen() {
  const app = useVault();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    if (!emailResult.success || !passwordResult.success) {
      setError(emailResult.error?.issues[0]?.message ?? passwordResult.error?.issues[0]?.message ?? "Check the form.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    const result = await app.signUp(email, password);
    setPassword("");
    setConfirm("");
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.status === "verification_sent" ? "Check your email and confirm the account before signing in." : "Account created.");
  }

  return (
    <AuthLayout title="Create account" subtitle="The account password signs you in. It is not the key that encrypts access codes.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="register-password">Password</Label>
          <Input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="register-confirm">Confirm password</Label>
          <Input id="register-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-teal-800">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending || !app.configured}>Create account</Button>
        {!app.configured ? <p className="text-sm text-muted">Supabase is not configured yet. See the setup instructions on the home page.</p> : null}
      </form>
      <p className="mt-4 text-sm">
        Already registered? <Link className="font-semibold text-teal-800" href="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordScreen() {
  const app = useVault();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await app.sendPasswordReset(email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage("If an account exists for that email, a reset link is on the way.");
  }

  return (
    <AuthLayout title="Reset password" subtitle="This resets the account password only. It cannot recover a lost vault passphrase.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="reset-email">Email</Label>
          <Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-teal-800">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={!app.configured}>Send reset link</Button>
      </form>
      <p className="mt-4 text-sm">
        <Link className="font-semibold text-teal-800" href="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordScreen() {
  const app = useVault();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Use a stronger password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await app.changePassword(password);
      setPassword("");
      setConfirm("");
      setMessage("Password updated. Sign in with the new password.");
      router.replace("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The password was not changed.");
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Open this page from the email link so your reset session is active.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="confirm-new-password">Confirm password</Label>
          <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-teal-800">{message}</p> : null}
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthLayout>
  );
}
