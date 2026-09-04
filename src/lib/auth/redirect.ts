// Auth enterprise redesign: the auth flow's own post-auth "next" target
// comes straight from a query string an attacker can set — the proxy
// (src/lib/supabase/middleware.ts) writes it when bouncing an
// unauthenticated visitor off a private route, and it round-trips
// through the sign-in/sign-up forms and /auth/confirm. Every one of
// those call sites must run the value through this before ever passing
// it to redirect(), or a crafted link ("Sign in to Crado" pointing at
// `/login?next=https://evil.example`) becomes an open redirect after a
// real login. Only a same-origin, single-leading-slash path is safe.
const DEFAULT_REDIRECT_TARGET = "/investigations";

export function sanitizeRedirectTarget(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_TARGET,
): string {
  if (!next) return fallback;
  // Must start with exactly one "/" — rejects absolute URLs
  // ("https://..."), protocol-relative URLs ("//evil.com"), and the
  // backslash variant some browsers still normalize to a slash
  // ("/\evil.com"). Also rejects embedded control characters (e.g. a
  // stray newline) and any scheme marker that survived the leading-slash
  // check (belt-and-braces against "/\t/evil.com"-style bypasses).
  if (!/^\/(?!\/|\\)[^\s]*$/.test(next)) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}
