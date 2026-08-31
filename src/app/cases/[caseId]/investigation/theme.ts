// Shared visual language for the investigation workspace only (CLAUDE.md:
// near-black graphite, warm high-contrast white, restrained green, thin
// technical borders, monospace measurements, engineering-tool density).
// Scoped to this route deliberately — the rest of the app keeps its
// existing minimal theme; this isn't a site-wide redesign.
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
