// UX-12 (auth page redesign, ported from a supplied HTML reference):
// literal type/control scale for the auth forms only — a companion to
// reasoning-typography.ts's precedent (UX-07) of keeping a route-
// specific literal scale in its own small file rather than bending the
// shared `typography` object in tokens.ts to fit one surface's exact
// spec. Every colour still resolves through the existing
// --foreground/--background/--border/etc. tokens; nothing here
// hardcodes a hex value or introduces a new one.
//
// Sizes/radii below are read off the reference file directly (its own
// Tailwind classes — text-2xl/font-bold heading, rounded-xl 44-46px
// inputs and buttons, text-[13px] body copy) rather than approximated;
// see auth-shell.tsx's own top comment for what was intentionally not
// ported (OAuth buttons, language switcher, privacy link).
export const authHeading = "text-center text-2xl font-bold tracking-tight text-foreground";
export const authSupportingLine = "text-center text-[13px] text-muted-foreground";
export const authLabel = "text-xs font-medium text-muted-foreground";
export const authHelperText = "text-xs text-muted-foreground";
// 44px height (h-11) / 12px radius (rounded-xl) — the reference's own
// input dimensions. Merged onto Input's own base classes via twMerge
// (cn()) — Input's default h-9/rounded-md lose the conflict.
export const authInput = "h-11 rounded-xl";
// Near-black fill / white text in light theme, the inverse in dark —
// bg-foreground/text-background flips automatically with the theme,
// exactly like the pre-UX-09 placeholder page's own "Sign in" button
// already did (see git history), so this isn't a new colour pairing,
// just reused. One primary style only — no second button treatment
// exists on this surface.
export const authPrimaryButton =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[13px] font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
// The small outlined "Sign up"/"Sign in" switch button in the shell's
// top bar — one secondary/outline style, distinct from the primary
// button above by being outlined rather than filled.
export const authOutlineButton =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-secondary";
// The circular icon badge above the heading (User for sign-in, UserPlus
// for sign-up) — the reference's own h-14 w-14/rounded-2xl proportions,
// on --secondary (the app's existing "quiet fill" token) rather than
// the reference's literal #F8F9FA, which has no dedicated token but
// reads the same role.
export const authIconCircle =
  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-muted-foreground";
