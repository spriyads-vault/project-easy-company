// UX-13 (auth pages rebuilt against a supplied reference screenshot):
// literal type/control scale for the auth forms only — a companion to
// reasoning-typography.ts's precedent (UX-07) of keeping a route-
// specific literal scale in its own small file rather than bending the
// shared `typography` object in tokens.ts to fit one surface's exact
// spec.
//
// Unlike every earlier pass, these colours resolve through the frozen
// `--auth-*` tokens (globals.css), not the theme-reactive
// --foreground/--muted-foreground/etc. — /login and /signup are light-
// only by explicit product decision (no dark variant, no toggle), so
// referencing the normal theme tokens would let a visitor's OS/stored
// dark preference leak through onto a page that's supposed to be fixed
// light. See globals.css's own comment on those tokens for exactly
// which existing light-theme value each one freezes.
export const authHeading = "text-[30px] font-semibold tracking-tight text-auth-foreground";
export const authSupportingLine = "text-sm text-auth-muted";
export const authLabel = "text-xs font-medium text-auth-muted";
export const authHelperText = "text-xs text-auth-muted";
// 44px height / 12px radius, merged onto Input's own base classes via
// twMerge (cn()) — Input's theme-reactive defaults (h-9/rounded-md/
// border-input/bg-card/text-foreground/ring-ring) all lose the
// conflict to these frozen equivalents.
export const authInput =
  "h-11 rounded-xl border-auth-border bg-auth-bg text-auth-foreground placeholder:text-auth-muted/70 focus-visible:border-auth-primary/60 focus-visible:ring-auth-primary/30";
// Solid near-black fill / white text — the reference's own button
// treatment. No theme flip: --auth-foreground/--auth-bg are frozen, so
// this is always near-black-on-white, matching "these pages are light
// only."
export const authPrimaryButton =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-auth-foreground text-[13px] font-medium text-auth-bg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
// The small outlined "Sign up"/"Sign in" switch button in the header.
export const authOutlineButton =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-auth-border px-4 text-xs font-semibold text-auth-foreground transition-colors hover:bg-auth-tile-bg";
// The focus ring for auth-specific controls that don't go through
// Input (the password-toggle button, the header switch button) —
// tokens.ts's own `focusRing` reads the theme-reactive --primary,
// which would flip; this is the frozen equivalent.
export const authFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-auth-primary";
// The rounded icon tile above the heading (a person/person-plus glyph).
export const authIconTile =
  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-auth-border bg-auth-tile-bg text-auth-muted";
