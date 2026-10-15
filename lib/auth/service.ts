export type AuthResult =
  | { ok: true; status: "signed_in" | "verification_sent" | "reset_sent" }
  | {
      ok: false;
      status: "invalid_credentials" | "email_not_confirmed" | "rate_limited" | "weak_password" | "error";
      message: string;
    };

interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

interface AuthResponse {
  data: {
    session?: unknown;
    user?: { email?: string | null; identities?: unknown[] } | null;
  };
  error: AuthErrorLike | null;
}

export interface AuthClient {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<AuthResponse>;
    signUp: (credentials: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string };
    }) => Promise<AuthResponse>;
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{ error: AuthErrorLike | null }>;
    updateUser: (attributes: { password: string }) => Promise<{ error: AuthErrorLike | null }>;
    signOut: () => Promise<{ error: AuthErrorLike | null }>;
  };
}

function mapError(error: AuthErrorLike): AuthResult {
  const message = error.message ?? "Something went wrong.";
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return { ok: false, status: "invalid_credentials", message: "Email or password is incorrect." };
  }
  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return { ok: false, status: "email_not_confirmed", message: "Confirm your email before signing in." };
  }
  if (lower.includes("rate") || error.status === 429) {
    return { ok: false, status: "rate_limited", message: "Too many attempts. Wait a minute and try again." };
  }
  if (lower.includes("password")) {
    return { ok: false, status: "weak_password", message: "Use at least 12 characters." };
  }
  return { ok: false, status: "error", message: "The request could not be completed." };
}

export async function signInWithEmail(client: AuthClient, email: string, password: string): Promise<AuthResult> {
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return mapError(error);
  if (!data.session) return { ok: false, status: "email_not_confirmed", message: "Confirm your email before signing in." };
  return { ok: true, status: "signed_in" };
}

export async function registerWithEmail(
  client: AuthClient,
  email: string,
  password: string,
  redirectTo: string,
): Promise<AuthResult> {
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return mapError(error);
  if (!data.session) return { ok: true, status: "verification_sent" };
  return { ok: true, status: "signed_in" };
}

export async function requestPasswordReset(client: AuthClient, email: string, redirectTo: string): Promise<AuthResult> {
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) {
    const mapped = mapError(error);
    if (mapped.ok === false && mapped.status === "rate_limited") return mapped;
  }
  return { ok: true, status: "reset_sent" };
}

export async function updateAccountPassword(client: AuthClient, password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    const mapped = mapError(error);
    if (!mapped.ok) throw new Error(mapped.message);
  }
}

export async function reauthenticate(client: AuthClient, email: string, password: string): Promise<boolean> {
  const result = await signInWithEmail(client, email, password);
  return result.ok && result.status === "signed_in";
}
