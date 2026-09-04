// The before/after comparison (MVP-11) — "a strong comparison component".
// Purely presentational: every number here comes straight from
// compareMeasurements() (src/lib/measurements/compare-measurements.ts), a
// deterministic pure function with zero model involvement — this component
// never computes a delta itself, only formats one it's given. Never says
// PASS, FAIL, or CERTIFIED — margin is always phrased relative to the
// selected limit line, matching the ticket's explicit constraint.
import type { MeasurementComparison } from "@/lib/measurements/compare-measurements";
import { motion, surface, text } from "./theme";

interface RevisionComparisonCardProps {
  comparison: MeasurementComparison;
}

function marginPhrase(marginDb: number): string {
  const magnitude = Math.abs(marginDb).toFixed(1);
  return marginDb > 0
    ? `${magnitude} dB above selected limit`
    : marginDb < 0
      ? `${magnitude} dB below selected limit`
      : "at selected limit";
}

export function RevisionComparisonCard({ comparison }: RevisionComparisonCardProps) {
  const { before, after, deltaDb, improved, sameFrequency } = comparison;

  return (
    <section
      aria-labelledby="revision-comparison-heading"
      className={`flex flex-col gap-4 p-5 ${motion.rise} ${surface.panel}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="revision-comparison-heading" className={text.kicker}>
          Before / after comparison
        </h2>
        <span
          className={`text-2xl font-semibold sm:text-3xl ${text.mono} ${improved ? "text-success" : "text-warning"}`}
        >
          {deltaDb === 0 ? "No change" : `${improved ? "" : "-"}${Math.abs(deltaDb).toFixed(1)} dB`}
        </span>
      </div>

      {!sameFrequency ? (
        <p className={`text-xs ${text.muted}`}>
          These measurements were taken at different frequencies — shown for
          reference, not as a single before/after result.
        </p>
      ) : null}

      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-1 border border-border p-4">
          <span className={`${text.kicker} text-[10px]`}>Before · {before.revisionLabel}</span>
          <span className={`${text.mono} text-2xl`}>{before.frequencyMhz} MHz</span>
          <span className={`text-sm ${text.muted}`}>{marginPhrase(before.marginDb)}</span>
        </div>
        <span aria-hidden="true" className="hidden text-2xl text-muted-foreground sm:block">
          →
        </span>
        <div
          className={`flex flex-col gap-1 border p-4 ${
            improved ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
          }`}
        >
          <span className={`${text.kicker} text-[10px]`}>After · {after.revisionLabel}</span>
          <span className={`${text.mono} text-2xl`}>{after.frequencyMhz} MHz</span>
          <span className={`text-sm ${text.muted}`}>{marginPhrase(after.marginDb)}</span>
        </div>
      </div>

      <p className={`text-sm ${text.muted}`}>
        {deltaDb === 0
          ? "Margin unchanged. "
          : improved
            ? `Margin improved by ${Math.abs(deltaDb).toFixed(1)} dB. `
            : `Margin worsened by ${Math.abs(deltaDb).toFixed(1)} dB. `}
        {after.revisionLabel} is {marginPhrase(after.marginDb)} — an
        investigation finding, not a pass or certification result.
      </p>
    </section>
  );
}
