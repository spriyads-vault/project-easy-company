// UX-10 (Sign in / Sign up, enterprise layout): a floating two-region
// container on a light-grey page background, replacing the previous
// full-bleed two-pane shell (UX-06's "Auth enterprise redesign" —
// context pane left, form right). This pass swaps the roles per the
// reference: form on the LEFT (near-white surface), a full-height
// product panel INSET on the RIGHT — and the container itself no
// longer fills the viewport; it floats, centred, ~88vh tall, with a
// visible grey margin on every side at any size.
//
// Layout-only ticket — every existing behaviour (next-param survival,
// expired/confirmation-failed banners, non-enumerating errors, email
// preserved on error, already-authenticated redirect) lives entirely
// in page.tsx/sign-in-form.tsx/sign-up-form.tsx/lib/auth/**, none of
// which this file touches. This component only rearranges chrome
// around <children> (the actual form).
//
// What the reference showed that is deliberately NOT here, and why:
//   - Google/Apple sign-in buttons and the "Or" divider — no OAuth
//     provider is enabled (confirmed in supabase/config.toml before
//     writing this file: `[auth.external.apple]` is explicitly
//     `enabled = false`, and Google has no `[auth.external.google]`
//     section at all — not configured, not just off); rendering either
//     button would be a fabricated capability.
//   - A language switcher — no i18n exists in this app.
//   - A Privacy Policy link — no /privacy route exists (same reasoning
//     UX-06 already recorded for Terms of Service; still true here).
//   - The reference's 3D isometric render — replaced with real product
//     content per the ticket's own instruction; see RIGHT_PANEL_ROWS
//     below for where each line actually comes from.
import Link from "next/link";
import { ThemedMark } from "./themed-mark";
import { ThemeToggleCompact } from "./theme-toggle-compact";
import { authOutlineButton } from "./auth-tokens";

// Every line below is a real string already produced by this app — not
// written for this shell. Sourced from the seeded Gateway X case
// (CASE-4FA53E), live-observed during this ticket's own QA pass:
//   1. The Investigation Agent's real leading hypothesis title for that
//      case (rendered on its Decision view).
//   2. failure-strip.tsx's real composed sentence for that case's
//      measurement.
//   3. scripts/seed-gateway-x.mjs's FAILURE_CASE_TITLE constant.
//   4. investigations/new/actions.ts's real case_opened timeline
//      event description, written for every new case.
const RIGHT_PANEL_ROWS: readonly string[] = [
  "200 MHz emission is the 5th harmonic of the 40 MHz system clock",
  "200 MHz measured 7.4 dB above the selected limit, with wifi tx + display active.",
  "Radiated emissions — Gateway X Rev17",
  "Radiated emissions case opened.",
];

interface AuthShellProps {
  mode: "sign-in" | "sign-up";
  /** Sanitized post-auth destination, preserved across the Sign in <->
   * Sign up switch button so a deep link a visitor followed while signed
   * out ("/login?next=/cases/abc") survives choosing the wrong form
   * first. Always a same-origin path — see sanitizeRedirectTarget. */
  next: string;
  children: React.ReactNode;
}

// Exported so tests (and, previously, the forms themselves) can assert
// the next-preservation rule without re-deriving it.
export function switchHref(target: "/login" | "/signup", next: string): string {
  return next === "/investigations" ? target : `${target}?next=${encodeURIComponent(next)}`;
}

export function AuthShell({ mode, next, children }: AuthShellProps) {
  const year = new Date().getFullYear();
  const switchTarget = mode === "sign-in" ? "/signup" : "/login";
  const switchLabel = mode === "sign-in" ? "Sign up" : "Sign in";
  const switchPrompt = mode === "sign-in" ? "Don't have an account?" : "Already have an account?";

  return (
    // One step off white (light) / off the app's own dark background —
    // reuses --secondary, the same "quiet fill" token every other
    // surface's raised/inactive state already reads from; no new colour.
    <div className="flex min-h-dvh items-center justify-center bg-secondary p-3 sm:p-6 lg:p-8">
      <div className="flex h-[88vh] min-h-[600px] w-full max-w-[1240px] overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.3),0_24px_48px_-16px_rgba(0,0,0,0.35)] lg:flex-row">
        {/* LEFT — the form region. Full width below 1024px (the right
            panel is hidden entirely, not just shrunk); 42% at lg+. */}
        <div className="flex w-full flex-col lg:w-[42%]">
          <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <ThemedMark width={20} height={23} className="shrink-0" />
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">CRADO</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2.5">
              <ThemeToggleCompact />
              {/* The 42%-wide left column is narrowest right at the lg
                  breakpoint itself (1024px total, ~340px of top-bar
                  room after padding) — live-verified this exact width
                  clipped the CRADO wordmark to "CR…" with the prompt
                  sentence shown. Hidden until xl (1280px container,
                  ~450px of room), where it fits alongside the wordmark
                  with no truncation; the switch button (the only part
                  of this row that actually performs an action) is
                  never hidden at any width. */}
              <span className="hidden text-sm text-muted-foreground xl:inline">{switchPrompt}</span>
              <Link href={switchHref(switchTarget, next)} className={authOutlineButton}>
                {switchLabel}
              </Link>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8">
            <div className="flex w-full max-w-[360px] flex-col gap-6">{children}</div>
          </div>

          <div className="px-5 py-5 sm:px-8 sm:py-6">
            <p className="text-xs text-muted-foreground">© {year} Crado</p>
          </div>
        </div>

        {/* RIGHT — the product panel. Hidden below 1024px, per the
            ticket's own responsive rule; inset from the container edge
            (the padding below) rather than flush, so it reads as a
            panel floating inside the card, not a second full-bleed
            pane. */}
        <div className="hidden shrink-0 p-3 lg:flex lg:w-[58%]">
          <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-b from-card to-secondary p-8 xl:p-10">
            <div className="flex max-w-md flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Regulation, inside the engineering loop.
              </h2>
              <p className="text-sm text-muted-foreground">
                Connect product revisions, measurements, evidence and engineering decisions in one
                traceable investigation record.
              </p>
            </div>

            {/* Real investigation content, not the reference's 3D
                render — see RIGHT_PANEL_ROWS above for provenance. */}
            <div className="flex flex-col gap-2.5">
              {RIGHT_PANEL_ROWS.map((row) => (
                <div key={row} className="rounded-[10px] bg-background/50 px-4 py-3">
                  <p className="text-[13px] leading-snug text-foreground">{row}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
