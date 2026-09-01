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
import { accent, surface, text } from "./theme";

interface InvestigationPanelProps {
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
  idle: "bg-[#4a4d43]",
  running: "bg-[#3ecf6e] animate-pulse",
  completed: "bg-[#3ecf6e]",
  failed: "bg-[#e0916a]",
  interrupted: "bg-[#e0916a]",
};

function buttonLabel(status: RunStatus, busy: boolean): string {
  if (busy) return "ANALYZING…";
  if (status === "idle") return "RUN INVESTIGATION";
  return "RUN AGAIN";
}

export function InvestigationPanel({
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
          className="border border-[#3ecf6e]/50 bg-[#3ecf6e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#5fdb87] transition-colors hover:bg-[#3ecf6e]/20 disabled:cursor-not-allowed disabled:border-[#3a3d34] disabled:bg-transparent disabled:text-[#6f6d65]"
        >
          {buttonLabel(state.status, busy)}
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
        <p role="alert" className={`border border-[#e0916a]/40 bg-[#e0916a]/10 p-3 text-sm ${accent.warnText}`}>
          {state.errorMessage}
        </p>
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
        <div className="flex flex-col gap-1 border border-[#3a3d34] p-3">
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
