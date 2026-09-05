// UX-13 (auth pages rebuilt against a supplied reference screenshot):
// replaces UX-12's shell wholesale — a fresh reference screenshot was
// supplied as the exact visual target, discarding the previous pass's
// direction (a saturated --primary panel, an overlapping node diagram,
// a theme toggle) rather than iterating on it. This file owns layout
// only; every real auth behaviour (next-param survival, expired/
// confirmation-failed banners, non-enumerating errors, email preserved
// on error, already-authenticated redirect) still lives entirely in
// page.tsx/sign-in-form.tsx/sign-up-form.tsx/lib/auth/**, none of which
// this file touches.
//
// Light only: the reference has no dark variant and the ticket is
// explicit ("These pages are light only... Remove [the theme toggle]"),
// so this file and everything under it reads the frozen `--auth-*`
// tokens (globals.css), never the theme-reactive --background/
// --foreground/etc. — no ThemeToggleCompact, no data-theme branching.
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
//     such flow; both Email and Password are wired here.
//   - The reference's blue "+" tile mark — replaced with the real
//     Crado mark (ThemedMark), which on this always-light surface
//     always resolves to the black variant.
//   - The static demo-only button choreography — theatre for buttons
//     that no longer exist (OAuth) or that already have a real pending
//     state (the submit button's own "Signing in…"/"Creating
//     account…" via useActionState).
import Link from "next/link";
import { User, UserPlus } from "lucide-react";
import { ThemedMark } from "./themed-mark";
import { AuthMarketingPanel } from "./auth-marketing-panel";
import { authIconTile, authOutlineButton } from "./auth-tokens";

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
    <div className="flex min-h-dvh w-full bg-auth-bg lg:h-dvh lg:overflow-hidden">
      {/* LEFT — the form region. Full width below 1024px (the panel is
          hidden entirely, not just shrunk, per the ticket's own
          verification requirement); 44% at lg+. */}
      <div className="flex w-full flex-col lg:w-[44%]">
        <header className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10 sm:pt-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Crado home">
            <ThemedMark width={18} height={21} className="shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-auth-foreground">CRADO</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-auth-muted sm:inline-block">{switchPrompt}</span>
            <Link href={switchHref(switchTarget, next)} className={authOutlineButton}>
              {switchLabel}
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
            <div className={authIconTile} aria-hidden="true">
              <Icon className="h-6 w-6" />
            </div>
            {children}
          </div>
        </div>

        <footer className="px-6 pb-6 sm:px-10 sm:pb-8">
          <p className="text-xs text-auth-muted">© {year} Crado</p>
        </footer>
      </div>

      {/* RIGHT — the marketing panel. Hidden below 1024px. */}
      <div className="hidden lg:flex lg:w-[56%]">
        <AuthMarketingPanel />
      </div>
    </div>
  );
}
