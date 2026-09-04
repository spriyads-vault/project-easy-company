// UX-04 (Agent-Native) CANONICAL DESIGN TOKENS — the one source of truth
// for Crado's dark "2026 agentic engineering" visual language, shared
// across every authenticated route. Route-scoped theme.ts files (e.g.
// src/app/cases/[caseId]/investigation/theme.ts, src/app/documents/theme.ts)
// re-export from here instead of owning their own palette.
//
// Pivot from the previous (light) UX-04 pass: this ticket is explicit —
// "the previous light cream/yellow canvas does not fit the desired
// product identity... build one excellent dark application theme." Every
// value below now resolves to the shadcn/ui CSS-variable contract defined
// in globals.css (--background/--card/--popover/--border/--primary/etc.)
// so the hand-rolled tokens here and the Radix-backed primitives in
// src/components/ui/** render from exactly one palette, not two.
export const surface = {
  page: "bg-background text-foreground",
  panel: "border border-border bg-card",
  panelElevated: "border border-border bg-secondary",
  hairline: "border-border",
  // Artifact/floating surfaces: depth from shadow + radius, not a hard
  // rectangle.
  card: "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.3),0_10px_24px_-14px_rgba(0,0,0,0.5)]",
  cardQuiet: "rounded-2xl bg-secondary/60",
  floating: "rounded-[18px] border border-border bg-popover shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]",
  // The "raised surface" scale — one step brighter than card, for a
  // focused technical artifact or the active-agent state (never a whole
  // page background).
  raised: "rounded-2xl border border-border bg-secondary text-foreground",
};

export const text = {
  kicker: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
  muted: "text-muted-foreground",
  faint: "text-muted-foreground/70",
  mono: "font-mono tabular-nums",
};

// Semantic status accent — green is reserved for verified success/pass/
// resolved/completed (never a general brand color; see the "SEMANTIC
// COLOR RULES" comment in globals.css). `green`/`warn` are raw CSS
// var() references for non-Tailwind consumers (inline SVG stroke/fill in
// spectrum-chart.tsx); `greenText`/`warnText` are the equivalent
// Tailwind utility for everywhere else.
export const accent = {
  green: "var(--success)",
  greenText: "text-success",
  warn: "var(--warning)",
  warnText: "text-warning",
};

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Two radii, used deliberately differently — a tighter one for controls
// people click precisely, a looser one for surfaces that hold content.
export const radius = {
  control: "rounded-[10px]",
  card: "rounded-2xl",
  floating: "rounded-[18px]",
  pill: "rounded-full",
};

// Restrained, reduced-motion-safe entrance treatment. `.crado-rise` and
// friends are defined in globals.css behind
// `@media (prefers-reduced-motion: no-preference)`.
export const motion = {
  rise: "crado-rise",
  riseDelay1: "crado-rise [animation-delay:60ms]",
  riseDelay2: "crado-rise [animation-delay:120ms]",
  riseDelay3: "crado-rise [animation-delay:180ms]",
  slideIn: "crado-slide-in",
  connectorDraw: "crado-connector-draw",
  fadeIn: "crado-fade-in",
};

// OBSERVED/KNOWN/INFERRED/MISSING — instantly distinguishable on a dark
// canvas. Each gets its own glyph plus a border treatment: OBSERVED/KNOWN
// read as trustworthy (solid), INFERRED as provisional, MISSING as an
// open gap (dashed).
export const evidence: Record<
  "observed" | "known" | "inferred" | "missing",
  { glyph: string; borderColor: string; glyphColor: string; dashed?: boolean }
> = {
  observed: { glyph: "●", borderColor: "border-primary/50", glyphColor: "text-primary" },
  known: { glyph: "◆", borderColor: "border-muted-foreground/40", glyphColor: "text-muted-foreground" },
  inferred: { glyph: "△", borderColor: "border-warning/50", glyphColor: "text-warning" },
  missing: { glyph: "○", borderColor: "border-muted-foreground/50", glyphColor: "text-muted-foreground", dashed: true },
};

// A single shared vocabulary for "what is this run doing right now."
export type HeroStatusTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const heroStatusStyle: Record<HeroStatusTone, string> = {
  waiting: "border-border text-muted-foreground",
  idle: "border-border text-muted-foreground",
  active: "border-primary/50 bg-primary/10 text-primary",
  // "complete" is only ever reached via a truthful "resolved" case
  // status (see WORKFLOW_STATE_TONE in derive-workflow-state.ts) — a
  // genuine success/pass state, so it gets the reserved success green,
  // not the cobalt "active work" accent.
  complete: "border-success/40 text-success",
  failed: "border-destructive/50 bg-destructive/10 text-destructive",
};

// APPLICATION SHELL — a collapsible left rail and a quiet top bar, used
// by every authenticated route (see src/lib/design/app-shell.tsx).
export const rail = {
  container: "flex-col border-r border-border bg-card py-3",
  mark: "flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xs font-semibold text-primary",
  item: "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
  itemActive: "flex h-9 items-center gap-2.5 rounded-lg bg-secondary px-2.5 text-sm text-foreground",
  separator: "my-1 h-px w-full bg-border",
};

export const topbar = {
  container: "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur-sm sm:px-6",
};

// The compact segmented view switcher (tabs-as-a-pill), used wherever a
// page has more than one mode of the same underlying thing.
export const segmented = {
  container: "inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-card p-0.5",
  item: "rounded-[7px] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
  itemActive: "rounded-[7px] bg-secondary px-2.5 py-1 text-xs font-medium text-foreground",
};

// A very subtle dot-grid — "not decorative noise", an engineering-surface
// cue behind a connected artifact flow. Also exported as a plain CSS class
// (`.crado-canvas-grid` in globals.css) for the React Flow canvas, which
// needs the pattern on its own scrollable/zoomable background element.
export const canvasBackground = "crado-canvas-grid";

// The thin line + dot connecting two stacked artifacts (non-canvas views).
export const connector = {
  line: "bg-border",
  dot: "border border-border bg-card",
};

// Each step in an investigation chain gets its own label + accent so a
// canvas reads as "connected engineering investigation" at a glance.
export type ArtifactKind =
  | "measurement"
  | "deterministic"
  | "hypothesis"
  | "missing"
  | "nextTest"
  | "observation"
  | "change"
  | "revision"
  | "outcome";

export const artifact: Record<ArtifactKind, { label: string; accent: string; dashed?: boolean }> = {
  measurement: { label: "Measurement", accent: "border-l-foreground/50" },
  deterministic: { label: "Deterministic", accent: "border-l-muted-foreground" },
  hypothesis: { label: "Inferred", accent: "border-l-warning" },
  missing: { label: "Missing evidence", accent: "border-l-muted-foreground", dashed: true },
  nextTest: { label: "Next test", accent: "border-l-primary" },
  observation: { label: "Observation", accent: "border-l-primary" },
  change: { label: "Engineering change", accent: "border-l-foreground/50" },
  revision: { label: "New revision", accent: "border-l-foreground/50" },
  outcome: { label: "Measured outcome", accent: "border-l-primary" },
};

// Typography scale (App Redesign spec): page title 22-28px, section title
// 16-20px, nav/body 13-14px, metadata 12-13px, technical values mono.
export const typography = {
  pageTitle: "text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]",
  sectionHeading: "text-base font-semibold text-foreground",
  body: "text-sm text-foreground sm:text-[15px]",
  metadata: "text-xs text-muted-foreground",
  technical: "font-mono tabular-nums text-foreground",
};
