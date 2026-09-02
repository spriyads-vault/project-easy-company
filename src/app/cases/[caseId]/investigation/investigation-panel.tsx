// INVESTIGATION canvas content (UX-03): consumes the reconstructed/
// streaming workspace state (src/lib/investigation/reconstruct.ts) and
// renders it as connected artifacts — no outer bordered box any more (the
// canvas itself, not this component, is where the artifacts sit).
// Purely presentational — investigation-workspace.tsx owns the state and
// the SSE consumption; this never touches fetch/EventSource itself, which
// is what makes it easy to test with a plain WorkspaceState prop and no
// network.
//
// UX-03 consolidation, documented rather than hidden: the ticket's visual
// chain lists MISSING EVIDENCE and NEXT TEST as their own connected
// artifacts after HYPOTHESIS. hypothesis-card.tsx already renders both as
// clearly differentiated zones *inside* the hypothesis artifact (a dashed
// "Missing" evidence section, a highlighted green-accented "Next test"
// block) — the same information, one fewer redundant card per hypothesis,
// since both are properties of that specific hypothesis rather than
// independent investigation steps.
import type { RunStatus, WorkspaceState } from "@/lib/investigation/reconstruct";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { ArtifactRow, Connector } from "./connector";
import { CorrelationCard } from "./correlation-card";
import { HypothesisCard } from "./hypothesis-card";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { accent, radius, text } from "./theme";

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
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
}

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "No investigation run yet",
  running: "Analysis active",
  completed: "Investigation complete",
  failed: "Analysis failed",
  interrupted: "Analysis interrupted",
};

const STATUS_DOT_COLOR: Record<RunStatus, string> = {
  idle: "bg-[#d4d4d8]",
  running: "bg-[#1f9d52] animate-pulse",
  completed: "bg-[#1f9d52]",
  failed: "bg-[#b45309]",
  interrupted: "bg-[#b45309]",
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
  onSelectHypothesis,
}: InvestigationPanelProps) {
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
          className={`${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:border-[#d4d4d8] disabled:bg-transparent disabled:text-[#a1a1aa]`}
        >
          {buttonLabel(state.status, busy, hasMultipleRevisions)}
        </button>
      </div>

      {!canRunAnalysis && !hasRunAtLeastOnce && disabledReason ? (
        <p className={`text-sm ${text.muted}`}>{disabledReason}</p>
      ) : null}

      {state.status === "failed" || state.status === "interrupted" ? (
        <div role="alert" className={`flex flex-col gap-1 ${radius.card} border border-[#b45309]/40 bg-[#b45309]/10 p-3`}>
          <span className={`${text.kicker} text-[10px] ${accent.warnText}`}>Failed run</span>
          <p className={`text-sm ${accent.warnText}`}>{state.errorMessage}</p>
          {state.correlations.length > 0 || state.hypotheses.length > 0 ? (
            <p className={`text-xs ${text.muted}`}>Existing evidence below is preserved.</p>
          ) : null}
        </div>
      ) : null}

      {state.correlations.length > 0 ? (
        <>
          <Connector />
          <div className="flex flex-col gap-3">
            {state.correlations.map((correlation) => (
              <CorrelationCard
                key={`${correlation.productFactId}-${correlation.harmonicNumber}`}
                correlation={correlation}
              />
            ))}
          </div>
        </>
      ) : null}

      {state.clarification ? (
        <div className={`flex flex-col gap-1 ${radius.card} border border-dashed border-[#d4d4d8] p-3`}>
          <span className={text.kicker}>Additional information needed</span>
          <p className="text-sm">{state.clarification}</p>
        </div>
      ) : null}

      {state.hypotheses.length > 0 ? (
        <>
          <Connector />
          <ArtifactRow>
            {state.hypotheses.map((hypothesis, index) => (
              <HypothesisCard
                key={`${hypothesis.productFactId}-${index}`}
                hypothesis={hypothesis}
                index={index}
                onOpenCitation={onOpenCitation}
                onSelect={() => onSelectHypothesis(hypothesis, index)}
              />
            ))}
          </ArtifactRow>
        </>
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
