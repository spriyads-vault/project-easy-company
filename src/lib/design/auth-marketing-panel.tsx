// UX-13 (auth pages rebuilt against a supplied reference screenshot):
// replaces UX-12's panel wholesale. The reference's panel is a pale
// blue diagonal gradient (light top-left, deeper bottom-right) with a
// faint diagonal grid, a pill label, a dark headline, four nodes
// connected by a soft curve that passes BEHIND them, and three
// translucent status rows each with a state chip.
//
// Colour: every fill here resolves through the frozen `--auth-panel-*`
// tokens (globals.css) — mixed from the app's existing --primary
// (#4f46e5) toward white at increasing strength for the gradient, not
// a new hue. These pages are light-only (no dark variant), so unlike
// the old bg-primary/text-primary-foreground pairing this replaces,
// nothing here reads the theme-reactive --primary tokens.
//
// Layout: nodes are centre-anchored (percentage left/top plus
// -translate-x-1/2 -translate-y-1/2), not edge-anchored like the
// previous pass's `left-0`/`right-0` nodes were — a box that grows to
// fit its own label grows symmetrically around a safe centre point
// instead of extending in one direction toward a container edge, which
// is what let "Measurement" clip past the panel's own overflow bound
// before. The connector path is drawn first (z-order), nodes after
// with a mostly-opaque fill, so the curve visually passes behind them
// without needing an explicit z-index. The panel itself is hidden
// below 1024px (AuthShell), so the narrowest width this diagram has to
// survive is 1024px, not the previous pass's 768px.
//
// Content: every node value and status line is a real, already-shipped
// capability or a real seeded example, not invented marketing copy —
// see the inline comment on each. Status chips read a uniform
// "Verified" rather than the reference's fabricated live
// "Tracing…/Done" status theatre — these describe shipped, tested
// behaviour, not something computed per visitor.
const TRACE_NODES: ReadonlyArray<{ index: string; label: string; value: string; left: number; top: number }> = [
  // Rev17 is the seeded Gateway X case's real revision label (same
  // fixture UX-10/UX-11/UX-12 already verified against
  // scripts/seed-gateway-x.mjs).
  { index: "01", label: "Revision", value: "Rev17", left: 9, top: 78 },
  // "Logged" / "Linked" / "Recorded" are honest generic status words for
  // real schema relationships (Measurement, EvidenceItem,
  // InvestigationEvent — see docs/PROGRESS.md's core domain objects),
  // not a specific live metric or a compliance verdict — deliberately
  // not "Approved": Crado records engineering decisions, it does not
  // issue compliance sign-off.
  { index: "02", label: "Measurement", value: "Logged", left: 38, top: 22 },
  { index: "03", label: "Evidence", value: "Linked", left: 68, top: 78 },
  { index: "04", label: "Decision", value: "Recorded", left: 91, top: 22 },
];

// Two small glow markers along the connector, roughly at the curve's
// midpoints between node pairs — purely decorative, same convention as
// the old particle/glow-path pair this replaces.
const GLOW_WAYPOINTS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 190, cy: 130 },
  { cx: 618, cy: 130 },
];

const STATUS_ROWS: ReadonlyArray<{ text: string }> = [
  // True, shipped, verified this session: harmonic-correlation.ts and
  // compare-measurements.ts are plain deterministic TypeScript, no model
  // call; hypothesis generation is the separate, explicitly-labelled
  // inferred step — exactly the OBSERVED/KNOWN/INFERRED/MISSING split
  // CLAUDE.md requires.
  { text: "Deterministic checks kept separate from AI inference" },
  { text: "Measurement evidence linked to the product revision it was taken against" },
  { text: "Investigation decisions recorded against the evidence that supported them" },
];

export function AuthMarketingPanel() {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-[linear-gradient(135deg,var(--auth-panel-from)_0%,var(--auth-panel-via)_45%,var(--auth-panel-to)_100%)]"
    >
      <div aria-hidden="true" className="auth-panel-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex h-full w-full flex-col p-10 lg:p-14 xl:p-16">
        <span className="inline-flex w-fit items-center rounded-full border border-auth-panel-node-border bg-auth-panel-node-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-auth-foreground">
          Engineering assurance · Continuous traceability
        </span>

        <div className="mt-5 flex max-w-[520px] flex-col gap-3">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-tight text-auth-foreground lg:text-[38px]">
            Regulation, inside the engineering loop.
          </h2>
          <p className="max-w-[440px] text-sm leading-relaxed text-auth-foreground/70">
            Connect product revisions, measurements, evidence and engineering decisions in one
            traceable investigation record.
          </p>
        </div>

        {/* The trace diagram — a curved connector drawn behind 4
            centre-anchored node chips. */}
        <div className="relative mt-14 h-[220px] w-full max-w-[720px]" aria-hidden="true">
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 800 260" fill="none">
            <path
              d="M72 203 C160 203 216 57 304 57 S456 203 544 203 S656 57 728 57"
              stroke="var(--auth-panel-line)"
              strokeOpacity="0.85"
              strokeWidth="2"
              strokeDasharray="7 8"
              className="auth-trace-path"
            />
            {GLOW_WAYPOINTS.map((point) => (
              <circle
                key={`${point.cx}-${point.cy}`}
                cx={point.cx}
                cy={point.cy}
                r="4"
                fill="var(--auth-panel-line)"
                className="auth-trace-glow"
              />
            ))}
          </svg>

          {TRACE_NODES.map((node) => (
            <div
              key={node.label}
              className="absolute flex min-w-[112px] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-2xl border border-auth-panel-node-border bg-auth-panel-node-bg px-3.5 py-2.5 backdrop-blur-[2px]"
              style={{ left: `${node.left}%`, top: `${node.top}%` }}
            >
              <span className="text-[10px] font-medium text-auth-foreground/55">{node.index}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-auth-foreground/70">{node.label}</span>
              <span className="text-[13px] font-semibold text-auth-foreground">{node.value}</span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative z-20 flex w-full max-w-[600px] flex-col gap-2.5">
          {STATUS_ROWS.map((row) => (
            <div
              key={row.text}
              className="flex items-center gap-3 rounded-xl border border-auth-panel-row-border bg-auth-panel-row-bg px-4 py-3"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
              <span className="flex-1 text-[13px] font-medium text-auth-panel-line/90">{row.text}</span>
              <span className="shrink-0 rounded-full border border-auth-panel-row-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-auth-panel-line/80">
                Verified
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
