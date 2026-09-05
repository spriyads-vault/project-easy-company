// UX-07 correction: a fixed type scale for the Decision view's two
// reasoning objects (correlation-card.tsx, hypothesis-card.tsx) and the
// pinned next-action-bar.tsx recommendation text, applied exactly as
// specified by the correction ticket rather than derived from the
// shared app-wide design tokens (src/lib/design/tokens.ts) — this scale
// is deliberately more restrained than the rest of the app: these
// objects are meant to read as an engineering record, not a marketing
// surface. Values are literal, not "close enough" Tailwind defaults, so
// a future edit that reaches for `text-sm`/`text-base` here instead of
// these constants is very likely reintroducing the defect this ticket
// fixed.
export const cardTitle = "text-[15px] font-medium leading-[1.4]";
export const bodyText = "text-[13px] font-normal leading-[1.55]";
export const sectionLabel = "text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground";
export const technicalValue = "font-mono text-[13px]";
export const nextTestText = "text-[14px] font-normal leading-[1.55]";

// UX-07 correction, section 6 ("Buttons"): one primary style, one
// secondary, both sentence case (no `uppercase` text-transform — that's
// what made "Record result" and its sibling read as two different
// button systems), 13px text, 32px height. `min-w-0` + `break-words` on
// the label span guards against the container ever clipping a long
// button label at a narrow breakpoint (acceptance criterion 2).
const buttonBase =
  "inline-flex h-8 min-w-0 items-center whitespace-normal break-words rounded-[10px] px-3 text-[13px] font-medium transition-colors";
export const primaryButton = `${buttonBase} border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20`;
export const secondaryButton = `${buttonBase} border border-border text-muted-foreground hover:border-primary/50 hover:text-primary`;
