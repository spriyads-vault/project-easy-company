// Shared visual language for the case-detail flow (UX-01: this now spans
// both /cases/[caseId] and /cases/[caseId]/investigation — a demo viewer's
// first impression starts on the case page, so it shares this theme rather
// than jumping from the app's default light shell into a differently-themed
// workspace). Near-black graphite, warm high-contrast white, restrained
// green, thin technical borders, monospace measurements, engineering-tool
// density. Scoped to this route family deliberately — the rest of the app
// (auth, workspace, product admin) keeps its existing minimal theme; this
// isn't a site-wide redesign.
export const surface = {
  page: "bg-[#0d0f0d] text-[#f3f1e8]",
  panel: "border border-[#262922] bg-[#131513]",
  panelElevated: "border border-[#31352c] bg-[#181a16]",
  hairline: "border-[#262922]",
};

export const text = {
  kicker: "text-[11px] font-medium uppercase tracking-[0.16em] text-[#8f8d84]",
  muted: "text-[#9a9890]",
  mono: "font-mono tabular-nums",
};

export const accent = {
  green: "#3ecf6e",
  greenText: "text-[#5fdb87]",
  warn: "#d97a4d",
  warnText: "text-[#e0916a]",
};

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf6e]";

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
};

// UX-01 signature evidence system (section 4): OBSERVED/KNOWN/INFERRED/
// MISSING must read as instantly distinguishable without leaving the
// graphite + warm-white + restrained-green palette — no rainbow. Each gets
// its own glyph (never a decorative icon library — plain characters,
// consistent with the ✓/◌ already used for agent activity) plus a
// left-border treatment. OBSERVED and KNOWN are both "trustworthy, real"
// categories (solid border, filled glyph) but visually distinct from each
// other by glyph shape; INFERRED reads as provisional (dashed-adjacent
// italic); MISSING reads as an open gap (dashed border, hollow glyph).
export const evidence: Record<
  "observed" | "known" | "inferred" | "missing",
  { glyph: string; borderColor: string; glyphColor: string }
> = {
  observed: { glyph: "●", borderColor: "border-[#5fdb87]/50", glyphColor: "text-[#5fdb87]" },
  known: { glyph: "▪", borderColor: "border-[#c8c6bb]/40", glyphColor: "text-[#c8c6bb]" },
  inferred: { glyph: "◆", borderColor: "border-[#e0c56a]/40", glyphColor: "text-[#e0c56a]" },
  missing: { glyph: "○", borderColor: "border-[#6f6d65]/50", glyphColor: "text-[#6f6d65]" },
};

// A single shared vocabulary for "what is this run doing right now" — used
// by both the investigation hero (section 2) and InvestigationPanel's own
// status line, so the two can never drift into inconsistent wording.
export type HeroStatusTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const heroStatusStyle: Record<HeroStatusTone, string> = {
  waiting: "border-[#3a3d34] text-[#9a9890]",
  idle: "border-[#3a3d34] text-[#c8c6bb]",
  active: "border-[#3ecf6e]/50 bg-[#3ecf6e]/10 text-[#5fdb87]",
  complete: "border-[#3ecf6e]/40 text-[#5fdb87]",
  failed: "border-[#e0916a]/50 bg-[#e0916a]/10 text-[#e0916a]",
};
