// A deterministic harmonic correlation (MVP-06 output) — must visually
// read as arithmetic, not as an AI opinion. Labeled "Candidate relationship"
// deliberately, never "root cause" (see CLAUDE.md "Product truth": a
// harmonic match is a coincidence worth investigating, not a diagnosis).
import type { CorrelationFoundPayload } from "@/lib/analysis/events";
import { surface, text } from "./theme";

interface CorrelationCardProps {
  correlation: CorrelationFoundPayload;
}

export function CorrelationCard({ correlation }: CorrelationCardProps) {
  const deviationLabel =
    correlation.deviationRatio === 0
      ? "exact match"
      : `${(correlation.deviationRatio * 100).toFixed(3)}% deviation`;

  return (
    <div className={`flex flex-col gap-3 p-4 ${surface.panelElevated}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={text.kicker}>Deterministic relationship</span>
        <span className="border border-[#3ecf6e]/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5fdb87]">
          Candidate relationship
        </span>
      </div>

      <p className={`text-xl font-semibold ${text.mono}`}>
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
      </dl>
    </div>
  );
}
