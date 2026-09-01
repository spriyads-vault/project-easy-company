"use client";

// UX-02: client orchestrator for the agentic-engineering-workspace layout —
// one active task (this investigation) dominates the screen as a single
// scrolling canvas with quiet tabs (Investigation/Evidence/Timeline/
// Sources) instead of UX-01's three-column panel grid, plus a persistent
// bottom composer. Still owns the one piece of client state (WorkspaceState)
// and the SSE consumption; every child below is presentational. Not a chat
// UI — there is no message list, no typing indicator, no chat bubble;
// POST /api/analysis-runs returns a typed event stream and this folds each
// event into the same state a page refresh would reconstruct from Postgres
// (see src/lib/investigation/reconstruct.ts). Tab switching is local state
// only — never a navigation/fetch — so the live run stays connected
// regardless of which tab is showing.
import { useRef, useState } from "react";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import {
  applyAnalysisEvent,
  isRunActive,
  type WorkspaceState,
} from "@/lib/investigation/reconstruct";
import { SseEventParser } from "@/lib/investigation/parse-sse-events";
import { ProductPanel } from "./product-panel";
import { MeasurementPanel } from "./measurement-panel";
import { InvestigationPanel } from "./investigation-panel";
import { InvestigationHero } from "./investigation-hero";
import { InvestigationTimeline } from "./investigation-timeline";
import { RevisionComparisonCard } from "./revision-comparison-card";
import { AgentActivityPanel } from "./agent-activity-panel";
import { AgentMetricsPanel } from "./agent-metrics-panel";
import { SourcesPanel } from "./sources-panel";
import { SourceDrawer } from "./source-drawer";
import { CaseNav, type InvestigationTab } from "./case-nav";
import { EvidenceView } from "./evidence-view";
import { CaseComposer } from "./case-composer";
import { deriveSourcesUsed } from "./derive-sources-used";
import { surface } from "./theme";

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
  /** UX-01: shown in the agent-presence header. Optional/defaults to "" so
   * every pre-UX-01 test call site keeps working unmodified — the real
   * page.tsx always has this from getFailureCase. */
  productName?: string;
  hasMultipleRevisions?: boolean;
  productFacts: ProductFactRecord[];
  measurement: MeasurementRow | null;
  initialState: WorkspaceState;
  /** Optional — defaults to empty so every pre-MVP-11 test call site (no
   * timeline data to pass) keeps working unmodified. */
  timelineEntries?: TimelineEntry[];
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
}: InvestigationWorkspaceProps) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openCitation, setOpenCitation] = useState<OpenCitationState | null>(null);
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
  const comparisonEntry = timeline.find((entry) => entry.type === "result");

  function handleOpenCitation(
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) {
    setOpenCitation({ citation, category, hypothesisIndex, hypothesisTitle });
  }

  const hasPeak = (measurement?.peaks.length ?? 0) > 0;
  const canRunAnalysis = measurement !== null && hasPeak && !isRunActive(state.status);
  const disabledReason = !measurement
    ? "Add a measurement before running an investigation."
    : !hasPeak
      ? "This measurement has no recorded peak yet."
      : null;

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
      <div className={`flex flex-1 flex-col ${surface.page}`}>
        <div className="px-4 pt-4 sm:px-6">
          <InvestigationHero
            productName={productName}
            revisionLabel={currentRevisionLabel}
            measurement={measurement}
            status={state.status}
            busy={isSubmitting}
          />
        </div>

        <CaseNav
          caseId={caseId}
          productName={productName}
          revisionLabel={currentRevisionLabel}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />

        {/* One canvas, four views — switching tabs never unmounts the SSE
            connection above; only what's rendered here changes. Bottom
            padding clears the fixed composer bar. */}
        <div className="flex flex-1 flex-col gap-4 px-4 pb-28 pt-4 sm:px-6">
          {activeTab === "investigation" ? (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-start lg:gap-6">
              <div className="flex flex-col gap-4">
                <MeasurementPanel caseId={caseId} measurement={measurement} />
                <AgentActivityPanel
                  activity={state.agentActivity}
                  active={state.agentActive}
                  durationMs={state.agentMetrics?.totalDurationMs}
                  defaultCollapsed={!state.agentActive && state.hypotheses.length > 0}
                />
                <InvestigationPanel
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
                  onOpenCitation={handleOpenCitation}
                />
                {comparisonEntry?.type === "result" ? (
                  <RevisionComparisonCard comparison={comparisonEntry.comparison} />
                ) : null}
                {state.agentMetrics ? (
                  <AgentMetricsPanel
                    metrics={state.agentMetrics}
                    toolCallCount={state.agentActivity.length}
                    sourcesUsedCount={sourcesUsedCount}
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-4">
                <ProductPanel productId={productId} revisionId={revisionId} facts={productFacts} />
              </div>
            </div>
          ) : null}

          {activeTab === "evidence" ? (
            <EvidenceView hypotheses={state.hypotheses} onOpenCitation={handleOpenCitation} />
          ) : null}

          {activeTab === "timeline" ? <InvestigationTimeline entries={timeline} /> : null}

          {activeTab === "sources" ? (
            <SourcesPanel hypotheses={state.hypotheses} metrics={state.agentMetrics} />
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-[#e7e2d6] bg-[#faf8f3]/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <CaseComposer caseId={caseId} />
          {busy ? (
            <p className="mt-2 text-xs text-[#847c6a]" role="status" aria-live="polite">
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
