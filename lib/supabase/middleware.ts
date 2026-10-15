import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseConfig } from "@/lib/security/public-key";

const PROTECTED_PREFIXES = ["/dashboard", "/clients", "/search", "/settings"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let config: { url: string; anonKey: string } | null = null;
  try {
    config = readPublicSupabaseConfig();
  } catch {
    return new NextResponse("Supabase configuration is invalid.", { status: 500 });
  }
  if (!config) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;
  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!user && protectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }
  if (user && AUTH_PAGES.includes(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  return supabaseResponse;
}
