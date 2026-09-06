// INVESTIGATION CONTROLS (App Redesign, Workstream C correction): the
// Run button and the workflow-state status line have moved into the
// case header (top-bar.tsx, via run-investigation-button.tsx and
// agent-status-pill.tsx) per the ticket's "Move Run, Run again, Resume
// ... into this header. Remove the separate Investigation complete
// banner from the centre pane." "Record engineering change" moved into
// the pinned next-action bar (next-action-bar.tsx). What's left here is
// exactly the content that still genuinely belongs inline in the
// Decision workbench: the failed-run alert, the clarification note, and
// the honest empty-result message — none of these are status chrome,
// they're real conditional facts about this run.
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import { accent, radius, text } from "./theme";

interface InvestigationControlsProps {
  state: WorkspaceState;
}

// FIX-01: a correlation was found but the run still produced neither a
// hypothesis nor a clarification question — almost always after a retry
// (see hypothesis.retried in reconstruct.ts) has already been attempted.
// Previously this fell through to the "no correlations, no hypotheses"
// empty state's condition being false and rendering nothing at all here,
// which read as broken (the correlation/reasoning cards show up elsewhere
// with no explanation of why nothing followed from them) rather than as a
// real, reportable outcome.
function hasUnresolvedEmptyHypothesis(state: WorkspaceState): boolean {
  return (
    state.status === "completed" &&
    state.correlations.length > 0 &&
    state.hypotheses.length === 0 &&
    !state.clarification
  );
}

export function InvestigationControls({ state }: InvestigationControlsProps) {
  if (
    state.status !== "failed" &&
    state.status !== "interrupted" &&
    !state.clarification &&
    !(state.status === "completed" && state.hypotheses.length === 0 && state.correlations.length === 0) &&
    !hasUnresolvedEmptyHypothesis(state)
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      {state.status === "failed" || state.status === "interrupted" ? (
        <div role="alert" className={`flex flex-col gap-1 ${radius.card} border border-warning/40 bg-warning/10 p-3`}>
          <span className={`${text.kicker} text-[10px] ${accent.warnText}`}>Failed run</span>
          <p className={`text-sm ${accent.warnText}`}>{state.errorMessage}</p>
          {state.correlations.length > 0 || state.hypotheses.length > 0 ? (
            <p className={`text-xs ${text.muted}`}>Existing evidence below is preserved.</p>
          ) : null}
        </div>
      ) : null}

      {state.clarification ? (
        <div className={`flex flex-col gap-1 ${radius.card} border border-dashed border-border p-3`}>
          <span className={text.kicker}>Additional information needed</span>
          <p className="text-sm">{state.clarification}</p>
        </div>
      ) : null}

      {state.status === "completed" &&
      state.hypotheses.length === 0 &&
      state.correlations.length === 0 ? (
        <p className={`text-sm ${text.muted}`}>
          No harmonic correlations were found for this measurement against the
          recorded product facts, so no investigation hypotheses were
          generated.
        </p>
      ) : null}

      {/* No separate "Run again" button here — the header's Run button
          (run-investigation-button.tsx, moved out of this pane by the App
          Redesign) already reads "RUN AGAIN" the instant a run completes,
          so a second identically-labeled control here would be an
          ambiguous, redundant affordance rather than a real second one. */}
      {hasUnresolvedEmptyHypothesis(state) ? (
        <div className={`flex flex-col gap-1 ${radius.card} border border-dashed border-border p-3`}>
          <span className={text.kicker}>No hypothesis produced</span>
          <p className="text-sm">
            A frequency relationship was found, but this run did not produce
            an investigation hypothesis from it. Run again to retry.
          </p>
        </div>
      ) : null}
    </div>
  );
}
