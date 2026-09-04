import type { AuthError } from "@supabase/supabase-js";

// Split out of actions.ts: a "use server" file may only export async
// functions (Next.js enforces this at build time), and this is a plain
// synchronous mapper, kept independently testable besides.
//
// Maps a real Supabase AuthError to user-facing copy. Deliberately
// narrow: only branches Supabase actually documents (AuthError.status /
// .code / .name — see node_modules/@supabase/auth-js/dist/.../errors.d.ts
// and error-codes.d.ts), never a guessed cause. Two things this
// intentionally does NOT do: (1) distinguish "no account with that
// email" from "wrong password" on sign-in — Supabase's own
// invalid_credentials code covers both, and inventing a distinction the
// backend didn't make would leak whether an email is registered; (2)
// reveal on sign-up whether an email is already taken — Supabase's own
// anti-enumeration behavior (identities: [] on collision, no error) is
// what makes "Check your email to confirm your account" the correct
// message either way, unchanged from before this pass.
export function mapAuthError(error: AuthError, context: "signIn" | "signUp"): string {
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (error.name === "AuthRetryableFetchError") {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (context === "signIn" && error.code === "email_not_confirmed") {
    return "Confirm your email before signing in. Check your inbox for the confirmation link from Crado.";
  }
  if (context === "signUp" && error.code === "weak_password") {
    return error.message || "Choose a stronger password.";
  }
  return context === "signIn"
    ? "Could not sign in. Check your email and password."
    : "Could not create an account with those details.";
}
