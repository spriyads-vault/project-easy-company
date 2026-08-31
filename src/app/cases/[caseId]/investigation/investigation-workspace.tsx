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
import {
  applyAnalysisEvent,
  isRunActive,
  type WorkspaceState,
} from "@/lib/investigation/reconstruct";
import { SseEventParser } from "@/lib/investigation/parse-sse-events";
import { ProductPanel } from "./product-panel";
import { MeasurementPanel } from "./measurement-panel";
import { InvestigationPanel } from "./investigation-panel";
import { surface } from "./theme";

interface InvestigationWorkspaceProps {
  caseId: string;
  productId: string;
  revisionId: string;
  productFacts: ProductFactRecord[];
  measurement: MeasurementRow | null;
  initialState: WorkspaceState;
}

export function InvestigationWorkspace({
  caseId,
  productId,
  revisionId,
  productFacts,
  measurement,
  initialState,
}: InvestigationWorkspaceProps) {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Belt-and-suspenders duplicate-run guard: `disabled` on the button lags
  // one render behind a click, so a fast double-click could otherwise fire
  // two POSTs before React re-renders. This ref is checked synchronously.
  const runInFlightRef = useRef(false);

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
    <div
      className={`grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-[minmax(260px,320px)_minmax(320px,1fr)_minmax(380px,1.2fr)] ${surface.page}`}
    >
      <div className="lg:order-1">
        <ProductPanel productId={productId} revisionId={revisionId} facts={productFacts} />
      </div>
      <div className="lg:order-2">
        <MeasurementPanel caseId={caseId} measurement={measurement} />
      </div>
      <div className="md:col-span-2 lg:order-3 lg:col-span-1">
        <InvestigationPanel
          state={state}
          canRunAnalysis={canRunAnalysis}
          isSubmitting={isSubmitting}
          disabledReason={disabledReason}
          onRunInvestigation={handleRunInvestigation}
        />
      </div>
    </div>
  );
}
