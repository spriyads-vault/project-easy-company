// DETERMINISTIC RELATIONSHIP artifact (UX-03, promoted to the Decision
// view's reasoning object in UX-07): a compact mathematical object — must
// visually read as arithmetic, not as an AI opinion. Labeled "Candidate
// relationship" deliberately, never "root cause" (see CLAUDE.md "Product
// truth": a harmonic match is a coincidence worth investigating, not a
// diagnosis). This is a deterministic engine output (MVP-06) — the card's
// whole visual job is to look calculated, not inferred, which is why the
// equation is the single largest thing on it and every supporting fact
// underneath stays monospace.
//
// UX-07: carries its own "State" (always "Verified" — the calculation
// itself is complete/reproducible, distinct from a hypothesis's
// confidence/strength) directly on the object, replacing the retired
// InvestigationItemTable's "State" column — see decision-view.tsx and
// docs/PROGRESS.md's UX-07 entry for why that table was retired.
import type { CorrelationFoundPayload } from "@/lib/analysis/events";
import { artifact, focusRing, motion, surface, text } from "./theme";

interface CorrelationCardProps {
  correlation: CorrelationFoundPayload;
  /** UX-07: makes the whole card a selectable target (mirrors
   * HypothesisCard's existing onSelect) — wires into the same
   * ContextRail selection every other artifact already supports.
   * Optional/undefined keeps every pre-UX-07 call site (this component's
   * own tests) rendering a plain, non-interactive card exactly as before. */
  onSelect?: () => void;
  isSelected?: boolean;
}

export function CorrelationCard({ correlation, onSelect, isSelected = false }: CorrelationCardProps) {
  const deviationLabel =
    correlation.deviationRatio === 0
      ? "exact match"
      : `${(correlation.deviationRatio * 100).toFixed(3)}% deviation`;
  const style = artifact.deterministic;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={text.kicker}>{style.label} relationship</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Candidate relationship
        </span>
      </div>

      <p className={`text-2xl font-semibold sm:text-3xl ${text.mono}`}>
        {correlation.sourceFrequencyMhz} MHz × {correlation.harmonicNumber} ={" "}
        {correlation.expectedFrequencyMhz} MHz
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className={text.muted}>Source</dt>
        <dd>
          ProductFact · {correlation.productFactCategory} · {correlation.productFactLabel}
        </dd>
        <dt className={text.muted}>Observed</dt>
        <dd className={text.mono}>{correlation.measuredFrequencyMhz} MHz peak</dd>
        <dt className={text.muted}>Deviation</dt>
        <dd className={text.mono}>{deviationLabel}</dd>
        <dt className={text.muted}>State</dt>
        <dd className="text-foreground">Verified — deterministic check</dd>
      </dl>
    </>
  );

  const containerClass = `flex flex-col gap-3 border-l-2 p-4 ${style.accent} ${motion.rise} ${surface.card} ${
    isSelected ? "ring-1 ring-primary/50" : ""
  }`;

  if (!onSelect) {
    return <div className={containerClass}>{body}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer text-left ${containerClass} ${focusRing}`}
    >
      {body}
    </div>
  );
}
