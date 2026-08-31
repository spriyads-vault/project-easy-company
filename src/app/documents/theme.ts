// Same restrained engineering-tool palette as the investigation workspace
// (src/app/cases/[caseId]/investigation/theme.ts), scoped to this route on
// purpose rather than shared — each screen owns its own theme file; this
// isn't a site-wide redesign.
export const surface = {
  page: "bg-[#0d0f0d] text-[#f3f1e8]",
  panel: "border border-[#262922] bg-[#131513]",
  panelElevated: "border border-[#31352c] bg-[#181a16]",
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
