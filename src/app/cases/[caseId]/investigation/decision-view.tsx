// DECISION VIEW (UX-05: Decision-centred investigation workspace) — the
// new default tab. Answers "what failed, what does Crado know, what's the
// leading read, what should I do next, and what happened last time" in one
// readable stack, without requiring graph navigation (Investigation Map
// stays available as a secondary tab for topology). This composes four
// already-built UX-03 artifact components verbatim (MeasurementPanel,
// CorrelationCard, HypothesisCard, RevisionComparisonCard) — every number
// and sentence they render already comes straight from WorkspaceState /
// TimelineEntry, so this view adds zero new fabricated fields. The only
// new content is the "Recommended next test" card, and it's built entirely
// from the leading hypothesis's own real recommendedNextStep/title —
// never a synthesized structured field the domain doesn't produce.
import type { MeasurementRow } from "@/lib/cases/queries";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { HYPOTHESIS_STRENGTH_LABEL, rankHypotheses } from "@/lib/investigation/rank-hypotheses";
import { MeasurementPanel } from "./measurement-panel";
import { CorrelationCard } from "./correlation-card";
import { HypothesisCard } from "./hypothesis-card";
import { RevisionComparisonCard } from "./revision-comparison-card";
import { artifact, focusRing, radius, surface, text } from "./theme";

interface DecisionViewProps {
  caseId: string;
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  onSelectMeasurement: () => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  /** Focuses the composer, pre-contextualized to the leading hypothesis's
   * recommended next test — the same handoff the canvas's node action
   * already uses (investigation-workspace.tsx's handleRecordResult), not a
   * second, divergent entry point. */
  onRecordResult: () => void;
}

export function DecisionView({
  caseId,
  measurement,
  state,
  timeline,
  onSelectMeasurement,
  onSelectHypothesis,
  onOpenCitation,
  onRecordResult,
}: DecisionViewProps) {
  const ranked = rankHypotheses(state.hypotheses);
  const leading = ranked[0] ?? null;
  // Most recent before/after result, if any — a case can accumulate more
  // than one across its history; the Decision view shows only the latest
  // as "the outcome" (the full sequence stays on the Timeline tab).
  const latestResult = [...timeline].reverse().find((entry) => entry.type === "result");

  return (
    <div className="flex flex-col gap-6">
      <MeasurementPanel caseId={caseId} measurement={measurement} onSelect={onSelectMeasurement} />

      {state.correlations.length > 0 ? (
        <section aria-labelledby="decision-known-heading" className="flex flex-col gap-3">
          <h2 id="decision-known-heading" className={text.kicker}>
            What Crado knows
          </h2>
          <div className="flex flex-col gap-3">
            {state.correlations.map((correlation) => (
              <CorrelationCard
                key={`${correlation.productFactId}-${correlation.sourceFrequencyMhz}-${correlation.harmonicNumber}`}
                correlation={correlation}
              />
            ))}
          </div>
        </section>
      ) : null}

      {ranked.length > 0 ? (
        <section aria-labelledby="decision-hypotheses-heading" className="flex flex-col gap-3">
          <h2 id="decision-hypotheses-heading" className={text.kicker}>
            Leading hypotheses
          </h2>
          <div className="flex flex-col gap-3">
            {ranked.map(({ hypothesis, originalIndex, strength }) => (
              <div key={`${hypothesis.productFactId}-${originalIndex}`} className="flex flex-col gap-1.5">
                <span className={`${text.kicker} text-[10px]`}>{HYPOTHESIS_STRENGTH_LABEL[strength]}</span>
                <HypothesisCard
                  hypothesis={hypothesis}
                  index={originalIndex}
                  onOpenCitation={onOpenCitation}
                  onSelect={() => onSelectHypothesis(hypothesis, originalIndex)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {leading ? (
        <section
          aria-labelledby="decision-next-test-heading"
          className={`flex flex-col gap-2 border-l-2 p-5 ${artifact.nextTest.accent} ${surface.card}`}
        >
          <h2 id="decision-next-test-heading" className={text.kicker}>
            Recommended next test
          </h2>
          <p className="text-base font-medium">{leading.hypothesis.recommendedNextStep}</p>
          <p className={`text-xs ${text.muted}`}>
            Would confirm or rule out: {leading.hypothesis.title}
          </p>
          <button
            type="button"
            onClick={onRecordResult}
            className={`${radius.control} mt-2 w-fit border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-primary transition-colors hover:bg-primary/20 ${focusRing}`}
          >
            Record result
          </button>
        </section>
      ) : null}

      {latestResult && latestResult.type === "result" ? (
        <RevisionComparisonCard comparison={latestResult.comparison} />
      ) : null}
    </div>
  );
}
