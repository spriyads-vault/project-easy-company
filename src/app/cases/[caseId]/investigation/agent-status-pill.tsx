// AGENT PRESENCE (UX-03, truthful states UX-05): the status half of what
// UX-02's InvestigationHero used to render as its own boxed row now lives
// here, as a small pill inside the top bar. UX-05 replaced the old
// binary-ish "Investigating / Complete / Ready" language with
// deriveWorkflowState's truthful vocabulary — an agent run finishing is
// never shown as "Complete" without saying what it means for the
// investigation (more evidence needed, a test to run, a change to
// verify, an outcome to review), and "Resolved" only ever appears when
// the case record itself says so. See
// src/lib/investigation/derive-workflow-state.ts for the full state
// derivation and why each branch is grounded in real data.
import { deriveWorkflowState, WORKFLOW_STATE_LABEL, WORKFLOW_STATE_TONE } from "@/lib/investigation/derive-workflow-state";
import type { RunStatus, WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { heroStatusStyle } from "./theme";

interface AgentStatusPillProps {
  runStatus: RunStatus;
  /** True the instant RUN is clicked, before the first `run.started` event
   * round-trips — see investigation-controls.tsx's identical comment.
   * Forces the "in progress" reading even though runStatus itself hasn't
   * flipped to "running" yet. */
  busy: boolean;
  hasMeasurement: boolean;
  hypotheses: WorkspaceState["hypotheses"];
  timeline: readonly TimelineEntry[];
  /** The failure_cases row's own status. Optional/defaults to "open" so
   * every pre-UX-05 test call site keeps working unmodified — "open" is
   * the honest default (never resolved unless told so). */
  caseStatus?: "open" | "resolved" | "archived";
}

export function AgentStatusPill({
  runStatus,
  busy,
  hasMeasurement,
  hypotheses,
  timeline,
  caseStatus = "open",
}: AgentStatusPillProps) {
  const workflowState = busy
    ? "analysis_in_progress"
    : deriveWorkflowState({ runStatus, hasMeasurement, hypotheses, timeline, caseStatus });
  const tone = WORKFLOW_STATE_TONE[workflowState];
  const label = WORKFLOW_STATE_LABEL[workflowState];

  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide sm:inline-flex ${heroStatusStyle[tone]}`}
    >
      {tone === "active" ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      ) : null}
      Crado · {label}
    </span>
  );
}
