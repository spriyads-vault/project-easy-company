// INVESTIGATION region: consumes the reconstructed/streaming workspace
// state (src/lib/investigation/reconstruct.ts) and renders it
// progressively. Purely presentational — investigation-workspace.tsx owns
// the state and the SSE consumption; this never touches fetch/EventSource
// itself, which is what makes it easy to test with a plain WorkspaceState
// prop and no network.
import type { RunStatus, WorkspaceState } from "@/lib/investigation/reconstruct";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { CorrelationCard } from "./correlation-card";
import { HypothesisCard } from "./hypothesis-card";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { accent, surface, text } from "./theme";

interface InvestigationPanelProps {
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
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "No investigation run yet",
  running: "Analysis active",
  completed: "Investigation complete",
  failed: "Analysis failed",
  interrupted: "Analysis interrupted",
};

const STATUS_DOT_COLOR: Record<RunStatus, string> = {
  idle: "bg-[#c7c0ae]",
  running: "bg-[#1f9d52] animate-pulse",
  completed: "bg-[#1f9d52]",
  failed: "bg-[#a15a17]",
  interrupted: "bg-[#a15a17]",
};

function buttonLabel(status: RunStatus, busy: boolean, hasMultipleRevisions: boolean): string {
  if (busy) return "ANALYZING…";
  if (status === "idle") return "RUN INVESTIGATION";
  return hasMultipleRevisions ? "RE-EVALUATE INVESTIGATION" : "RUN AGAIN";
}

export function InvestigationPanel({
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
  onOpenCitation,
}: InvestigationPanelProps) {
  const busy = isSubmitting || state.status === "running";
  const hasRunAtLeastOnce = state.status !== "idle";

  return (
    <section
      aria-labelledby="investigation-panel-heading"
      className={`flex flex-col gap-5 p-5 ${surface.panel}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="investigation-panel-heading" className={text.kicker}>
            Investigation
          </h2>
        </div>
        <button
          type="button"
          onClick={onRunInvestigation}
          disabled={!canRunAnalysis || busy}
          title={disabledReason ?? undefined}
          className="border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#177a3f] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:border-[#ddd7c8] disabled:bg-transparent disabled:text-[#847c6a]"
        >
          {buttonLabel(state.status, busy, hasMultipleRevisions)}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${busy ? STATUS_DOT_COLOR.running : STATUS_DOT_COLOR[state.status]}`}
        />
        <p role="status" aria-live="polite" className="text-sm">
          {busy && state.status !== "running"
            ? "Analyzing measurement…"
            : (state.lastEventSummary ?? STATUS_LABEL[state.status])}
        </p>
      </div>

      {!canRunAnalysis && !hasRunAtLeastOnce && disabledReason ? (
        <p className={`text-sm ${text.muted}`}>{disabledReason}</p>
      ) : null}

      {state.status === "failed" || state.status === "interrupted" ? (
        <div role="alert" className="flex flex-col gap-1 border border-[#a15a17]/40 bg-[#a15a17]/10 p-3">
          <span className={`${text.kicker} text-[10px] ${accent.warnText}`}>Failed run</span>
          <p className={`text-sm ${accent.warnText}`}>{state.errorMessage}</p>
          {state.correlations.length > 0 || state.hypotheses.length > 0 ? (
            <p className={`text-xs ${text.muted}`}>Existing evidence below is preserved.</p>
          ) : null}
        </div>
      ) : null}

      {state.correlations.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.correlations.map((correlation) => (
            <CorrelationCard
              key={`${correlation.productFactId}-${correlation.harmonicNumber}`}
              correlation={correlation}
            />
          ))}
        </div>
      ) : null}

      {state.clarification ? (
        <div className="flex flex-col gap-1 border border-[#ddd7c8] p-3">
          <span className={text.kicker}>Additional information needed</span>
          <p className="text-sm">{state.clarification}</p>
        </div>
      ) : null}

      {state.hypotheses.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.hypotheses.map((hypothesis, index) => (
            <HypothesisCard
              key={`${hypothesis.productFactId}-${index}`}
              hypothesis={hypothesis}
              index={index}
              onOpenCitation={onOpenCitation}
            />
          ))}
        </div>
      ) : null}

      {/* Recording an observation now goes through the persistent bottom
          composer (case-composer.tsx) — the same investigation_events write,
          just reached via the "tell Crado what changed" input instead of a
          second structured form. Recording an ENGINEERING CHANGE stays its
          own explicit action here: it creates a new product revision, too
          consequential a structured operation to infer from free text. Only
          makes sense once there's at least one hypothesis to follow up on. */}
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
