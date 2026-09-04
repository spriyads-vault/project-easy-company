import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "./env";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Supabase's own SSR cookie storage key, e.g. "sb-<project-ref>-auth-token"
// (see @supabase/ssr's default cookie name derivation). Used only to
// distinguish "this visitor had a session that no longer validates"
// (an expired/invalid refresh token) from "this visitor never signed
// in" — the sign-in page can then say "Your session has expired"
// honestly instead of guessing.
const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*-auth-token/;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name));
}

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from private routes. Must run in middleware
 * (not just in Server Components) so the refreshed cookie reaches the browser.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicSupabaseEnv();
  // Captured before getUser() runs — a failed refresh can clear the
  // cookie via setAll(), and by then we'd no longer be able to tell a
  // stale session from no session at all.
  const hadAuthCookie = hasSupabaseAuthCookie(request);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not remove this call. It refreshes the session and must
  // run before any other logic that depends on the user being authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    if (hadAuthCookie) redirectUrl.searchParams.set("expired", "1");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
