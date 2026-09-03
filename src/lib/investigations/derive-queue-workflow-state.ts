// UX-05 Workstream D: the Investigations queue's real filter buckets
// (Active / Needs evidence / Ready for review / Resolved) and per-row
// required-next-action string, both mapped to the same canonical
// WorkflowState vocabulary `derive-workflow-state.ts` already defines for
// the single-case investigation workspace — never a second, invented
// status system.
//
// Why a separate function rather than calling deriveWorkflowState directly
// for every queue row: deriveWorkflowState takes a full case reconstruction
// (WorkspaceState.hypotheses + the case's entire TimelineEntry[], via
// getInvestigationTimeline — several round trips per case). Running that
// once per row would make the queue page's cost scale with the number of
// investigations in the workspace. This function takes the lighter,
// already-batched aggregates listInvestigations() computes once across all
// case ids (see queries.ts), and reaches the identical WorkflowState for
// every input the two functions can both express — proven by a shared
// equivalence test in derive-queue-workflow-state.test.ts. The one
// knowingly narrower case: deriveWorkflowState's "interrupted" state (a
// run stuck mid-flight past its connection) needs the live SSE session,
// not batch-queryable case data — the queue folds that into
// "analysis_in_progress" rather than fabricating a heuristic for it.
import type { WorkflowState } from "@/lib/investigation/derive-workflow-state";

export interface QueueWorkflowStateInput {
  caseStatus: "open" | "resolved" | "archived";
  hasMeasurement: boolean;
  /** "pending"/"running" both read as in-flight for a queue row. */
  latestRunStatus: "pending" | "running" | "completed" | "failed" | null;
  /** Hypothesis count from the case's latest completed run only — earlier
   * runs' hypotheses remain part of the case's history but don't change
   * what the engineer needs to do *now*. */
  latestRunHypothesisCount: number;
  latestRunHasMissingEvidence: boolean;
  lastEngineeringChangeAt: string | null;
  lastResultAt: string | null;
}

export function deriveQueueWorkflowState(input: QueueWorkflowStateInput): WorkflowState {
  const {
    caseStatus,
    hasMeasurement,
    latestRunStatus,
    latestRunHypothesisCount,
    latestRunHasMissingEvidence,
    lastEngineeringChangeAt,
    lastResultAt,
  } = input;

  if (caseStatus === "resolved" || caseStatus === "archived") return "resolved";
  if (!hasMeasurement) return "awaiting_measurement";
  if (latestRunStatus === "running" || latestRunStatus === "pending") return "analysis_in_progress";
  if (latestRunStatus === "failed") return "analysis_failed";
  if (latestRunStatus === null) return "idle";

  // latestRunStatus === "completed" — same ordering rule as
  // deriveWorkflowState: a change recorded after the last reviewed result
  // (or with no result yet) means the engineer's next job is to verify it.
  if (lastEngineeringChangeAt && (!lastResultAt || lastResultAt < lastEngineeringChangeAt)) {
    return "change_ready_to_verify";
  }
  if (lastResultAt) return "outcome_ready_for_review";
  if (latestRunHypothesisCount === 0) return "more_evidence_needed";
  return latestRunHasMissingEvidence ? "ready_for_next_test" : "more_evidence_needed";
}

export type QueueFilterBucket = "active" | "needs_evidence" | "ready_for_review" | "resolved";

export const QUEUE_FILTER_LABEL: Record<QueueFilterBucket, string> = {
  active: "Active",
  needs_evidence: "Needs evidence",
  ready_for_review: "Ready for review",
  resolved: "Resolved",
};

/** Every WorkflowState maps to exactly one queue bucket — a case is never
 * counted twice and never falls through uncounted. */
export function queueFilterBucket(state: WorkflowState): QueueFilterBucket {
  switch (state) {
    case "resolved":
      return "resolved";
    case "outcome_ready_for_review":
    case "change_ready_to_verify":
      return "ready_for_review";
    case "more_evidence_needed":
    case "ready_for_next_test":
      return "needs_evidence";
    default:
      return "active";
  }
}

/** The literal required-next-action string shown on each queue row —
 * derived only from the same real WorkflowState, never a separate guess. */
export function describeRequiredNextAction(state: WorkflowState): string {
  switch (state) {
    case "awaiting_measurement":
      return "Record a measurement to start the investigation";
    case "idle":
      return "Run the investigation";
    case "analysis_in_progress":
      return "Investigation running — check back shortly";
    case "analysis_failed":
      return "Re-run the investigation";
    case "interrupted":
      return "Reconnect and check run status";
    case "more_evidence_needed":
      return "Add an observation or missing evidence";
    case "ready_for_next_test":
      return "Run the recommended next test";
    case "change_ready_to_verify":
      return "Record a second measurement to verify the change";
    case "outcome_ready_for_review":
      return "Review the before/after outcome";
    case "resolved":
      return "No action needed";
  }
}
