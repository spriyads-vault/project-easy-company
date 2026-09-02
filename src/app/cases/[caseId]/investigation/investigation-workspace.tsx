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
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
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
import { MobileInvestigationStack } from "./canvas/investigation-stack";
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Two independent breakpoints, not one binary desktop/mobile split — the
// visual-correction ticket asked to review `< lg` rather than preserve it
// automatically, since the OLD narrow vertical canvas genuinely was
// unusable below 1024px, but the NEW horizontal, pannable/zoomable
// layout is not. So:
//   - CANVAS_QUERY (below `md`, 768px): the investigation graph itself
//     stops being usable — the mobile stack takes over.
//   - RAIL_QUERY (below `lg`, 1024px): unchanged from before — there just
//     isn't room for a persistent side rail next to the canvas, so the
//     Sheet substitutes for it. Between 768 and 1024 ("laptop/tablet"),
//     the canvas renders full-width with pan/zoom and the Sheet stands in
//     for the rail; at 1024+ ("large desktop") the canvas sits beside the
//     real resizable rail.
const CANVAS_QUERY = "(max-width: 767px)";
const RAIL_QUERY = "(max-width: 1023px)";

function subscribeToMediaQuery(query: string): (onChange: () => void) => () => void {
  return (onChange) => {
    // jsdom (the unit-test environment) does not implement matchMedia —
    // fall back to "never changes" rather than throwing, same as a very
    // old browser without matchMedia support would.
    if (typeof window.matchMedia !== "function") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

function getMediaQuerySnapshot(query: string): () => boolean {
  return () => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  };
}

// No viewport on the server — default to "not matched" (the widest/most
// capable tier) so nothing mobile-only accidentally renders in the SSR
// HTML; useSyncExternalStore reconciles this against the real client
// value after hydration, which is what it's for (this is the
// React-endorsed way to read an external, subscription-based value like
// matchMedia without a synchronous setState-in-effect, which this repo's
// lint config hard-errors on).
function getMediaQueryServerSnapshot(): boolean {
  return false;
}

function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(() => subscribeToMediaQuery(query), [query]);
  const getSnapshot = useMemo(() => getMediaQuerySnapshot(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getMediaQueryServerSnapshot);
}

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
  // UX-04 resizable rail: react-resizable-panels drives the rail's actual
  // collapsed/expanded size; `railCollapsed` just mirrors that (via the
  // panel's own onCollapse/onExpand callbacks) so ContextRail's button
  // renders the right state whichever side triggered the change — the
  // drag handle collapsing past its threshold, or the button itself.
  const railPanelRef = useRef<ImperativePanelHandle>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const belowCanvasBreakpoint = useMediaQuery(CANVAS_QUERY);
  const belowRailBreakpoint = useMediaQuery(RAIL_QUERY);

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

  function handleRecordResult() {
    setActiveTab("investigation");
    document.getElementById(CASE_COMPOSER_INPUT_ID)?.focus();
  }

  // Shared by the desktop and mobile branches below so the Evidence,
  // Timeline, Sources and Investigation-controls/agent-activity bodies
  // are written once — only the Investigation tab's canvas artifact
  // (`canvas` param: the real React Flow canvas on desktop, the plain
  // vertical stack on mobile) differs between the two callers.
  function renderTabContent(canvas: ReactNode): ReactNode {
    return (
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
            {canvas}
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
    );
  }

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

        {/* Three responsive tiers, not one binary split reflowed by CSS
            alone: below `md` (768) the canvas itself stops being usable —
            the mobile stack takes over (no split, no React Flow). At
            768-1023 ("laptop/tablet") the horizontal, pannable/zoomable
            canvas is perfectly usable, it just doesn't have room for a
            persistent side rail — the canvas renders full-width and the
            Sheet substitutes for the rail. At 1024+ ("large desktop") the
            canvas sits beside the real resizable rail. Exactly one branch
            ever mounts per render (never two behind `hidden`/`lg:hidden`)
            — the canvas is only ever initialized inside a container with
            real bounds (react-flow sizes itself from those bounds at
            mount), and the test environment, which doesn't evaluate CSS
            media queries, never sees more than one branch's content at
            once. */}
        {belowCanvasBreakpoint ? (
          <div className="flex min-h-0 flex-1">
            {renderTabContent(
              <MobileInvestigationStack
                measurement={measurement}
                state={state}
                timeline={timeline}
                onSelectMeasurement={handleSelectMeasurement}
                onSelectHypothesis={handleSelectHypothesis}
                onRecordResult={handleRecordResult}
              />,
            )}
          </div>
        ) : belowRailBreakpoint ? (
          <div className="flex min-h-0 flex-1">
            {renderTabContent(
              <InvestigationCanvas
                measurement={measurement}
                state={state}
                timeline={timeline}
                onSelectMeasurement={handleSelectMeasurement}
                onSelectHypothesis={handleSelectHypothesis}
                onRecordResult={handleRecordResult}
              />,
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={76} minSize={50}>
                {/* One canvas, four views — switching tabs never unmounts
                    the SSE connection above; only what's rendered here
                    changes. The dot grid is the canvas's one deliberate
                    texture (Investigation view only). Bottom padding
                    clears the floating composer. */}
                {renderTabContent(
                  <InvestigationCanvas
                    measurement={measurement}
                    state={state}
                    timeline={timeline}
                    onSelectMeasurement={handleSelectMeasurement}
                    onSelectHypothesis={handleSelectHypothesis}
                    onRecordResult={handleRecordResult}
                  />,
                )}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                ref={railPanelRef}
                defaultSize={24}
                minSize={18}
                maxSize={38}
                collapsible
                collapsedSize={4}
                onCollapse={() => setRailCollapsed(true)}
                onExpand={() => setRailCollapsed(false)}
                className="py-5 pr-4 xl:pr-6"
              >
                <ContextRail
                  selection={selection}
                  onClear={() => setSelection(null)}
                  onOpenFullSource={handleOpenCitation}
                  productName={productName}
                  revisionLabel={currentRevisionLabel}
                  productFacts={productFacts}
                  measurement={measurement}
                  agentMetrics={state.agentMetrics}
                  collapsed={railCollapsed}
                  onCollapse={() => railPanelRef.current?.collapse()}
                  onExpand={() => railPanelRef.current?.expand()}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}

        {/* The rail substitute for both the mobile-stack tier and the
            tablet/laptop canvas-without-rail tier: tapping a measurement
            or hypothesis sets the same `selection` state a desktop canvas
            click does, opened here as a bottom sheet reusing ContextRail's
            own detail views verbatim — never a second, divergent
            implementation of the same content. Gated on
            `belowRailBreakpoint` (not just an `lg:hidden` className on the
            sheet itself) so Radix's overlay/focus-trap never activates on
            large desktop, where the persistent rail already shows the
            same selection. */}
        <Sheet
          open={belowRailBreakpoint && selection !== null}
          onOpenChange={(open) => {
            if (!open) setSelection(null);
          }}
        >
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>
                {selection?.kind === "measurement"
                  ? "Measurement"
                  : selection?.kind === "hypothesis"
                    ? "Hypothesis details"
                    : selection?.kind === "source"
                      ? "Source"
                      : "Case"}
              </SheetTitle>
            </SheetHeader>
            <ContextRail
              selection={selection}
              onClear={() => setSelection(null)}
              onOpenFullSource={handleOpenCitation}
              productName={productName}
              revisionLabel={currentRevisionLabel}
              productFacts={productFacts}
              measurement={measurement}
              agentMetrics={state.agentMetrics}
              collapsed={false}
              onCollapse={() => setSelection(null)}
              onExpand={() => {}}
              showCollapseButton={false}
            />
          </SheetContent>
        </Sheet>

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
