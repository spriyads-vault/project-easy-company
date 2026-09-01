// The before/after comparison (MVP-11) — "a strong comparison component".
// Purely presentational: every number here comes straight from
// compareMeasurements() (src/lib/measurements/compare-measurements.ts), a
// deterministic pure function with zero model involvement — this component
// never computes a delta itself, only formats one it's given. Never says
// PASS, FAIL, or CERTIFIED — margin is always phrased relative to the
// selected limit line, matching the ticket's explicit constraint.
import type { MeasurementComparison } from "@/lib/measurements/compare-measurements";
import { surface, text } from "./theme";

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
      className={`flex flex-col gap-4 p-5 ${surface.panel}`}
    >
      <h2 id="revision-comparison-heading" className={text.kicker}>
        Before / after comparison
      </h2>

      {!sameFrequency ? (
        <p className={`text-xs ${text.muted}`}>
          These measurements were taken at different frequencies — shown for
          reference, not as a single before/after result.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 border border-[#262922] p-3">
          <span className={`${text.kicker} text-[10px]`}>Before · {before.revisionLabel}</span>
          <span className={`${text.mono} text-lg`}>{before.frequencyMhz} MHz</span>
          <span className={`text-sm ${text.muted}`}>{marginPhrase(before.marginDb)}</span>
        </div>
        <div className="flex flex-col gap-1 border border-[#262922] p-3">
          <span className={`${text.kicker} text-[10px]`}>After · {after.revisionLabel}</span>
          <span className={`${text.mono} text-lg`}>{after.frequencyMhz} MHz</span>
          <span className={`text-sm ${text.muted}`}>{marginPhrase(after.marginDb)}</span>
        </div>
        <div
          className={`flex flex-col gap-1 border p-3 ${
            improved ? "border-[#3ecf6e]/40 bg-[#3ecf6e]/5" : "border-[#e0916a]/40 bg-[#e0916a]/5"
          }`}
        >
          <span className={`${text.kicker} text-[10px]`}>Change</span>
          <span className={`${text.mono} text-lg ${improved ? "text-[#5fdb87]" : "text-[#e0916a]"}`}>
            {deltaDb === 0 ? "No change" : `${improved ? "" : "-"}${Math.abs(deltaDb).toFixed(1)} dB`}
          </span>
          <span className={`text-sm ${text.muted}`}>
            {deltaDb === 0
              ? "Margin unchanged."
              : improved
                ? `Margin improved by ${Math.abs(deltaDb).toFixed(1)} dB.`
                : `Margin worsened by ${Math.abs(deltaDb).toFixed(1)} dB.`}
          </span>
        </div>
      </div>

      <p className={`text-xs ${text.muted}`}>
        {after.revisionLabel} is {marginPhrase(after.marginDb)} — an
        investigation finding, not a pass or certification result.
      </p>
    </section>
  );
}
