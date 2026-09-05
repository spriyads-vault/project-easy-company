// UX-10 (Sign in / Sign up, enterprise layout): literal type/control
// scale for the auth forms only, taken directly from the ticket's own
// numbers — a companion to reasoning-typography.ts's precedent (UX-07)
// of keeping a route-specific literal scale in its own small file
// rather than bending the shared `typography` object in tokens.ts to
// fit one surface's exact spec. Every colour still resolves through
// the existing --foreground/--background/--border/etc. tokens; nothing
// here hardcodes a hex value or introduces a new one.
export const authHeading = "text-[30px] font-medium tracking-tight text-foreground";
// 14px, muted — Tailwind's text-sm already is 14px at this app's base
// font size; named here so both forms read the same literal spec
// rather than two independent "text-sm text-muted-foreground" strings.
export const authSupportingLine = "text-sm text-muted-foreground";
export const authLabel = "text-[13px] font-medium text-foreground";
export const authHelperText = "text-[13px] text-muted-foreground";
// 44px height / 8px radius, merged onto Input's own base classes via
// twMerge (cn()) — Input's default h-9/rounded-md lose the conflict.
export const authInput = "h-11 rounded-[8px]";
// Near-black fill / white text in light theme, the inverse in dark —
// bg-foreground/text-background flips automatically with the theme,
// exactly like the pre-UX-09 placeholder page's own "Sign in" button
// already did (see git history), so this isn't a new colour pairing,
// just reused. One primary style only — no second button treatment
// exists on this surface.
export const authPrimaryButton =
  "flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-foreground text-sm font-medium text-background transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
// The small outlined "Sign up"/"Sign in" switch button in the shell's
// top bar — one secondary/outline style, distinct from the primary
// button above by being outlined rather than filled.
export const authOutlineButton =
  "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-[8px] border border-border px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary";
