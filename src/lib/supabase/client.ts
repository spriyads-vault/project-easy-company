import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/** Browser-side Supabase client. Safe to call from client components. */
export function createClient() {
  const env = getPublicSupabaseEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
