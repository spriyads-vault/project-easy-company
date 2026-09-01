"use client";

// Client orchestrator for the three-region investigation workspace. Owns
// the one piece of client state (WorkspaceState) and the SSE consumption;
// every panel below is presentational. Not a chat UI — there is no message
// list, no typing indicator, no chat bubble; POST /api/analysis-runs
// returns a typed event stream and this folds each event into the same
// panels a page refresh would reconstruct from Postgres (see
// src/lib/investigation/reconstruct.ts).
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
import { InvestigationTimeline } from "./investigation-timeline";
import { RevisionComparisonCard } from "./revision-comparison-card";
import { AgentActivityPanel } from "./agent-activity-panel";
import { AgentMetricsPanel } from "./agent-metrics-panel";
import { SourcesPanel } from "./sources-panel";
import { SourceDrawer } from "./source-drawer";
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
  hasMultipleRevisions = false,
  productFacts,
  measurement,
  initialState,
  timelineEntries = [],
}: InvestigationWorkspaceProps) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openCitation, setOpenCitation] = useState<OpenCitationState | null>(null);
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

  return (
    <>
      <div
        className={`grid flex-1 grid-cols-1 content-start gap-4 p-4 md:grid-cols-2 lg:grid-cols-[minmax(260px,320px)_minmax(320px,1fr)_minmax(380px,1.2fr)] ${surface.page}`}
      >
        {/* Mobile order: Measurement, Investigation, Timeline, Agent
            activity, What Crado handled, Sources, Product — desktop
            reflows into the three-column PRODUCT|MEASUREMENT|INVESTIGATION
            row plus full-width rows below it. */}
        <div className="order-9 md:order-1 lg:order-1">
          <ProductPanel productId={productId} revisionId={revisionId} facts={productFacts} />
        </div>
        <div className="order-1 md:order-2 lg:order-2">
          <MeasurementPanel caseId={caseId} measurement={measurement} />
        </div>
        <div className="order-2 md:col-span-2 md:order-3 lg:col-span-1 lg:order-3">
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
        </div>
        {comparisonEntry?.type === "result" ? (
          <div className="order-3 md:order-4 md:col-span-2 lg:col-span-3 lg:order-4">
            <RevisionComparisonCard comparison={comparisonEntry.comparison} />
          </div>
        ) : null}
        <div className="order-5 md:order-5 md:col-span-2 lg:col-span-3 lg:order-5">
          <InvestigationTimeline entries={timeline} />
        </div>
        <div className="order-6 md:order-6 md:col-span-2 lg:col-span-3 lg:order-6">
          <AgentActivityPanel activity={state.agentActivity} active={state.agentActive} />
        </div>
        {state.agentMetrics ? (
          <div className="order-7 md:order-7 md:col-span-2 lg:col-span-3 lg:order-7">
            <AgentMetricsPanel metrics={state.agentMetrics} />
          </div>
        ) : null}
        <div className="order-8 md:order-8 md:col-span-2 lg:col-span-3 lg:order-8">
          <SourcesPanel hypotheses={state.hypotheses} metrics={state.agentMetrics} />
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
