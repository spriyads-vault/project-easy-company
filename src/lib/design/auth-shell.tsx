// UX-11 (auth page, full bleed and right panel composition): two
// corrections to UX-10's shell.
//
// 1. Full bleed. UX-10 floated a rounded, shadowed container on a grey
//    page background (visible margin on all four sides). That outer
//    container, radius, shadow and page margin are gone — the split now
//    fills the viewport edge to edge, top to bottom. The two regions
//    are told apart by surface tone (--background left, --card right —
//    --card is one step lighter than --background in both themes; see
//    globals.css's own "PRIMARY SURFACE" comment) plus a single 1px
//    vertical divider, not by a box floating on a darker page.
// 2. The right panel's ~600px empty middle is gone. It was headline+
//    subhead pinned top, four rows pinned bottom (justify-between),
//    leaving a void between them on any tall viewport. It's now one
//    continuous vertically-centred composition: headline block, a
//    fixed 48px gap, then a 5-row investigation-chain list — nothing
//    below the last row.
//
// Everything else about this component is unchanged from UX-10: mode/
// next/children props, the switch-link relocation into this shell's
// top bar, the left-region logo/theme-toggle/form/copyright. All real
// auth behaviour (next survival, banners, non-enumerating errors, email
// preserved on error) lives in page.tsx/sign-in-form.tsx/sign-up-form.tsx/
// lib/auth/**, none of which this file touches.
import Link from "next/link";
import { ThemedMark } from "./themed-mark";
import { ThemeToggleCompact } from "./theme-toggle-compact";
import { authOutlineButton } from "./auth-tokens";

interface InvestigationChainRow {
  label: string;
  value: string;
  /** Numbers, equations and revision ids render in the monospace/tabular
   * face; everything else (a hypothesis clause, an instruction) renders
   * in the body face — the ticket's own rule. */
  emphasis: "mono" | "body";
  /** The one accent colour this panel is allowed: the Result row only,
   * because it's a verified measured outcome (globals.css reserves
   * --success for verified/pass/resolved, never a general brand color). */
  accent?: boolean;
}

// Every value below is real product/domain output, not written for this
// panel — each is cited against the file that actually produces it:
//   1. Measurement — the seeded Gateway X case's real "before" reading:
//      scripts/seed-gateway-x.mjs (REVISION_LABEL "Rev17", 200 MHz,
//      marginDb 7.4).
//   2 & 3. Calculated / Hypothesis — one sentence split into two rows,
//      produced verbatim by the deterministic (non-model) harmonic
//      correlation utility: src/lib/correlation/harmonic-correlation.ts's
//      description template — `"${measuredFrequencyMhz} MHz is
//      consistent with the ${ordinal} of "${source.label}"
//      (${source.frequencyMhz} MHz x ${harmonicNumber} =
//      ${expectedFrequencyMhz.toFixed(3)} MHz)."` — for this case that's
//      "200 MHz is consistent with the 5th harmonic of "system clock"
//      (40 MHz x 5 = 200.000 MHz)."
//   4. Next test — the canonical recommendedNextStep fixture used
//      throughout the domain/hypothesis tests for this exact case:
//      "Disconnect the display path and re-measure."
//   5. Result — src/lib/measurements/compare-measurements.ts's own
//      canonical "Gateway X 11 dB improvement" test fixture: Rev17
//      +7.4 dB margin -> Rev18 -3.6 dB margin (negative = under the
//      limit) -> deltaDb 11.
const INVESTIGATION_CHAIN: readonly InvestigationChainRow[] = [
  { label: "Measurement", value: "200 MHz · +7.4 dB · Rev17", emphasis: "mono" },
  { label: "Calculated", value: "40 MHz × 5 = 200 MHz", emphasis: "mono" },
  { label: "Hypothesis", value: "Consistent with 5th harmonic of system clock", emphasis: "body" },
  { label: "Next test", value: "Disconnect display path, re-measure", emphasis: "body" },
  { label: "Result", value: "Rev18 · 3.6 dB below limit · 11 dB better", emphasis: "mono", accent: true },
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
    // Full bleed: fills the viewport edge to edge. lg:h-dvh + overflow
    // hidden so the split never scrolls above 1024px, per the ticket.
    // Below that, min-h-dvh lets a very short/landscape phone viewport
    // scroll the form rather than clip it (the ticket only mandates
    // no-scroll at lg+; the right panel is hidden below it anyway).
    <div className="flex min-h-dvh w-full lg:h-dvh lg:overflow-hidden">
      {/* LEFT — the form region. Full width below 1024px (the right
          panel is hidden entirely, not just shrunk); 42% at lg+.
          --background is the app's own base tone; the right panel's
          --card reads one step lighter in both themes, so the split is
          legible from tone alone. The single 1px divider does the rest. */}
      <div className="flex w-full flex-col bg-background lg:w-[42%] lg:border-r lg:border-border">
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <ThemedMark width={20} height={23} className="shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">CRADO</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeToggleCompact />
            {/* The 42%-wide left column is narrowest right at the lg
                breakpoint itself (1024px total, ~340px of top-bar room
                after padding) — live-verified (UX-10) this exact width
                clipped the CRADO wordmark to "CR…" with the prompt
                sentence shown. Hidden until xl (1280px), where it fits
                alongside the wordmark with no truncation; the switch
                button (the only part of this row that performs an
                action) is never hidden at any width. */}
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

      {/* RIGHT — the product panel. Hidden below 1024px. Full height,
          full bleed (no inset padding, no radius) — --card is the
          "PRIMARY SURFACE" token (globals.css), one step lighter than
          --background in both themes. */}
      <div className="hidden overflow-hidden bg-card lg:flex lg:w-[58%] lg:flex-col lg:justify-center lg:px-10 xl:px-14">
        {/* One continuous composition, vertically centred in the panel
            — headline block, a single fixed 48px gap, then the
            investigation-chain rows. Nothing below the last row: no
            footer, no logo lockup, no second block. */}
        <div className="flex max-w-lg flex-col gap-12">
          <div className="flex max-w-md flex-col gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Regulation, inside the engineering loop.
            </h2>
            <p className="text-sm text-muted-foreground">
              Connect product revisions, measurements, evidence and engineering decisions in one
              traceable investigation record.
            </p>
          </div>

          {/* The investigation chain: flat rows (no card/border/icon/
              badge/status dot per row), a single 1px connecting line
              running down the left edge from the first row's centre to
              the last row's centre — the same "thin line links the
              steps" idea the investigation canvas uses for its own
              nodes, reduced to a static vertical rule here. Each row is
              a fixed 56px tall, so the list itself introduces no gap
              larger than the 48px one above it. */}
          <div className="relative flex flex-col pl-6">
            <div className="absolute top-7 bottom-7 left-0 w-px bg-border" aria-hidden="true" />
            {INVESTIGATION_CHAIN.map((row) => (
              <div key={row.label} className="flex h-14 items-center gap-4">
                <span className="w-24 shrink-0 text-sm text-muted-foreground">{row.label}</span>
                <span
                  className={
                    row.emphasis === "mono"
                      ? `truncate font-mono text-[13px] tabular-nums ${row.accent ? "text-success" : "text-foreground"}`
                      : "truncate text-sm text-foreground"
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
