// DETERMINISTIC RELATIONSHIP artifact (UX-03): a compact mathematical
// object — must visually read as arithmetic, not as an AI opinion.
// Labeled "Candidate relationship" deliberately, never "root cause" (see
// CLAUDE.md "Product truth": a harmonic match is a coincidence worth
// investigating, not a diagnosis). This is a deterministic engine output
// (MVP-06) — the card's whole visual job is to look calculated, not
// inferred, which is why the equation is the single largest thing on it
// and every supporting fact underneath stays monospace.
import type { CorrelationFoundPayload } from "@/lib/analysis/events";
import { artifact, motion, surface, text } from "./theme";

interface CorrelationCardProps {
  correlation: CorrelationFoundPayload;
}

export function CorrelationCard({ correlation }: CorrelationCardProps) {
  const deviationLabel =
    correlation.deviationRatio === 0
      ? "exact match"
      : `${(correlation.deviationRatio * 100).toFixed(3)}% deviation`;
  const style = artifact.deterministic;

  return (
    <div className={`flex flex-col gap-3 border-l-2 p-4 ${style.accent} ${motion.rise} ${surface.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={text.kicker}>{style.label} relationship</span>
        <span className="rounded-full border border-[#1f9d52]/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#177a3f]">
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
      </dl>
    </div>
  );
}
