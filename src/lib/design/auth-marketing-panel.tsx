// UX-12 (auth page redesign, ported from a supplied HTML reference):
// the right-hand marketing panel. Static — identical on /login and
// /signup, exactly like the reference file (its marketing panel never
// varied by mode either).
//
// Colour: the reference's panel is a saturated blue gradient with white
// text/glass chips. Ported onto this app's --primary/--primary-foreground
// pair rather than literal blue/white — that pair is already the
// documented "primary actions/selection" accent (globals.css) and is
// specifically designed for readable text-on-fill contrast in both
// themes, which a literal white-on-blue pairing is not (dark theme's
// --primary is a light periwinkle; white text on it would fail
// contrast). Every colour in this file resolves through --primary/
// --primary-foreground — no literal hex, no new token.
//
// Simplified from the reference: kept the connected trace-chain (path +
// drifting particle + gently breathing node chips) since it's the clear
// visual expression of "traceability" this product is actually about.
// Dropped the reference's orbiting glow ring, blurred horizontal scan
// sweep, and isometric background grid — purely decorative embellishments
// beyond what "match visually" needs, in tension with CLAUDE.md's near-
// monochrome/no-glow guidance (which this panel otherwise departs from
// only because it was supplied as an explicit visual source of truth),
// and, for the 3D-transformed grid specifically, expensive enough to
// composite (backdrop-blur + a perspective transform + a blend mode,
// live-verified to make headless screenshot capture hang) that it
// wasn't worth keeping for a purely cosmetic texture.
//
// Content: every node value and status line below is a real, already-
// shipped capability or a real seeded example, not invented marketing
// copy — see the inline comment on each.
const TRACE_NODES: ReadonlyArray<{ index: string; label: string; value: string; style: string }> = [
  // Rev17 is the seeded Gateway X case's real revision label (same
  // fixture UX-10/UX-11 already verified against scripts/seed-gateway-x.mjs).
  { index: "01", label: "Revision", value: "Rev17", style: "left-0 top-[58%]" },
  // "Logged" / "Linked" / "Recorded" are honest generic status words for
  // real schema relationships (Measurement, EvidenceItem, InvestigationEvent
  // — see docs/PROGRESS.md's core domain objects), not a specific live
  // metric or a compliance verdict — deliberately not "Approved": Crado
  // records engineering decisions, it does not issue compliance sign-off.
  { index: "02", label: "Measurement", value: "Logged", style: "left-[27%] top-[8%]" },
  { index: "03", label: "Evidence", value: "Linked", style: "left-[58%] top-[64%]" },
  { index: "04", label: "Decision", value: "Recorded", style: "right-0 top-[16%]" },
];

const STATUS_ROWS: ReadonlyArray<{ text: string; dot: "success" | "neutral" }> = [
  // True, shipped, verified this session: harmonic-correlation.ts and
  // compare-measurements.ts are plain deterministic TypeScript, no model
  // call; hypothesis generation is the separate, explicitly-labelled
  // inferred step — exactly the OBSERVED/KNOWN/INFERRED/MISSING split
  // CLAUDE.md requires. --success is used here because this is a
  // completed, shipped capability, not a live per-visitor status.
  { text: "Deterministic checks kept separate from AI inference", dot: "success" },
  { text: "Measurement evidence linked to the product revision it was taken against", dot: "neutral" },
  { text: "Investigation decisions recorded against the evidence that supported them", dot: "neutral" },
];

export function AuthMarketingPanel() {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-primary">
      {/* Two soft radial highlights — the reference's glow, ported as
          low-opacity --primary-foreground layers over the flat
          --primary fill so text-primary-foreground stays legible
          everywhere in the panel, in both themes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,color-mix(in_srgb,var(--primary-foreground)_16%,transparent),transparent_45%),radial-gradient(circle_at_10%_85%,color-mix(in_srgb,var(--primary-foreground)_10%,transparent),transparent_50%)]"
      />
      <div className="relative z-10 flex h-full w-full flex-col p-10 lg:p-14 xl:p-16">
        <div className="flex max-w-[560px] flex-col gap-4">
          <h2 className="text-[32px] font-semibold leading-[1.05] tracking-tight text-primary-foreground lg:text-[40px]">
            Regulation, inside the engineering loop.
          </h2>
          <p className="max-w-[460px] text-sm leading-relaxed text-primary-foreground/75">
            Connect product revisions, measurements, evidence and engineering decisions in one
            traceable investigation record.
          </p>
        </div>

        {/* The trace chain — an SVG connecting path plus 4 absolutely
            positioned node chips, laid out over a fixed-aspect box so
            both scale together. */}
        <div className="relative mt-16 h-[190px] w-full max-w-[640px]" aria-hidden="true">
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 700 220" fill="none">
            <path
              d="M40 128 C140 128 140 40 240 40 S340 132 440 132 S560 48 650 48"
              stroke="var(--primary-foreground)"
              strokeOpacity="0.9"
              strokeWidth="2"
              strokeDasharray="7 8"
              className="auth-trace-path"
            />
            <path
              d="M40 128 C140 128 140 40 240 40 S340 132 440 132 S560 48 650 48"
              stroke="var(--primary-foreground)"
              strokeOpacity="0.3"
              strokeWidth="8"
              className="auth-trace-path-glow"
            />
            <circle r="5" fill="var(--primary-foreground)" className="auth-trace-particle">
              <animateMotion
                dur="7s"
                repeatCount="indefinite"
                path="M40 128 C140 128 140 40 240 40 S340 132 440 132 S560 48 650 48"
              />
            </circle>
          </svg>

          {TRACE_NODES.map((node, i) => (
            <div
              key={node.label}
              className={`auth-trace-node absolute flex min-w-[108px] flex-col gap-0.5 rounded-2xl border border-primary-foreground/25 bg-primary-foreground/10 px-3.5 py-2.5 ${node.style}`}
              style={{ animationDelay: `${-i * 0.8}s` }}
            >
              <span className="text-[10px] font-medium text-primary-foreground/50">{node.index}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-primary-foreground/60">
                {node.label}
              </span>
              <span className="text-[13px] font-semibold text-primary-foreground">{node.value}</span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative z-20 flex w-full max-w-[600px] flex-col gap-2.5">
          {STATUS_ROWS.map((row) => (
            <div
              key={row.text}
              className="flex items-center gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-3"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${row.dot === "success" ? "bg-success" : "bg-primary-foreground/40"}`}
                aria-hidden="true"
              />
              <span className="text-[13px] font-medium text-primary-foreground/90">{row.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
