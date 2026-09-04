// DECISION VIEW (App Redesign, Workstream C correction): a flat
// operational workbench, not a stack of large cards. The failure header
// strip (failure-strip.tsx), the master investigation item table
// (investigation-item-table.tsx, real deterministic correlations +
// ranked hypotheses), and — only when this case actually has one — the
// latest before/after result. The pinned "Recommended next test" bar and
// "Record engineering change" entry point are rendered by the parent
// (investigation-workspace.tsx) as a sibling OUTSIDE this component's own
// scroll region, since they must stay visible while this table scrolls
// (see next-action-bar.tsx). Every number and sentence here already comes
// straight from WorkspaceState/TimelineEntry — nothing here fabricates a
// field the domain doesn't produce.
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import type { RailSelection } from "./context-rail";
import { FailureStrip } from "./failure-strip";
import { InvestigationControls } from "./investigation-controls";
import { InvestigationItemTable, type FocusedItemCategory } from "./investigation-item-table";
import { RevisionComparisonCard } from "./revision-comparison-card";

interface DecisionViewProps {
  caseId: string;
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  selection: RailSelection;
  onSelectMeasurement: () => void;
  onSelectCorrelation: (correlation: CorrelationFoundPayload) => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  focusedCategory?: FocusedItemCategory;
}

export function DecisionView({
  caseId,
  measurement,
  state,
  timeline,
  selection,
  onSelectMeasurement,
  onSelectCorrelation,
  onSelectHypothesis,
  focusedCategory,
}: DecisionViewProps) {
  // Most recent before/after result, if any — a case can accumulate more
  // than one across its history; the Decision view shows only the latest
  // as "the outcome" (the full sequence stays on the Timeline tab).
  const latestResult = [...timeline].reverse().find((entry) => entry.type === "result");

  return (
    <div className="flex flex-col">
      <InvestigationControls state={state} />
      <FailureStrip caseId={caseId} measurement={measurement} onSelect={onSelectMeasurement} />
      <InvestigationItemTable
        correlations={state.correlations}
        hypotheses={state.hypotheses}
        timeline={timeline}
        selection={selection}
        onSelectCorrelation={onSelectCorrelation}
        onSelectHypothesis={onSelectHypothesis}
        focusedCategory={focusedCategory}
      />
      {latestResult && latestResult.type === "result" ? (
        <div className="px-4 py-4">
          <RevisionComparisonCard comparison={latestResult.comparison} />
        </div>
      ) : null}
    </div>
  );
}
