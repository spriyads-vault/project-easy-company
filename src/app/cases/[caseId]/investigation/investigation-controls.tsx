// INVESTIGATION CONTROLS (UX-04 Agent-Native): the leaner, controls-only
// half of what used to be investigation-panel.tsx. Status text, the
// RUN/RE-EVALUATE button, the failed-run alert, the clarification note, the
// empty-result message, and the "record an engineering change" action all
// still live here — but correlation/hypothesis rendering does not. Those
// are now artifacts on <InvestigationCanvas>, not stacked cards a controls
// strip renders inline. This keeps the run lifecycle's accessible status
// region and error alert in one place, directly above the canvas, exactly
// where investigation-workspace.test.tsx's accessibility assertions expect
// them (getByRole("status")/getByRole("alert")).
import type { RunStatus, WorkspaceState } from "@/lib/investigation/reconstruct";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { accent, radius, text } from "./theme";

interface InvestigationControlsProps {
  caseId: string;
  productId: string;
  revisionId: string;
  currentRevisionLabel: string;
  /** MVP-11: once the case's evidence spans more than one revision, RUN
   * AGAIN is relabeled RE-EVALUATE INVESTIGATION — same run mechanism, no
   * new agent behavior, just a label that reflects what's actually being
   * asked: "look at the case as it stands now, after the change." */
  hasMultipleRevisions: boolean;
  state: WorkspaceState;
  canRunAnalysis: boolean;
  /** True the instant the button is clicked, before the first run.started
   * event round-trips — keeps the button feeling responsive and closes the
   * double-click window without waiting on the network. */
  isSubmitting: boolean;
  disabledReason: string | null;
  onRunInvestigation: () => void;
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "No investigation run yet",
  running: "Analysis active",
  completed: "Investigation complete",
  failed: "Analysis failed",
  interrupted: "Analysis interrupted",
};

const STATUS_DOT_COLOR: Record<RunStatus, string> = {
  idle: "bg-[#2d3440]",
  running: "bg-[#22c55e] animate-pulse",
  completed: "bg-[#22c55e]",
  failed: "bg-[#f59e0b]",
  interrupted: "bg-[#f59e0b]",
};

function buttonLabel(status: RunStatus, busy: boolean, hasMultipleRevisions: boolean): string {
  if (busy) return "ANALYZING…";
  if (status === "idle") return "RUN INVESTIGATION";
  return hasMultipleRevisions ? "RE-EVALUATE INVESTIGATION" : "RUN AGAIN";
}

export function InvestigationControls({
  caseId,
  productId,
  revisionId,
  currentRevisionLabel,
  hasMultipleRevisions,
  state,
  canRunAnalysis,
  isSubmitting,
  disabledReason,
  onRunInvestigation,
}: InvestigationControlsProps) {
  const busy = isSubmitting || state.status === "running";
  const hasRunAtLeastOnce = state.status !== "idle";

  return (
    <section aria-labelledby="investigation-panel-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${busy ? STATUS_DOT_COLOR.running : STATUS_DOT_COLOR[state.status]}`}
          />
          <p id="investigation-panel-heading" role="status" aria-live="polite" className="text-sm">
            {busy && state.status !== "running"
              ? "Analyzing measurement…"
              : (state.lastEventSummary ?? STATUS_LABEL[state.status])}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunInvestigation}
          disabled={!canRunAnalysis || busy}
          title={disabledReason ?? undefined}
          className={`${radius.control} border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:border-[#2d3440] disabled:bg-transparent disabled:text-[#6b7684]`}
        >
          {buttonLabel(state.status, busy, hasMultipleRevisions)}
        </button>
      </div>

      {!canRunAnalysis && !hasRunAtLeastOnce && disabledReason ? (
        <p className={`text-sm ${text.muted}`}>{disabledReason}</p>
      ) : null}

      {state.status === "failed" || state.status === "interrupted" ? (
        <div role="alert" className={`flex flex-col gap-1 ${radius.card} border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3`}>
          <span className={`${text.kicker} text-[10px] ${accent.warnText}`}>Failed run</span>
          <p className={`text-sm ${accent.warnText}`}>{state.errorMessage}</p>
          {state.correlations.length > 0 || state.hypotheses.length > 0 ? (
            <p className={`text-xs ${text.muted}`}>Existing evidence below is preserved.</p>
          ) : null}
        </div>
      ) : null}

      {state.clarification ? (
        <div className={`flex flex-col gap-1 ${radius.card} border border-dashed border-[#2d3440] p-3`}>
          <span className={text.kicker}>Additional information needed</span>
          <p className="text-sm">{state.clarification}</p>
        </div>
      ) : null}

      {/* Recording an observation now goes through the floating bottom
          composer (case-composer.tsx) — the same investigation_events
          write, just reached via the "tell Crado what changed" input
          instead of a second structured form. Recording an ENGINEERING
          CHANGE stays its own explicit action here: it creates a new
          product revision, too consequential a structured operation to
          infer from free text. Only makes sense once there's at least one
          hypothesis to follow up on. */}
      {state.status !== "running" && state.hypotheses.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <RecordEngineeringChangeForm
            caseId={caseId}
            productId={productId}
            fromRevisionId={revisionId}
            currentRevisionLabel={currentRevisionLabel}
          />
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
    </section>
  );
}
