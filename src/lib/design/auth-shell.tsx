// UX-12 (auth page redesign, ported from a supplied HTML reference):
// replaces UX-10/UX-11's shell wholesale — a new visual source of truth
// was supplied for this ticket, so the previous floating-container/
// full-bleed-with-investigation-chain designs are discarded, not
// iterated on. This file owns layout only; every real auth behaviour
// (next-param survival, expired/confirmation-failed banners, non-
// enumerating errors, email preserved on error, already-authenticated
// redirect) still lives entirely in page.tsx/sign-in-form.tsx/
// sign-up-form.tsx/lib/auth/**, none of which this file touches.
//
// What the reference showed that is deliberately NOT here, and why:
//   - Google/Apple sign-in buttons and the "Or" divider — no OAuth
//     provider is enabled (confirmed in supabase/config.toml:
//     `[auth.external.apple]` is explicitly `enabled = false`, and
//     Google has no `[auth.external.google]` section at all — not
//     configured, not just off); rendering either button would be a
//     fabricated capability.
//   - The "By continuing, you acknowledge [...] Privacy Policy" line —
//     no /privacy route exists (same reasoning UX-06 already recorded
//     for Terms of Service).
//   - The language switcher ("ENG" menu) — no i18n exists in this app.
//   - The single-field "Login with Email" flow — the reference's own
//     form is passwordless/magic-link shaped, but this product has no
//     such flow; both Email and Password are wired here, per the
//     ticket's own instruction.
//   - The reference's on-page theme toggle did not exist to begin
//     with — it never had one; this page remains fully theme-aware via
//     the existing stored/system preference, just with no manual
//     switcher control on this page, matching the reference exactly.
//   - The static demo-only "spinner then success" button choreography
//     and the aria-live feedback caption — theatre for buttons that no
//     longer exist (OAuth) or that already have a real pending state
//     (the submit button's own "Signing in…"/"Creating account…" via
//     useActionState).
import Link from "next/link";
import { User, UserPlus } from "lucide-react";
import { ThemedMark } from "./themed-mark";
import { AuthMarketingPanel } from "./auth-marketing-panel";
import { authIconCircle, authOutlineButton } from "./auth-tokens";

interface AuthShellProps {
  mode: "sign-in" | "sign-up";
  /** Sanitized post-auth destination, preserved across the Sign in <->
   * Sign up switch button so a deep link a visitor followed while signed
   * out ("/login?next=/cases/abc") survives choosing the wrong form
   * first. Always a same-origin path — see sanitizeRedirectTarget. */
  next: string;
  children: React.ReactNode;
}

// Exported so tests can assert the next-preservation rule without
// re-deriving it.
export function switchHref(target: "/login" | "/signup", next: string): string {
  return next === "/investigations" ? target : `${target}?next=${encodeURIComponent(next)}`;
}

export function AuthShell({ mode, next, children }: AuthShellProps) {
  const year = new Date().getFullYear();
  const switchTarget = mode === "sign-in" ? "/signup" : "/login";
  const switchLabel = mode === "sign-in" ? "Sign up" : "Sign in";
  const switchPrompt = mode === "sign-in" ? "Don't have an account?" : "Already have an account?";
  const Icon = mode === "sign-in" ? User : UserPlus;

  return (
    <div className="flex min-h-dvh w-full bg-background md:h-dvh md:overflow-hidden">
      {/* LEFT — the form region. Full width below 768px (the reference's
          own breakpoint — its marketing panel is `hidden md:flex`);
          44% at md+, matching the reference's own proportions. */}
      <div className="flex w-full flex-col md:w-[44%]">
        <header className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10 sm:pt-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Crado home">
            <ThemedMark width={18} height={21} className="shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">CRADO</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            {/* The 44%-wide left column is narrowest right at md (the
                panel's own show/hide breakpoint, 768px total, ~296px of
                header room after padding) — live-verified this exact
                width clipped the CRADO wordmark to "C" with the prompt
                sentence shown (the same class of defect UX-10 found at
                its own tightest breakpoint). Hidden until lg (1024px,
                ~370px of room), where it fits alongside the wordmark
                with no truncation; the switch button (the only part of
                this row that performs an action) is never hidden. */}
            <span className="hidden text-xs text-muted-foreground lg:inline-block">{switchPrompt}</span>
            <Link href={switchHref(switchTarget, next)} className={authOutlineButton}>
              {switchLabel}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="flex w-full max-w-[340px] flex-col items-center gap-6">
            <div className={authIconCircle} aria-hidden="true">
              <Icon className="h-6 w-6" />
            </div>
            {children}
          </div>
        </div>

        <footer className="px-6 pb-6 sm:px-10 sm:pb-8">
          <p className="text-xs text-muted-foreground">© {year} Crado</p>
        </footer>
      </div>

      {/* RIGHT — the marketing panel. Hidden below 768px. */}
      <div className="hidden md:flex md:w-[56%]">
        <AuthMarketingPanel />
      </div>
    </div>
  );
}
