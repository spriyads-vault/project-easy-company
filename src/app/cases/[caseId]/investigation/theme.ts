// Shared visual language for the case-detail flow (UX-01: this now spans
// both /cases/[caseId] and /cases/[caseId]/investigation — a demo viewer's
// first impression starts on the case page, so it shares this theme rather
// than jumping from the app's default light shell into a differently-themed
// workspace).
//
// UX-02: re-themed from the original near-black graphite palette to a
// light, spacious "agentic engineering workspace" — warm off-white canvas,
// white surfaces, charcoal text, restrained green as the one accent, and
// amber reserved for a measurement that's actually above the limit. Every
// token below kept its name and shape (surface.panel, text.kicker,
// accent.warnText, evidence[...], heroStatusStyle[...], etc.) — only the
// hex values changed — so no consuming component needed its logic touched,
// only this file. Scoped to this route family deliberately — the rest of
// the app (auth, workspace, product admin, /documents) keeps its existing
// theme; this isn't a site-wide redesign.
export const surface = {
  page: "bg-[#faf8f3] text-[#1c1a15]",
  panel: "border border-[#e7e2d6] bg-[#ffffff]",
  panelElevated: "border border-[#ddd7c8] bg-[#ffffff]",
  hairline: "border-[#e7e2d6]",
};

// UX-02: the quiet top nav's tab row (Investigation / Evidence / Timeline /
// Sources) — plain text, not boxy buttons, distinguished only by an
// underline and text-weight/color shift on the active tab.
export const nav = {
  tab: "border-b-2 border-transparent px-1 pb-3 text-sm text-[#6b6354] transition-colors hover:text-[#1c1a15]",
  tabActive: "border-b-2 border-[#1f9d52] px-1 pb-3 text-sm font-medium text-[#1c1a15]",
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
// warm-off-white + charcoal + restrained-green palette — no rainbow. Each gets
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
  observed: { glyph: "●", borderColor: "border-[#177a3f]/50", glyphColor: "text-[#177a3f]" },
  known: { glyph: "▪", borderColor: "border-[#6b6354]/40", glyphColor: "text-[#6b6354]" },
  inferred: { glyph: "◆", borderColor: "border-[#8a6d23]/40", glyphColor: "text-[#8a6d23]" },
  missing: { glyph: "○", borderColor: "border-[#847c6a]/50", glyphColor: "text-[#847c6a]" },
};

// A single shared vocabulary for "what is this run doing right now" — used
// by both the investigation hero (section 2) and InvestigationPanel's own
// status line, so the two can never drift into inconsistent wording.
export type HeroStatusTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const heroStatusStyle: Record<HeroStatusTone, string> = {
  waiting: "border-[#ddd7c8] text-[#6b6354]",
  idle: "border-[#ddd7c8] text-[#6b6354]",
  active: "border-[#1f9d52]/50 bg-[#1f9d52]/10 text-[#177a3f]",
  complete: "border-[#1f9d52]/40 text-[#177a3f]",
  failed: "border-[#a15a17]/50 bg-[#a15a17]/10 text-[#a15a17]",
};
