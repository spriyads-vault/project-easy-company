// DETERMINISTIC RELATIONSHIP artifact (UX-03, promoted to the Decision
// view's reasoning object in UX-07, restyled by the UX-07 correction): a
// compact mathematical object — must visually read as arithmetic, not as
// an AI opinion. Labeled "Candidate relationship" deliberately, never
// "root cause" (see CLAUDE.md "Product truth": a harmonic match is a
// coincidence worth investigating, not a diagnosis). This is a
// deterministic engine output (MVP-06).
//
// UX-07 correction: the equation used to be the single largest thing on
// the card (text-2xl/3xl) — the correction ticket's fixed type scale
// caps every technical value, equations included, at 13px monospace, so
// the card no longer shouts its result; it reads it out plainly, like a
// line in a lab notebook. "Candidate relationship" is no longer a pill
// badge — folded into the eyebrow line as plain text, matching
// hypothesis-card.tsx's own eyebrow treatment (a pill implies a
// precision this qualifier doesn't carry either).
//
// UX-07: carries its own "State" (always "Verified" — the calculation
// itself is complete/reproducible, distinct from a hypothesis's
// confidence/strength) directly on the object, replacing the retired
// InvestigationItemTable's "State" column — see decision-view.tsx and
// docs/PROGRESS.md's UX-07 entry for why that table was retired.
import type { CorrelationFoundPayload } from "@/lib/analysis/events";
import { artifact, focusRing, motion, surface } from "./theme";
import { bodyText, sectionLabel, technicalValue } from "./reasoning-typography";

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
      <div className={`flex flex-wrap items-baseline gap-x-1 ${sectionLabel}`}>
        <span>{style.label} relationship</span>
        <span aria-hidden="true">·</span>
        <span>Candidate relationship</span>
      </div>

      <p className={`${technicalValue} font-medium`}>
        {correlation.sourceFrequencyMhz} MHz × {correlation.harmonicNumber} ={" "}
        {correlation.expectedFrequencyMhz} MHz
      </p>

      <dl className="grid grid-cols-[96px_1fr] items-baseline gap-x-3 gap-y-1.5">
        <dt className={sectionLabel}>Source</dt>
        <dd className={bodyText}>
          ProductFact · {correlation.productFactCategory} · {correlation.productFactLabel}
        </dd>
        <dt className={sectionLabel}>Observed</dt>
        <dd className={technicalValue}>{correlation.measuredFrequencyMhz} MHz peak</dd>
        <dt className={sectionLabel}>Deviation</dt>
        <dd className={technicalValue}>{deviationLabel}</dd>
        <dt className={sectionLabel}>State</dt>
        <dd className={bodyText}>Verified — deterministic check</dd>
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
