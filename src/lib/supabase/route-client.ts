import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * Supabase client for Route Handlers, built directly from a `Request`
 * instead of `next/headers`' `cookies()`. `cookies()` only works inside
 * Next's own request-rendering lifecycle — calling it from a plain function
 * invoked directly (as tests do) throws "outside a request scope". Reading
 * the Cookie header off the Request keeps the handler callable as an
 * ordinary function in both Next's router and a Vitest test, no Next
 * server required. Session refresh already happens in src/proxy.ts on
 * every request before this ever runs, so writing cookies back here isn't
 * needed for this API's read-then-write-DB flow.
 */
export function createClientFromRequest(request: Request) {
  const env = getPublicSupabaseEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("cookie") ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          );
        },
        setAll() {
          // No-op: see doc comment above.
        },
      },
    },
  );
}
