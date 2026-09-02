"use client";

// UX-03: client orchestrator for the investigation-canvas layout — a
// connected artifact canvas (not a stacked-panel dashboard) framed by a
// quiet top bar (breadcrumb, agent-status pill, view switcher) and a
// contextual right rail, with a floating composer over the canvas. Still
// owns the one piece of client state (WorkspaceState) and the SSE
// consumption; every child below is presentational. Not a chat UI — there
// is no message list, no typing indicator, no chat bubble; POST
// /api/analysis-runs returns a typed event stream and this folds each
// event into the same state a page refresh would reconstruct from
// Postgres (see src/lib/investigation/reconstruct.ts). Tab switching and
// artifact selection are both local state only — never a
// navigation/fetch — so the live run stays connected regardless of which
// view is showing or what's selected in the rail.
import { useEffect, useRef, useState } from "react";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import {
  applyAnalysisEvent,
  isRunActive,
  type WorkspaceState,
} from "@/lib/investigation/reconstruct";
import { SseEventParser } from "@/lib/investigation/parse-sse-events";
import type { MeasurementComparison } from "@/lib/measurements/compare-measurements";
import { InvestigationCanvas } from "./canvas/investigation-canvas";
import { InvestigationControls } from "./investigation-controls";
import { InvestigationTimeline } from "./investigation-timeline";
import { AgentActivityPanel } from "./agent-activity-panel";
import { AgentMetricsPanel } from "./agent-metrics-panel";
import { SourcesPanel } from "./sources-panel";
import { SourceDrawer } from "./source-drawer";
import { TopBar } from "./top-bar";
import { AgentStatusPill } from "./agent-status-pill";
import { ViewSwitcher, type InvestigationTab } from "./view-switcher";
import { ContextRail, type RailSelection } from "./context-rail";
import { EvidenceView } from "./evidence-view";
import { CASE_COMPOSER_INPUT_ID, CaseComposer } from "./case-composer";
import { deriveSourcesUsed } from "./derive-sources-used";
import { canvasBackground, surface, text } from "./theme";

interface OpenCitationState {
  citation: EvidenceCitation;
  category: EvidenceCategory;
  hypothesisIndex: number;
  hypothesisTitle: string;
}

interface InvestigationWorkspaceProps {
  caseId: string;
  productId: string;
  revisionId: string;
  /** Optional — defaults to the empty-state label so every pre-MVP-11 test
   * call site keeps working unmodified. */
  currentRevisionLabel?: string;
  /** UX-01: shown in the top bar. Optional/defaults to "" so every
   * pre-UX-01 test call site keeps working unmodified — the real page.tsx
   * always has this from getFailureCase. */
  productName?: string;
  hasMultipleRevisions?: boolean;
  productFacts: ProductFactRecord[];
  measurement: MeasurementRow | null;
  initialState: WorkspaceState;
  /** Optional — defaults to empty so every pre-MVP-11 test call site (no
   * timeline data to pass) keeps working unmodified. */
  timelineEntries?: TimelineEntry[];
  /** UX-04: true when the page was reached via the new-investigation
   * intake flow's `?autorun=1` redirect — triggers the run once on mount
   * instead of waiting for an explicit click, so "Crado investigates"
   * genuinely follows "Crado understood" without an extra button press.
   * Optional/defaults to false so every pre-UX-04 test call site keeps
   * working unmodified. */
  autoRun?: boolean;
}

export function InvestigationWorkspace({
  caseId,
  productId,
  revisionId,
  currentRevisionLabel = "",
  productName = "",
  hasMultipleRevisions = false,
  productFacts,
  measurement,
  initialState,
  timelineEntries = [],
  autoRun = false,
}: InvestigationWorkspaceProps) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openCitation, setOpenCitation] = useState<OpenCitationState | null>(null);
  const [selection, setSelection] = useState<RailSelection>(null);
  const [activeTab, setActiveTab] = useState<InvestigationTab>("investigation");
  // MVP-11 timeline live-update fix: local state seeded from the
  // server-fetched timeline, appended to directly inside the SSE loop below
  // as hypothesis.created events arrive — never via a useEffect watching
  // `state` (that pattern already tripped the set-state-in-effect lint rule
  // once in this file's history). A full page refresh still discards this
  // and reconstructs the real, persisted timeline from Postgres
  // (getInvestigationTimeline in page.tsx) — this is purely a same-session
  // "don't wait for a refresh to see what just streamed in" fix.
  const [timeline, setTimeline] = useState<TimelineEntry[]>(timelineEntries);
  // Belt-and-suspenders duplicate-run guard: `disabled` on the button lags
  // one render behind a click, so a fast double-click could otherwise fire
  // two POSTs before React re-renders. This ref is checked synchronously.
  const runInFlightRef = useRef(false);

  function handleOpenCitation(
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) {
    setOpenCitation({ citation, category, hypothesisIndex, hypothesisTitle });
    // UX-03: clicking a source updates the context rail too, not just the
    // full-passage drawer — so once the drawer closes, the rail keeps
    // showing that source's provenance at a glance.
    setSelection({ kind: "source", citation, category, hypothesisIndex, hypothesisTitle });
  }

  function handleSelectHypothesis(hypothesis: HypothesisCreatedPayload, index: number) {
    setSelection({ kind: "hypothesis", hypothesis, index });
  }

  function handleSelectMeasurement() {
    setSelection({ kind: "measurement" });
  }

  // UX-04 live-update: the composer's Measurement/Observation intents call
  // these right after their own server action succeeds, so the new
  // artifact appears on the canvas immediately — the same
  // append-to-local-timeline precedent the hypothesis.created SSE handler
  // above already established, not a new pattern. A page refresh still
  // reconstructs the authoritative version of the same entry from
  // Postgres; this is purely a same-session "don't wait for a refresh"
  // fix, exactly like the MVP-11 timeline live-update comment above
  // describes for hypotheses.
  function handleObservationRecorded(entry: { observation: string; measurementChange: string | null }) {
    setTimeline((prev) => [
      ...prev,
      {
        type: "observation",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        observation: entry.observation,
        measurementChange: entry.measurementChange,
      },
    ]);
  }

  function handleMeasurementRecorded(comparison: MeasurementComparison | null) {
    if (!comparison) return;
    setTimeline((prev) => [
      ...prev,
      { type: "result", id: crypto.randomUUID(), createdAt: new Date().toISOString(), comparison },
    ]);
  }

  const hasPeak = (measurement?.peaks.length ?? 0) > 0;
  const canRunAnalysis = measurement !== null && hasPeak && !isRunActive(state.status);
  const disabledReason = !measurement
    ? "Add a measurement before running an investigation."
    : !hasPeak
      ? "This measurement has no recorded peak yet."
      : null;

  // UX-04: fire the run exactly once when the intake flow lands here with
  // ?autorun=1 — and only for a genuinely fresh investigation
  // (state.status === "idle"). canRunAnalysis alone isn't a safe guard: it
  // is also true for a COMPLETED or FAILED run that's simply eligible for
  // RE-EVALUATE/RUN AGAIN, so relying on it here would silently re-trigger
  // a real analysis run on every reload of an old tab/bookmark that still
  // carries a stale ?autorun=1 (the query-param strip below only runs
  // client-side after the effect fires, so a page saved/reloaded before it
  // ever ran would otherwise re-fire indefinitely). The query param is
  // stripped right after so a subsequent refresh replays from persisted
  // state instead of re-triggering anything.
  const autoRunFiredRef = useRef(false);
  useEffect(() => {
    if (!autoRun || autoRunFiredRef.current || state.status !== "idle" || !canRunAnalysis) return;
    autoRunFiredRef.current = true;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("autorun");
      window.history.replaceState({}, "", url);
    }
    void handleRunInvestigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleRunInvestigation is recreated every render (it closes over state); the autoRunFiredRef guard is what makes this safe to run once, not the dependency list.
  }, [autoRun, canRunAnalysis, state.status]);

  async function handleRunInvestigation() {
    if (runInFlightRef.current || isRunActive(state.status) || !measurement) {
      return;
    }
    runInFlightRef.current = true;
    setIsSubmitting(true);
    setActiveTab("investigation");

    try {
      const response = await fetch("/api/analysis-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          failureCaseId: caseId,
          measurementId: measurement.id,
        }),
      });

      if (!response.ok || !response.body) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          errorMessage: "Could not start the analysis. Try again.",
          lastEventSummary: "Analysis failed",
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseEventParser();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const events = parser.push(decoder.decode(value, { stream: true }));
        for (const event of events) {
          setState((prev) => applyAnalysisEvent(prev, event));
          if (event.type === "hypothesis.created") {
            setTimeline((prev) => [
              ...prev,
              {
                type: "hypothesis",
                id: `${event.runId}:${event.sequence}`,
                createdAt: event.createdAt,
                title: event.payload.title,
                confidenceBand: event.payload.confidenceBand,
                recommendedNextStep: event.payload.recommendedNextStep,
                update: event.payload.update ?? null,
                revisionLabel: measurement?.revisionLabel ?? null,
              },
            ]);
          }
        }
      }

      // The stream ended without a terminal event — the connection closed
      // mid-run. Never leave the UI implying a run is still active.
      setState((prev) =>
        prev.status === "running"
          ? {
              ...prev,
              status: "failed",
              errorMessage:
                "The connection closed before the analysis finished. Try again.",
              lastEventSummary: "Analysis interrupted",
            }
          : prev,
      );
    } catch {
      setState((prev) => ({
        ...prev,
        status: "failed",
        errorMessage: "Lost connection to the analysis service. Try again.",
        lastEventSummary: "Connection lost",
      }));
    } finally {
      runInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  const sourcesUsedCount = deriveSourcesUsed(state.hypotheses).length;
  const busy = isSubmitting || state.status === "running";

  return (
    <>
      <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
        <TopBar
          caseId={caseId}
          backHref={`/cases/${caseId}`}
          backLabel={`Radiated emissions — ${productName} ${currentRevisionLabel}`.trim()}
          productName={productName}
          revisionLabel={currentRevisionLabel}
          caseTitle="Radiated emissions"
          statusPill={<AgentStatusPill status={state.status} busy={isSubmitting} hasMeasurement={measurement !== null} />}
          rightSlot={<ViewSwitcher activeTab={activeTab} onSelectTab={setActiveTab} />}
        />

        <div className="flex min-h-0 flex-1">
          {/* One canvas, four views — switching tabs never unmounts the SSE
              connection above; only what's rendered here changes. The dot
              grid is the canvas's one deliberate texture (Investigation
              view only — the other three are dense information views, not
              a graph surface). Bottom padding clears the floating
              composer. */}
          <div
            className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-32 pt-5 sm:px-6 ${
              activeTab === "investigation" ? canvasBackground : ""
            }`}
          >
            {activeTab === "investigation" ? (
              <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
                <InvestigationControls
                  caseId={caseId}
                  productId={productId}
                  revisionId={revisionId}
                  currentRevisionLabel={currentRevisionLabel}
                  hasMultipleRevisions={hasMultipleRevisions}
                  state={state}
                  canRunAnalysis={canRunAnalysis}
                  isSubmitting={isSubmitting}
                  disabledReason={disabledReason}
                  onRunInvestigation={handleRunInvestigation}
                />
                <AgentActivityPanel
                  activity={state.agentActivity}
                  active={state.agentActive}
                  durationMs={state.agentMetrics?.totalDurationMs}
                  defaultCollapsed={!state.agentActive && state.hypotheses.length > 0}
                />
                {/* The graph IS the correlation/hypothesis/history view now —
                    no separate stacked cards. buildCanvasGraph folds the
                    measurement, live/reconstructed state, and full
                    timeline into one auto-laid-out chain; it renders
                    nothing until there's at least a measurement. */}
                <InvestigationCanvas
                  measurement={measurement}
                  state={state}
                  timeline={timeline}
                  onSelectMeasurement={handleSelectMeasurement}
                  onSelectHypothesis={handleSelectHypothesis}
                  onRecordResult={() => {
                    setActiveTab("investigation");
                    document.getElementById(CASE_COMPOSER_INPUT_ID)?.focus();
                  }}
                />
                {state.agentMetrics ? (
                  <div className="mt-2">
                    <AgentMetricsPanel
                      metrics={state.agentMetrics}
                      toolCallCount={state.agentActivity.length}
                      sourcesUsedCount={sourcesUsedCount}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "evidence" ? (
              <div className="mx-auto w-full max-w-[900px]">
                <EvidenceView
                  hypotheses={state.hypotheses}
                  revisionLabel={currentRevisionLabel}
                  onOpenCitation={handleOpenCitation}
                  onSelectHypothesis={handleSelectHypothesis}
                />
              </div>
            ) : null}

            {activeTab === "timeline" ? (
              <div className="mx-auto w-full max-w-[760px]">
                <InvestigationTimeline entries={timeline} />
              </div>
            ) : null}

            {activeTab === "sources" ? (
              <div className="mx-auto w-full max-w-[900px]">
                <SourcesPanel hypotheses={state.hypotheses} metrics={state.agentMetrics} />
              </div>
            ) : null}
          </div>

          <div className="hidden shrink-0 py-5 pr-4 lg:block xl:pr-6">
            <ContextRail
              selection={selection}
              onClear={() => setSelection(null)}
              onOpenFullSource={handleOpenCitation}
              productName={productName}
              revisionLabel={currentRevisionLabel}
              productFacts={productFacts}
              measurement={measurement}
              agentMetrics={state.agentMetrics}
            />
          </div>
        </div>

        <div className="pointer-events-none sticky bottom-0 flex flex-col items-center gap-1.5 px-4 pb-4 pt-2 sm:px-6">
          <div className="pointer-events-auto w-full">
            <CaseComposer
              caseId={caseId}
              productId={productId}
              revisionId={revisionId}
              currentRevisionLabel={currentRevisionLabel}
              measurement={measurement}
              onMeasurementRecorded={handleMeasurementRecorded}
              onObservationRecorded={handleObservationRecorded}
            />
          </div>
          {busy ? (
            <p className={`text-xs ${text.muted}`} role="status" aria-live="polite">
              Crado is investigating — you can still add an observation while it works.
            </p>
          ) : null}
        </div>
      </div>

      <SourceDrawer
        citation={openCitation?.citation ?? null}
        hypothesisTitle={openCitation?.hypothesisTitle ?? null}
        hypothesisIndex={openCitation?.hypothesisIndex ?? null}
        evidenceCategory={openCitation?.category ?? null}
        onClose={() => setOpenCitation(null)}
      />
    </>
  );
}
