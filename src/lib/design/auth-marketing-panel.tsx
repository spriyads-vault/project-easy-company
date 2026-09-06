// UX-14 (right panel rebuilt against the same reference HTML file
// UX-13 was working from a screenshot of): the panel's colour, node
// layout, connector and status-row treatment all diverged from what
// the actual reference markup/CSS specify — UX-13 approximated by eye
// from a screenshot; this pass reads the HTML/CSS directly and copies
// literal values (gradient stops, coordinates, the SVG path, keyframe
// timings) instead of re-deriving them. The pill badge and headline
// above the diagram were not flagged as wrong and are unchanged.
//
// Colour: `.auth-panel-gradient` (globals.css) is the reference's own
// two-layer radial-gradient background, values copied verbatim. No new
// hue introduced by this file — the literal stops live in globals.css,
// same "no literal hex in component files" rule as everywhere else.
//
// Node layout/connector: centre-anchored positioning (UX-13's own fix
// for a different, now-superseded layout) is replaced with the
// reference's literal edge-anchored coordinates, inside a container
// that itself insets 8%/7% from the panel's own edges — the reference's
// own mechanism for keeping edge-anchored boxes off the panel boundary.
// Verified via live screenshot at 1280px (this ticket's own requirement)
// that nothing clips.
//
// Node content: index/label match the reference's four values, and so
// do "Measurement"/"Verified" and "Evidence"/"Linked" (Verified/Linked
// are honest, non-regulatory status words). "Decision"/"Approved" is
// the one reference value NOT carried over — Crado records engineering
// decisions, it does not issue compliance approval (CLAUDE.md: "Never
// claim definitive automated root-cause diagnosis" / hypotheses are
// investigation hypotheses, not compliance verdicts). This exact
// substitution ("Recorded" instead of "Approved") was made and
// defended in UX-12 and UX-13; auth-shell.test.tsx has asserted
// "approved" never appears on this page since UX-12. "R-184" (the
// reference's placeholder revision id) is replaced with Rev17, the
// seeded Gateway X case's real revision label — the ticket's own
// instruction ("keep the real Crado values already in use for
// revision").
//
// Status rows: the reference's own copy ("Tracing.../Done/Done") is
// fabricated live-progress theatre for an anonymous, unauthenticated
// visitor with no case and nothing actually being traced — kept the
// reference's exact VISUAL treatment (an active pulsing state, two
// "settled" states, the third visually faded) but not its literal
// wording: the faded row is honestly labelled "Pending" rather than a
// faded "Done" (the reference's own copy is internally inconsistent —
// "Done" while visually implying "hasn't happened" — this fixes that
// rather than reproducing it), and the three sentences are the same
// fact-checked architecture statements UX-12/13 already verified
// against real code.
const TRACE_NODES: ReadonlyArray<{
  index: string;
  label: string;
  value: string;
  className: string;
  delay: string;
}> = [
  { index: "01", label: "Revision", value: "Rev17", className: "left-0 top-[52%]", delay: "0s" },
  { index: "02", label: "Measurement", value: "Verified", className: "left-[23%] top-[1%]", delay: "-0.8s" },
  { index: "03", label: "Evidence", value: "Linked", className: "left-[54%] top-[58%]", delay: "-1.6s" },
  { index: "04", label: "Decision", value: "Recorded", className: "right-0 top-[8%]", delay: "-2.4s" },
];

// The reference's own curve, viewBox and gradient/glow-filter ids,
// copied literally (`M38 152C132 152 120 66 218 66s92 101 190 101S514
// 82 660 82`, viewBox `0 0 700 230`).
const TRACE_PATH = "M38 152C132 152 120 66 218 66s92 101 190 101S514 82 660 82";

const STATUS_ROWS: ReadonlyArray<{
  text: string;
  chip: string;
  chipDot: "pulse-active" | "done" | "pending";
  cardClassName: string;
  textClassName: string;
}> = [
  {
    text: "Measurement evidence linked to the product revision it was taken against",
    chip: "Correlating",
    chipDot: "pulse-active",
    cardClassName: "border-white/30 bg-white/20",
    textClassName: "text-white",
  },
  {
    text: "Deterministic checks kept separate from AI inference",
    chip: "Verified",
    chipDot: "done",
    cardClassName: "border-white/20 bg-white/15",
    textClassName: "text-white/80",
  },
  {
    text: "Investigation decisions recorded against the evidence that supported them",
    chip: "Pending",
    chipDot: "pending",
    cardClassName: "border-white/10 bg-white/10 opacity-60",
    textClassName: "text-white/65",
  },
];

export function AuthMarketingPanel() {
  return (
    <div className="auth-panel-gradient relative flex h-full w-full flex-col overflow-hidden">
      <div aria-hidden="true" className="auth-panel-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex h-full w-full flex-col p-10 lg:p-14 xl:p-16">
        <span className="inline-flex w-fit items-center rounded-full border border-blue-900/10 bg-white/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-950/65 backdrop-blur">
          Engineering assurance · continuous traceability
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

        {/* The trace diagram — reference's own container inset (8%/7%
            from the panel edges) plus its literal edge-anchored node
            coordinates and curve. */}
        <div className="absolute left-[8%] right-[7%] top-[42%] h-[230px]" aria-hidden="true">
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 700 230" fill="none">
            <defs>
              <linearGradient id="auth-trace-line" x1="30" y1="120" x2="670" y2="120">
                <stop stopColor="white" stopOpacity="0.25" />
                <stop offset="0.46" stopColor="white" stopOpacity="0.95" />
                <stop offset="1" stopColor="#173FBC" stopOpacity="0.48" />
              </linearGradient>
              <filter id="auth-trace-glow-filter">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            <path
              d={TRACE_PATH}
              stroke="url(#auth-trace-line)"
              strokeWidth="2"
              strokeDasharray="7 8"
              className="auth-trace-path"
            />
            <path
              d={TRACE_PATH}
              stroke="white"
              strokeOpacity="0.35"
              strokeWidth="9"
              filter="url(#auth-trace-glow-filter)"
              className="auth-trace-glow opacity-30"
            />
            <circle r="6" fill="white" className="auth-trace-particle drop-shadow-[0_0_8px_white]">
              <animateMotion dur="7s" repeatCount="indefinite" path={TRACE_PATH} />
            </circle>
          </svg>

          {TRACE_NODES.map((node) => (
            <div
              key={node.label}
              className={`auth-trace-node absolute flex min-w-[120px] flex-col rounded-[14px] border border-white/[.28] bg-white/[.13] py-3 pl-[42px] pr-3.5 shadow-[0_16px_45px_rgba(24,64,176,0.14)] backdrop-blur-[14px] ${node.className}`}
              style={{ animationDelay: node.delay }}
            >
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-white/[.52]">
                {node.index}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/60">{node.label}</span>
              <strong className="mt-1 text-[13px] font-semibold text-white">{node.value}</strong>
            </div>
          ))}

          {/* The reference's horizontal light-sweep drifting across the
              diagram — ported as-is, gated with everything else. */}
          <div
            className="auth-trace-scan absolute -top-5 -bottom-5 left-0 w-[110px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] blur-[2px]"
          />

          {/* The "larger ringed pulse marker at the curve's midpoint" —
              the reference's own .trace-orbit element, a slowly
              rotating double ring with a glowing centre dot. */}
          <div className="auth-trace-orbit absolute left-[30%] top-[39%] h-16 w-16 rounded-full border border-white/30 bg-white/10 backdrop-blur-md">
            <div className="absolute inset-[10px] rounded-full border border-white/[.35]" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_white]" />
          </div>
        </div>

        <div className="flex-1" />

        <div className="relative z-20 flex w-full max-w-[660px] flex-col gap-3">
          {STATUS_ROWS.map((row) => (
            <div
              key={row.text}
              className={`flex items-center justify-between rounded-2xl border p-4 backdrop-blur-md ${row.cardClassName}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    row.chipDot === "pulse-active"
                      ? "bg-white/70"
                      : row.chipDot === "done"
                        ? "bg-white/50"
                        : "bg-white/30"
                  }`}
                  aria-hidden="true"
                />
                <span className={`text-[13px] font-medium tracking-wide ${row.textClassName}`}>{row.text}</span>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                <span className="text-[11px] font-semibold text-white/90">{row.chip}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    row.chipDot === "pulse-active"
                      ? "auth-status-pulse bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
                      : row.chipDot === "done"
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        : "bg-white/30"
                  }`}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
