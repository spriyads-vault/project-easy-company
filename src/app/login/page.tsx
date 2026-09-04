import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect";
import { AuthShell } from "@/lib/design/auth-shell";
import { SignInForm } from "./sign-in-form";

// Auth enterprise redesign: Server Component so an already-authenticated
// visitor never sees the form at all (redirected straight to their real
// destination — the "Already authenticated" required state) and so the
// two query-driven notices below are derived once, server-side, instead
// of flashing in after a client-side check.
interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string; expired?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next: nextParam, error: errorParam, expired } = await searchParams;
  const next = sanitizeRedirectTarget(nextParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  // errorParam is only ever set by our own /auth/confirm route
  // (?error=confirmation-failed) — a real, tested outcome, not a
  // fabricated one. expired=1 is only ever set by the proxy
  // (src/lib/supabase/middleware.ts) when it found a stale Supabase
  // auth cookie on a private-route request; it deliberately does not
  // claim expiry when there was never a session to begin with.
  const notice =
    errorParam === "confirmation-failed"
      ? {
          tone: "error" as const,
          message: "That confirmation link is invalid or has expired. Sign in below, or create a new account to get a fresh one.",
        }
      : expired === "1"
        ? { tone: "info" as const, message: "Your session has expired. Sign in again to continue." }
        : undefined;

  return (
    <AuthShell mode="sign-in" next={next}>
      <SignInForm next={next} notice={notice} />
    </AuthShell>
  );
}
