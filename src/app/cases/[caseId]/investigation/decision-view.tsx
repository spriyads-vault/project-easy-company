// DECISION VIEW (UX-07: answer-first layout): the case page itself, not
// one tab among five. Top to bottom: the failure summary (one sentence),
// the recommended next test (the largest, most prominent block), the
// reasoning objects (deterministic relationship + hypothesis, side by
// side, never sharing a table), then Evidence / History / Sources /
// "What Crado checked" as closed-by-default disclosures — replacing the
// four separate tabs those used to be (see docs/PROGRESS.md's UX-07
// entry for why the tab count dropped). Every number and sentence here
// already comes straight from WorkspaceState/TimelineEntry — nothing
// here fabricates a field the domain doesn't produce, and a disclosure
// with no real data behind it does not render at all rather than opening
// onto an empty section.
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { isRunActive, type WorkspaceState } from "@/lib/investigation/reconstruct";
import type { RankedHypothesis } from "@/lib/investigation/rank-hypotheses";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { AdvancedDisclosure } from "@/lib/design/advanced-disclosure";
import type { RailSelection } from "./context-rail";
import { AgentMetricsPanel } from "./agent-metrics-panel";
import { deriveSourcesUsed } from "./derive-sources-used";
import { EvidenceView } from "./evidence-view";
import { FailureStrip } from "./failure-strip";
import { InvestigationControls } from "./investigation-controls";
import { InvestigationTimeline } from "./investigation-timeline";
import { InvestigationTracePanel } from "./investigation-trace-panel";
import { NextActionBar } from "./next-action-bar";
import { ReasoningSection } from "./reasoning-section";
import { RevisionComparisonCard } from "./revision-comparison-card";
import { SourcesPanel } from "./sources-panel";

interface DecisionViewProps {
  caseId: string;
  productId: string;
  revisionId: string;
  currentRevisionLabel: string;
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  selection: RailSelection;
  leadingHypothesis: RankedHypothesis | null;
  onSelectMeasurement: () => void;
  onSelectCorrelation: (correlation: CorrelationFoundPayload) => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  onToggleMap: () => void;
  onRecordResult: () => void;
  focusedCategory?: "deterministic" | "hypothesis" | null;
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function DecisionView({
  caseId,
  productId,
  revisionId,
  currentRevisionLabel,
  measurement,
  state,
  timeline,
  selection,
  leadingHypothesis,
  onSelectMeasurement,
  onSelectCorrelation,
  onSelectHypothesis,
  onOpenCitation,
  onToggleMap,
  onRecordResult,
  focusedCategory,
}: DecisionViewProps) {
  // Most recent before/after result, if any — a case can accumulate more
  // than one across its history; the Decision view shows only the latest
  // as "the outcome" (the full sequence stays in the History disclosure).
  const latestResult = [...timeline].reverse().find((entry) => entry.type === "result");
  const running = isRunActive(state.status);
  const sourcesUsedCount = deriveSourcesUsed(state.hypotheses).length;

  // "What Crado checked" only has a home once a run has actually finished
  // — while a run is active, the live Trace pane (a sibling of this
  // component, not rendered here) already covers the same ground; showing
  // both would be either redundant or, worse, two panes that can drift
  // out of sync mid-run.
  const showWhatCradoChecked = !running && (state.agentActivity.length > 0 || state.agentMetrics !== null);
  const checkedMeta = showWhatCradoChecked
    ? `${state.agentActivity.length} ${state.agentActivity.length === 1 ? "check" : "checks"}${
        state.agentMetrics?.totalDurationMs != null ? ` · ${formatDuration(state.agentMetrics.totalDurationMs)}` : ""
      }`
    : null;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <InvestigationControls state={state} />
      <FailureStrip caseId={caseId} measurement={measurement} onSelect={onSelectMeasurement} />

      <NextActionBar
        caseId={caseId}
        productId={productId}
        revisionId={revisionId}
        currentRevisionLabel={currentRevisionLabel}
        leading={leadingHypothesis}
        showEngineeringChange={state.status !== "running" && state.hypotheses.length > 0}
        onRecordResult={onRecordResult}
      />

      <ReasoningSection
        correlations={state.correlations}
        hypotheses={state.hypotheses}
        selection={selection}
        onSelectCorrelation={onSelectCorrelation}
        onSelectHypothesis={onSelectHypothesis}
        onOpenCitation={onOpenCitation}
        onToggleMap={onToggleMap}
        focusedCategory={focusedCategory}
      />

      {latestResult && latestResult.type === "result" ? (
        <div className="px-4">
          <RevisionComparisonCard comparison={latestResult.comparison} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border px-4 pt-4">
        {state.hypotheses.length > 0 ? (
          <AdvancedDisclosure label="Evidence">
            <EvidenceView
              hypotheses={state.hypotheses}
              revisionLabel={currentRevisionLabel}
              onOpenCitation={onOpenCitation}
              onSelectHypothesis={onSelectHypothesis}
            />
          </AdvancedDisclosure>
        ) : null}

        {timeline.length > 0 ? (
          <AdvancedDisclosure label="History">
            <InvestigationTimeline entries={timeline} />
          </AdvancedDisclosure>
        ) : null}

        {state.agentMetrics ? (
          <AdvancedDisclosure label="Sources">
            <SourcesPanel hypotheses={state.hypotheses} metrics={state.agentMetrics} />
          </AdvancedDisclosure>
        ) : null}

        {showWhatCradoChecked ? (
          <AdvancedDisclosure label="What Crado checked" meta={checkedMeta}>
            <div className="flex flex-col gap-4">
              <InvestigationTracePanel
                activeTools={[]}
                completedActivity={state.agentActivity}
                active={false}
                durationMs={state.agentMetrics?.totalDurationMs}
                defaultCollapsed={false}
                hideOwnToggle
              />
              {state.agentMetrics ? (
                <AgentMetricsPanel
                  metrics={state.agentMetrics}
                  toolCallCount={state.agentActivity.length}
                  sourcesUsedCount={sourcesUsedCount}
                />
              ) : null}
            </div>
          </AdvancedDisclosure>
        ) : null}
      </div>
    </div>
  );
}
