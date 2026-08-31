// Integration tests talk to the local Supabase instance (`supabase start`)
// directly with hardcoded URL/keys (see any *.integration.test.ts), but
// code under test that reads process.env (e.g. src/lib/supabase/env.ts,
// used by route handlers) needs those same values there too. These are
// Supabase's well-known local-dev demo keys — identical on every machine,
// not secrets — never read from .env.local (see CLAUDE.md: never read,
// print, log, or commit .env.local).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
