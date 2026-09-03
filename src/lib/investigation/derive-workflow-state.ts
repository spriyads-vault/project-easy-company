// UX-05 (Decision-centred investigation workspace): a truthful workflow
// state, distinct from RunStatus (reconstruct.ts). RunStatus answers "did
// the last agent run finish or fail" — a server/transport fact. This
// answers "what does the engineer need to do next" — an engineering fact.
// The two are deliberately never conflated: an agent run finishing
// ("analysis_complete" in spirit) does NOT mean the investigation is
// resolved; a case is only ever "resolved" when the failure_case row
// itself says so (an explicit engineer/reviewer action, never inferred
// from one run ending). Every branch below reads only fields
// WorkspaceState/TimelineEntry/case status already carry — nothing here
// invents a status the domain doesn't actually have.
import type { RunStatus, WorkspaceState } from "./reconstruct";
import type { TimelineEntry } from "./timeline";

export type WorkflowState =
  | "awaiting_measurement"
  | "idle"
  | "analysis_in_progress"
  | "analysis_failed"
  | "interrupted"
  | "more_evidence_needed"
  | "ready_for_next_test"
  | "change_ready_to_verify"
  | "outcome_ready_for_review"
  | "resolved";

export const WORKFLOW_STATE_LABEL: Record<WorkflowState, string> = {
  awaiting_measurement: "Waiting for a measurement",
  idle: "No investigation run yet",
  analysis_in_progress: "Agent analysis in progress",
  analysis_failed: "Analysis failed",
  interrupted: "Connection interrupted",
  more_evidence_needed: "More evidence needed",
  ready_for_next_test: "Ready for next test",
  change_ready_to_verify: "Change ready to verify",
  outcome_ready_for_review: "Outcome ready for review",
  resolved: "Resolved",
};

/** Reuses reconstruct.ts's RunStatus-derived tones (waiting/idle/active/
 * complete/failed) purely for color — the label text carries the actual
 * meaning, color is never the only signal (paired with a glyph/dot at
 * every call site). */
export type WorkflowStateTone = "waiting" | "idle" | "active" | "complete" | "failed";

export const WORKFLOW_STATE_TONE: Record<WorkflowState, WorkflowStateTone> = {
  awaiting_measurement: "waiting",
  idle: "idle",
  analysis_in_progress: "active",
  analysis_failed: "failed",
  interrupted: "failed",
  more_evidence_needed: "waiting",
  ready_for_next_test: "waiting",
  change_ready_to_verify: "waiting",
  outcome_ready_for_review: "waiting",
  resolved: "complete",
};

export interface DeriveWorkflowStateInput {
  runStatus: RunStatus;
  hasMeasurement: boolean;
  hypotheses: WorkspaceState["hypotheses"];
  timeline: readonly TimelineEntry[];
  /** The failure_cases row's own status — the only source of "resolved."
   * Optional because most call sites (the live client) don't currently
   * carry it; omitted, a completed/reviewable investigation reads as
   * "outcome_ready_for_review" rather than silently defaulting to
   * resolved, which is the truthful choice when this isn't known. */
  caseStatus?: "open" | "resolved" | "archived";
}

/**
 * Derives what the engineer actually needs to know/do — never "the agent
 * stopped generating" alone. A case is "resolved" only when the case
 * record itself says so; every other completed-run state is phrased as an
 * engineering next-step (more evidence, a test to run, a change to
 * verify, an outcome to review), not as a terminal "done."
 */
export function deriveWorkflowState(input: DeriveWorkflowStateInput): WorkflowState {
  const { runStatus, hasMeasurement, hypotheses, timeline, caseStatus } = input;

  if (caseStatus === "resolved" || caseStatus === "archived") return "resolved";
  if (!hasMeasurement) return "awaiting_measurement";
  if (runStatus === "running") return "analysis_in_progress";
  if (runStatus === "failed") return "analysis_failed";
  if (runStatus === "interrupted") return "interrupted";
  if (runStatus === "idle") return "idle";

  // runStatus === "completed" — the agent run finished; now ask what the
  // *engineering* state is, from real timeline evidence, not from the run
  // finishing.
  let lastChangeAt: string | null = null;
  let lastResultAt: string | null = null;
  for (const entry of timeline) {
    if (entry.type === "engineering_change") lastChangeAt = entry.createdAt;
    if (entry.type === "result") lastResultAt = entry.createdAt;
  }

  if (lastChangeAt && (!lastResultAt || lastResultAt < lastChangeAt)) {
    return "change_ready_to_verify";
  }
  if (lastResultAt) return "outcome_ready_for_review";
  if (hypotheses.length === 0) return "more_evidence_needed";

  const hasMissingEvidence = hypotheses.some((hypothesis) =>
    hypothesis.evidence.some((item) => item.category === "missing"),
  );
  return hasMissingEvidence ? "ready_for_next_test" : "more_evidence_needed";
}
