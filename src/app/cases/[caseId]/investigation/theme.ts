// Shared visual language for the case-detail flow (UX-01: this now spans
// both /cases/[caseId] and /cases/[caseId]/investigation — a demo viewer's
// first impression starts on the case page, so it shares this theme rather
// than jumping from the app's default light shell into a differently-themed
// workspace).
//
// UX-02 re-themed near-black graphite → a light, spacious workspace palette.
// UX-03 keeps that exact palette (warm off-white canvas, white surfaces,
// charcoal text, restrained green, amber for a real warning) but replaces
// the *grammar* built on top of it: the previous "every section is a
// bordered rectangle, stacked vertically" shell is gone. In its place —
// an application rail + quiet top bar (rail/topbar/segmented below), a
// connected artifact canvas (canvas/connector/artifact below) where depth
// comes from shadow/radius/spacing instead of borders, and a contextual
// right rail. Every UX-01/02 export keeps its name and shape — no
// consuming component needed its logic touched for the parts that didn't
// change — except `nav`, which UX-03 retires: the underlined-tab treatment
// it styled is gone, replaced by the top bar's `segmented` view switcher.
// Scoped to this route family deliberately — the rest of the app (auth,
// workspace, product admin, /documents) keeps its existing shell; this
// isn't a site-wide redesign.
export const surface = {
  page: "bg-[#faf8f3] text-[#1c1a15]",
  // Still-boxed structural surfaces — the rail, the source drawer, empty
  // states, disabled/inline forms. Kept for the handful of places a hard
  // edge genuinely reads as "control", not "artifact".
  panel: "border border-[#e7e2d6] bg-[#ffffff]",
  panelElevated: "border border-[#ddd7c8] bg-[#ffffff]",
  hairline: "border-[#e7e2d6]",
  // UX-03: the investigation canvas's artifact nodes. Depth comes from a
  // soft shadow and a near-invisible hairline, not a 1px rectangle — "not
  // every surface needs a border" (ticket, Visual System). One shadow
  // recipe shared by every artifact kind so the canvas reads as one
  // consistent material, not eight different card styles.
  card: "rounded-2xl border border-[#efe9db] bg-white shadow-[0_1px_2px_rgba(28,26,21,0.04),0_10px_24px_-14px_rgba(28,26,21,0.14)]",
  // A quieter variant of `card` — no shadow, a barely-there fill — for
  // secondary/deprioritized content that still needs *some* visual
  // grouping (infrastructure metrics) without competing with the real
  // investigation artifacts for attention.
  cardQuiet: "rounded-2xl bg-[#f5f1e6]/60",
  // A floating surface that sits *above* the canvas rather than in its
  // flow — the composer, the confirmation artifact, open menus. Slightly
  // larger radius and a stronger shadow than a resting canvas card.
  floating: "rounded-[18px] border border-[#efe9db] bg-white shadow-[0_12px_36px_-10px_rgba(28,26,21,0.22)]",
};

export const text = {
  kicker: "text-[11px] font-medium uppercase tracking-[0.16em] text-[#847c6a]",
  muted: "text-[#6b6354]",
  mono: "font-mono tabular-nums",
};

export const accent = {
  green: "#1f9d52",
  greenText: "text-[#177a3f]",
  warn: "#a15a17",
  warnText: "text-[#a15a17]",
};

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f9d52]";

// UX-03: two radii, used deliberately differently ("do not make every item
// the same radius") — a tighter one for controls people click precisely
// (buttons, chips, inputs, the segmented switcher), a looser one for
// surfaces that hold content (artifact cards, the context rail, drawers).
export const radius = {
  control: "rounded-[10px]",
  card: "rounded-2xl",
  floating: "rounded-[18px]",
  pill: "rounded-full",
};

// UX-01: restrained, reduced-motion-safe entrance treatment. `.crado-rise`
// and friends are defined in globals.css behind
// `@media (prefers-reduced-motion: no-preference)` — with that preference
// set, no animation rule applies and the element simply renders in its
// final (opacity:1, no transform) state, since nothing outside the media
// query ever hides it. Never used for anything that would leave content
// invisible if the animation didn't run.
export const motion = {
  rise: "crado-rise",
  riseDelay1: "crado-rise [animation-delay:60ms]",
  riseDelay2: "crado-rise [animation-delay:120ms]",
  riseDelay3: "crado-rise [animation-delay:180ms]",
  slideIn: "crado-slide-in",
  // UX-03: the connector line between two artifact nodes drawing itself in
  // — always paired with `transform-origin: top` on the element (see
  // connector.tsx), never used standalone.
  connectorDraw: "crado-connector-draw",
};

// UX-01 signature evidence system (section 4): OBSERVED/KNOWN/INFERRED/
// MISSING must read as instantly distinguishable without leaving the
// warm-off-white + charcoal + restrained-green palette — no rainbow. Each gets
// its own glyph (never a decorative icon library — plain characters,
// consistent with the ✓/◌ already used for agent activity) plus a
// left-border treatment. OBSERVED and KNOWN are both "trustworthy, real"
// categories (solid border, filled glyph) but visually distinct from each
// other by glyph shape; INFERRED reads as provisional (dashed-adjacent
// italic); MISSING reads as an open gap (dashed border, hollow glyph).
export const evidence: Record<
  "observed" | "known" | "inferred" | "missing",
  { glyph: string; borderColor: string; glyphColor: string; dashed?: boolean }
> = {
  observed: { glyph: "●", borderColor: "border-[#177a3f]/50", glyphColor: "text-[#177a3f]" },
  known: { glyph: "◆", borderColor: "border-[#6b6354]/40", glyphColor: "text-[#6b6354]" },
  inferred: { glyph: "△", borderColor: "border-[#8a6d23]/40", glyphColor: "text-[#8a6d23]" },
  // UX-03 Artifact Design: "MISSING EVIDENCE — dashed / incomplete visual
  // treatment" — the one category whose border is dashed, not solid.
  missing: { glyph: "○", borderColor: "border-[#847c6a]/50", glyphColor: "text-[#847c6a]", dashed: true },
};

// A single shared vocabulary for "what is this run doing right now" — used
// by both the top bar's agent-status pill and InvestigationPanel's own
// status line, so the two can never drift into inconsistent wording.
export type HeroStatusTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const heroStatusStyle: Record<HeroStatusTone, string> = {
  waiting: "border-[#ddd7c8] text-[#6b6354]",
  idle: "border-[#ddd7c8] text-[#6b6354]",
  active: "border-[#1f9d52]/50 bg-[#1f9d52]/10 text-[#177a3f]",
  complete: "border-[#1f9d52]/40 text-[#177a3f]",
  failed: "border-[#a15a17]/50 bg-[#a15a17]/10 text-[#a15a17]",
};

// UX-03 APPLICATION SHELL — a very compact left rail (real destinations
// only: /workspace, /documents, /benchmarks, plus sign out — no invented
// "Cases" vs "Products" split the app doesn't actually have) and a quiet
// top bar that carries the breadcrumb, agent-status pill, and (on the
// investigation page) the view switcher, replacing the old plain-text
// breadcrumb header and the boxed agent-presence hero as separate stacked
// rows.
export const rail = {
  // No base `flex` here deliberately — app-shell.tsx toggles display itself
  // via `hidden sm:flex` (hidden below the mobile breakpoint, flex at and
  // above it); combining a bare `flex` with `hidden` in the same class
  // string is a well-known Tailwind footgun (same-specificity, unscoped
  // `display` utilities racing on generation order).
  container: "w-[60px] shrink-0 flex-col items-center gap-1 border-r border-[#e7e2d6] bg-white py-4",
  mark: "flex h-8 w-8 items-center justify-center rounded-full border border-[#1f9d52]/40 bg-[#1f9d52]/10 text-xs font-semibold text-[#177a3f]",
  item: "flex h-9 w-9 items-center justify-center rounded-lg text-[#6b6354] transition-colors hover:bg-[#f2ede1] hover:text-[#1c1a15]",
  separator: "my-1 h-px w-6 bg-[#e7e2d6]",
};

export const topbar = {
  container: "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e7e2d6] bg-white/85 px-4 py-2.5 backdrop-blur-sm sm:px-6",
};

// UX-03: the compact segmented view switcher that replaces the underlined
// tab row — Investigation / Evidence / Timeline / Sources are alternate
// views of one investigation, not separate pages (view-switcher.tsx keeps
// tab-switching as local state, never a navigation/fetch, exactly as
// case-nav.tsx did).
export const segmented = {
  container: "inline-flex items-center gap-0.5 rounded-[10px] border border-[#e7e2d6] bg-[#f5f1e6] p-0.5",
  item: "rounded-[7px] px-2.5 py-1 text-xs font-medium text-[#6b6354] transition-colors hover:text-[#1c1a15]",
  itemActive: "rounded-[7px] bg-white px-2.5 py-1 text-xs font-medium text-[#1c1a15] shadow-sm",
};

// UX-03 CANVAS: a very subtle dot-grid background — "not decorative
// noise", an engineering-surface cue — behind the connected artifact flow.
export const canvasBackground =
  "[background-image:radial-gradient(circle,#e5dfcf_1px,transparent_1px)] [background-size:22px_22px]";

// The thin line + dot connecting two stacked artifacts — connector.tsx is
// the one place this is drawn, so every connector in the canvas/timeline
// looks identical.
export const connector = {
  line: "bg-[#ddd7c8]",
  dot: "border border-[#ddd7c8] bg-[#faf8f3]",
};

// UX-03 ARTIFACT DESIGN: each step in the investigation chain gets its own
// label + accent so the canvas reads as "connected engineering
// investigation" at a glance — never a second color system, just the one
// already in use (charcoal / muted grey / amber-toned inferred / green)
// applied consistently per kind. `dashed` marks the one deliberately
// "incomplete" kind (missing evidence).
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
  measurement: { label: "Measurement", accent: "border-l-[#1c1a15]/60" },
  deterministic: { label: "Deterministic", accent: "border-l-[#6b6354]" },
  hypothesis: { label: "Inferred", accent: "border-l-[#8a6d23]" },
  missing: { label: "Missing evidence", accent: "border-l-[#847c6a]", dashed: true },
  nextTest: { label: "Next test", accent: "border-l-[#1f9d52]" },
  observation: { label: "Observation", accent: "border-l-[#177a3f]" },
  change: { label: "Engineering change", accent: "border-l-[#1c1a15]/60" },
  outcome: { label: "Measured outcome", accent: "border-l-[#1f9d52]" },
};
