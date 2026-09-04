import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect";

/**
 * Landing point for the link in Supabase's confirmation/magic-link emails.
 * Exchanges the one-time token for a session, then redirects into the app.
 *
 * `next` here comes straight from the incoming request's query string —
 * an untrusted value even though Supabase itself only ever sets it to
 * what emailRedirectTo specified at signUp time (currently unset, so in
 * practice always absent). Sanitized regardless: a crafted confirmation
 * link is exactly the kind of place an open-redirect gets planted.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeRedirectTarget(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=confirmation-failed");
}
