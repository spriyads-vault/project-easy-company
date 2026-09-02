// UX-04 CANONICAL DESIGN TOKENS — the one source of truth for Crado's
// "2026 agentic engineering" visual language, shared across every
// authenticated route (workspace, products, cases/investigation,
// documents, benchmarks). Route-scoped theme.ts files (e.g.
// src/app/cases/[caseId]/investigation/theme.ts,
// src/app/documents/theme.ts) re-export from here instead of owning their
// own palette, so every screen renders from the same values — "do not
// leave some routes using the old visual system."
//
// Pivot from UX-02/03: those introduced a warm off-white canvas
// (#faf8f3). UX-04 explicitly calls for "pure white / very light
// neutral... NO yellow/cream tint" — every hex below uses a neutral
// (zinc/grey) scale, never a warm-tan one. The green accent and overall
// grammar (cards/connectors/evidence glyphs/motion) carry forward
// unchanged from UX-03; only the base palette shifts.
export const surface = {
  page: "bg-white text-[#18181b]",
  // Still-boxed structural surfaces — rails, drawers, empty states,
  // disabled/inline forms.
  panel: "border border-[#e4e4e7] bg-white",
  panelElevated: "border border-[#d4d4d8] bg-white",
  hairline: "border-[#e4e4e7]",
  // Artifact/floating surfaces: depth from shadow + radius, not a hard
  // rectangle.
  card: "rounded-2xl border border-[#ececee] bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_10px_24px_-14px_rgba(24,24,27,0.12)]",
  cardQuiet: "rounded-2xl bg-[#f4f4f5]/70",
  floating: "rounded-[18px] border border-[#ececee] bg-white shadow-[0_12px_36px_-10px_rgba(24,24,27,0.20)]",
  // UX-04: the one place a dark surface is allowed — a focused technical
  // artifact (code/equation/evidence inspection) or the active-agent
  // state, never a whole page. Opt-in only; nothing below defaults to it.
  dark: "rounded-2xl border border-[#27272a] bg-[#18181b] text-[#f4f4f5]",
};

export const text = {
  kicker: "text-[11px] font-medium uppercase tracking-[0.14em] text-[#71717a]",
  muted: "text-[#71717a]",
  faint: "text-[#a1a1aa]",
  mono: "font-mono tabular-nums",
};

export const accent = {
  green: "#1f9d52",
  greenText: "text-[#15803d]",
  warn: "#b45309",
  warnText: "text-[#b45309]",
};

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f9d52]";

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
};

// OBSERVED/KNOWN/INFERRED/MISSING — instantly distinguishable without
// leaving the neutral + charcoal + restrained-green palette. Each gets
// its own glyph plus a border treatment: OBSERVED/KNOWN read as
// trustworthy (solid), INFERRED as provisional, MISSING as an open gap
// (dashed).
export const evidence: Record<
  "observed" | "known" | "inferred" | "missing",
  { glyph: string; borderColor: string; glyphColor: string; dashed?: boolean }
> = {
  observed: { glyph: "●", borderColor: "border-[#15803d]/50", glyphColor: "text-[#15803d]" },
  known: { glyph: "◆", borderColor: "border-[#52525b]/40", glyphColor: "text-[#52525b]" },
  inferred: { glyph: "△", borderColor: "border-[#92400e]/40", glyphColor: "text-[#92400e]" },
  missing: { glyph: "○", borderColor: "border-[#71717a]/50", glyphColor: "text-[#71717a]", dashed: true },
};

// A single shared vocabulary for "what is this run doing right now."
export type HeroStatusTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const heroStatusStyle: Record<HeroStatusTone, string> = {
  waiting: "border-[#d4d4d8] text-[#71717a]",
  idle: "border-[#d4d4d8] text-[#71717a]",
  active: "border-[#1f9d52]/50 bg-[#1f9d52]/10 text-[#15803d]",
  complete: "border-[#1f9d52]/40 text-[#15803d]",
  failed: "border-[#b45309]/50 bg-[#b45309]/10 text-[#b45309]",
};

// APPLICATION SHELL — a very compact left rail and a quiet top bar, used
// by every authenticated route (see src/lib/design/app-shell.tsx).
export const rail = {
  container: "w-[60px] shrink-0 flex-col items-center gap-1 border-r border-[#e4e4e7] bg-white py-4",
  mark: "flex h-8 w-8 items-center justify-center rounded-full border border-[#1f9d52]/40 bg-[#1f9d52]/10 text-xs font-semibold text-[#15803d]",
  item: "flex h-9 w-9 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-[#f4f4f5] hover:text-[#18181b]",
  itemActive: "flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f4f5] text-[#18181b]",
  separator: "my-1 h-px w-6 bg-[#e4e4e7]",
};

export const topbar = {
  container: "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e4e4e7] bg-white/85 px-4 py-2.5 backdrop-blur-sm sm:px-6",
};

// The compact segmented view switcher (tabs-as-a-pill), used wherever a
// page has more than one mode of the same underlying thing.
export const segmented = {
  container: "inline-flex items-center gap-0.5 rounded-[10px] border border-[#e4e4e7] bg-[#f4f4f5] p-0.5",
  item: "rounded-[7px] px-2.5 py-1 text-xs font-medium text-[#71717a] transition-colors hover:text-[#18181b]",
  itemActive: "rounded-[7px] bg-white px-2.5 py-1 text-xs font-medium text-[#18181b] shadow-sm",
};

// A very subtle dot-grid — "not decorative noise", an engineering-surface
// cue behind a connected artifact flow.
export const canvasBackground =
  "[background-image:radial-gradient(circle,#e4e4e7_1px,transparent_1px)] [background-size:22px_22px]";

// The thin line + dot connecting two stacked artifacts.
export const connector = {
  line: "bg-[#d4d4d8]",
  dot: "border border-[#d4d4d8] bg-white",
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
  | "outcome";

export const artifact: Record<ArtifactKind, { label: string; accent: string; dashed?: boolean }> = {
  measurement: { label: "Measurement", accent: "border-l-[#18181b]/60" },
  deterministic: { label: "Deterministic", accent: "border-l-[#52525b]" },
  hypothesis: { label: "Inferred", accent: "border-l-[#92400e]" },
  missing: { label: "Missing evidence", accent: "border-l-[#71717a]", dashed: true },
  nextTest: { label: "Next test", accent: "border-l-[#1f9d52]" },
  observation: { label: "Observation", accent: "border-l-[#15803d]" },
  change: { label: "Engineering change", accent: "border-l-[#18181b]/60" },
  outcome: { label: "Measured outcome", accent: "border-l-[#1f9d52]" },
};

// Typography scale (UX-04): page title 20-24px, section heading 13-15px
// semibold, body 14-16px, metadata 12-13px, technical values mono
// 14-22px. Expressed as reusable class strings so every page's headings
// share one scale instead of each page picking its own size.
export const typography = {
  pageTitle: "text-xl font-semibold tracking-tight text-[#18181b] sm:text-2xl",
  sectionHeading: "text-sm font-semibold text-[#18181b]",
  body: "text-sm text-[#18181b] sm:text-base",
  metadata: "text-xs text-[#71717a]",
};
