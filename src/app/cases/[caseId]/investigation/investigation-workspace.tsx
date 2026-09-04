"use client";

// CLIENT ORCHESTRATOR for the investigation result page (App Redesign,
// Workstream C correction): a full-height operational workbench — a
// persistent Trace pane, a flat Decision workbench, and a contextual
// Inspector, framed by a compact case header — not a connected artifact
// canvas with a floating composer and stacked cards. Still owns the one
// piece of client state (WorkspaceState) and the SSE consumption; every
// child below is presentational. Not a chat UI — there is no message
// list, no typing indicator, no chat bubble; POST /api/analysis-runs
// returns a typed event stream and this folds each event into the same
// state a page refresh would reconstruct from Postgres (see
// src/lib/investigation/reconstruct.ts). Tab switching and artifact
// selection are both local state only — never a navigation/fetch — so
// the live run stays connected regardless of which view is showing or
// what's selected in the inspector.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { rankHypotheses } from "@/lib/investigation/rank-hypotheses";
import {
  applyAnalysisEvent,
  isRunActive,
  type WorkspaceState,
} from "@/lib/investigation/reconstruct";
import { SseEventParser } from "@/lib/investigation/parse-sse-events";
import type { MeasurementComparison } from "@/lib/measurements/compare-measurements";
import { InvestigationCanvas } from "./canvas/investigation-canvas";
import { MobileInvestigationStack } from "./canvas/investigation-stack";
import { DecisionView } from "./decision-view";
import { NextActionBar } from "./next-action-bar";
import { InvestigationTimeline } from "./investigation-timeline";
import { InvestigationTracePanel } from "./investigation-trace-panel";
import { AgentMetricsPanel } from "./agent-metrics-panel";
import { SourcesPanel } from "./sources-panel";
import { SourceDrawer } from "./source-drawer";
import { TopBar } from "./top-bar";
import { AgentStatusPill } from "./agent-status-pill";
import { RunInvestigationButton } from "./run-investigation-button";
import { ViewSwitcher, type InvestigationTab } from "./view-switcher";
import { ContextRail, type RailSelection } from "./context-rail";
import { EvidenceView } from "./evidence-view";
import { CASE_COMPOSER_INPUT_ID, CaseComposer } from "./case-composer";
import { deriveSourcesUsed } from "./derive-sources-used";
import { canvasBackground, surface, text } from "./theme";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Two independent breakpoints, not one binary desktop/mobile split:
//   - CANVAS_QUERY (below `md`, 768px): the investigation graph itself
//     stops being usable — the mobile stack takes over.
//   - RAIL_QUERY (below `lg`, 1024px): there just isn't room for a
//     persistent Trace pane + Inspector next to the main workbench, so a
//     Sheet substitutes for the Inspector and Trace renders inline.
//     Between 768 and 1024 ("laptop/tablet"), the canvas renders
//     full-width with pan/zoom; at 1024+ ("large desktop") the workbench
//     sits inside the real three-pane resizable split.
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

/** The most recent real persisted-event timestamp this session knows
 * about — never a fabricated "just now"; null (rendered as nothing) when
 * the case genuinely has no timeline entries yet. ISO 8601 strings sort
 * correctly as plain strings, so no Date parsing is needed to find the
 * max. */
function latestTimelineTimestamp(timeline: TimelineEntry[]): string | null {
  if (timeline.length === 0) return null;
  return timeline.reduce((latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest), timeline[0].createdAt);
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
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
  /** UX-05: the failure_cases row's own status — the only source of
   * "Resolved" in the top-bar status text. Optional/defaults to "open" so
   * every pre-UX-05 test call site keeps working unmodified. */
  caseStatus?: "open" | "resolved" | "archived";
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
  caseStatus = "open",
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
  // UX-05: Decision is the default landing tab — see view-switcher.tsx.
  const [activeTab, setActiveTab] = useState<InvestigationTab>("decision");
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
  // Desktop Inspector: react-resizable-panels drives the panel's actual
  // collapsed/expanded size; `railCollapsed` mirrors that (via the panel's
  // own onCollapse/onExpand callbacks) so ContextRail's button renders the
  // right state whichever side triggered the change. App Redesign
  // correction: the Inspector now starts COLLAPSED (a narrow rail, not a
  // large empty "nothing selected" panel) and expands only when a real
  // selection happens — see the selection handlers below, each of which
  // calls railPanelRef.current?.expand().
  const railPanelRef = useRef<ImperativePanelHandle>(null);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const belowCanvasBreakpoint = useMediaQuery(CANVAS_QUERY);
  const belowRailBreakpoint = useMediaQuery(RAIL_QUERY);

  // App Redesign: a trace step, clicked, focuses the real category of
  // table row it produced — see investigation-item-table.tsx's own
  // comment on why this is a category-level, not a precise 1:1, link.
  // Cleared automatically after a brief emphasis window, never a
  // continuous pulse.
  const [focusedCategory, setFocusedCategory] = useState<"deterministic" | "hypothesis" | null>(null);
  const focusClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(focusClearTimeoutRef.current), []);

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
    expandInspector();
  }

  // Both calls, deliberately: the imperative ref call physically resizes
  // the real panel (what a live browser needs), but react-resizable-panels
  // resolves that resize from actual DOM layout — unavailable in jsdom,
  // and even in a real browser not guaranteed to resolve synchronously
  // within this same event handler. Setting railCollapsed directly makes
  // ContextRail switch to its expanded rendering immediately and
  // deterministically either way; if the panel's own onExpand callback
  // fires a moment later it just confirms the same value.
  function expandInspector() {
    railPanelRef.current?.expand();
    setRailCollapsed(false);
  }

  function handleSelectCorrelation(correlation: CorrelationFoundPayload) {
    setSelection({ kind: "correlation", correlation });
    expandInspector();
  }

  function handleSelectHypothesis(hypothesis: HypothesisCreatedPayload, index: number) {
    setSelection({ kind: "hypothesis", hypothesis, index });
    expandInspector();
  }

  function handleSelectMeasurement() {
    setSelection({ kind: "measurement" });
    expandInspector();
  }

  /** Real, limited "selecting a trace step focuses the affected item"
   * support (App Redesign) — routes on the step's own already-safe
   * display label text, since the wire schema carries no structured link
   * from a tool call to the specific hypothesis/correlation it produced.
   * An honest category-level connection, not a fabricated precise one. */
  function handleTraceStepSelect(label: string) {
    const lower = label.toLowerCase();
    if (lower.includes("measurement")) {
      handleSelectMeasurement();
      return;
    }
    if (lower.includes("hypothes")) {
      setFocusedCategory("hypothesis");
    } else if (lower.includes("deterministic") || lower.includes("relationship")) {
      setFocusedCategory("deterministic");
    } else {
      return;
    }
    clearTimeout(focusClearTimeoutRef.current);
    focusClearTimeoutRef.current = setTimeout(() => setFocusedCategory(null), 1200);
  }

  // UX-04 live-update: the composer's Measurement/Observation intents call
  // these right after their own server action succeeds, so the new
  // artifact appears immediately — the same append-to-local-timeline
  // precedent the hypothesis.created SSE handler above already
  // established, not a new pattern. A page refresh still reconstructs the
  // authoritative version of the same entry from Postgres; this is purely
  // a same-session "don't wait for a refresh" fix, exactly like the
  // MVP-11 timeline live-update comment above describes for hypotheses.
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
    // UX-05: no forced tab switch here any more — both Decision and Map
    // now render live from the same WorkspaceState, so starting a run no
    // longer needs to yank the engineer to a specific tab. Whichever tab
    // they're already on (Decision by default) keeps updating in place.

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
  const leadingHypothesis = rankHypotheses(state.hypotheses)[0] ?? null;
  const lastEventTime = latestTimelineTimestamp(timeline);

  function handleRecordResult() {
    setActiveTab("decision");
    document.getElementById(CASE_COMPOSER_INPUT_ID)?.focus();
  }

  // Shared by every responsive tier so the Evidence, Timeline, Sources and
  // Decision bodies are written once — only the Investigation tab's canvas
  // artifact (`canvas` param: the real React Flow canvas on desktop, the
  // plain vertical stack on mobile) and whether the trace panel renders
  // inline differ between callers. `includeTracePanel` is true for the
  // mobile stack and tablet (no-persistent-rail) tiers, where Trace has
  // nowhere else to live. It's false for the ≥1024px desktop tier, where
  // Trace is hoisted into its own persistent pane instead of scrolling
  // away inside the Decision content.
  function renderTabContent(canvas: ReactNode, includeTracePanel: boolean): ReactNode {
    return (
      <div
        className={`min-h-0 flex-1 overflow-y-auto ${activeTab === "decision" ? "" : "px-4 pb-8 pt-5 sm:px-6"} ${
          activeTab === "investigation" ? canvasBackground : ""
        }`}
      >
        {activeTab === "decision" ? (
          <>
            {includeTracePanel ? (
              <div className="px-4 pt-4">
                <InvestigationTracePanel
                  activeTools={state.activeTools}
                  completedActivity={state.agentActivity}
                  active={state.agentActive}
                  durationMs={state.agentMetrics?.totalDurationMs}
                  defaultCollapsed={!state.agentActive && state.hypotheses.length > 0}
                />
              </div>
            ) : null}
            <DecisionView
              caseId={caseId}
              measurement={measurement}
              state={state}
              timeline={timeline}
              selection={selection}
              onSelectMeasurement={handleSelectMeasurement}
              onSelectCorrelation={handleSelectCorrelation}
              onSelectHypothesis={handleSelectHypothesis}
              focusedCategory={focusedCategory}
            />
            {state.agentMetrics ? (
              <AgentMetricsPanel
                metrics={state.agentMetrics}
                toolCallCount={state.agentActivity.length}
                sourcesUsedCount={sourcesUsedCount}
              />
            ) : null}
          </>
        ) : null}

        {activeTab === "investigation" ? (
          <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
            {includeTracePanel ? (
              <InvestigationTracePanel
                activeTools={state.activeTools}
                completedActivity={state.agentActivity}
                active={state.agentActive}
                durationMs={state.agentMetrics?.totalDurationMs}
                defaultCollapsed={!state.agentActive && state.hypotheses.length > 0}
              />
            ) : null}
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

  // Wraps renderTabContent with the pinned next-action bar as a sibling
  // OUTSIDE the scrollable region — App Redesign: "must remain visible
  // while the item table scrolls." Only the Decision tab has one; every
  // other tab's content fills the pane exactly as before.
  function renderMainPane(canvas: ReactNode, includeTracePanel: boolean): ReactNode {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {renderTabContent(canvas, includeTracePanel)}
        {activeTab === "decision" ? (
          <NextActionBar
            caseId={caseId}
            productId={productId}
            revisionId={revisionId}
            currentRevisionLabel={currentRevisionLabel}
            leading={leadingHypothesis}
            showEngineeringChange={state.status !== "running" && state.hypotheses.length > 0}
            onRecordResult={handleRecordResult}
          />
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
          statusPill={
            <AgentStatusPill
              runStatus={state.status}
              busy={isSubmitting}
              hasMeasurement={measurement !== null}
              hypotheses={state.hypotheses}
              timeline={timeline}
              caseStatus={caseStatus}
            />
          }
          rightSlot={
            <>
              {lastEventTime ? (
                <span className="hidden text-xs text-muted-foreground md:inline">
                  Updated {formatRelativeTime(lastEventTime)}
                </span>
              ) : null}
              <RunInvestigationButton
                status={state.status}
                busy={busy}
                hasMultipleRevisions={hasMultipleRevisions}
                canRunAnalysis={canRunAnalysis}
                disabledReason={disabledReason}
                onRunInvestigation={handleRunInvestigation}
              />
            </>
          }
        />

        {/* Compact workspace toolbar (App Redesign: 40-44px, not a
            floating segmented pill) — Decision/Map/Evidence/Timeline/
            Sources, directly below the case header. */}
        <div className="flex h-11 shrink-0 items-center border-b border-border bg-card px-4">
          <ViewSwitcher activeTab={activeTab} onSelectTab={setActiveTab} />
        </div>

        {/* Three responsive tiers, not one binary split reflowed by CSS
            alone: below `md` (768) the canvas itself stops being usable —
            the mobile stack takes over (no split, no React Flow). At
            768-1023 ("laptop/tablet") the horizontal, pannable/zoomable
            canvas is perfectly usable, it just doesn't have room for a
            persistent Trace pane + Inspector — the canvas renders
            full-width and a Sheet substitutes for the Inspector. At
            1024+ ("large desktop") the workbench sits inside the real
            three-pane resizable split. Exactly one branch ever mounts per
            render (never two behind `hidden`/`lg:hidden`) — the canvas is
            only ever initialized inside a container with real bounds
            (react-flow sizes itself from those bounds at mount), and the
            test environment, which doesn't evaluate CSS media queries,
            never sees more than one branch's content at once. */}
        {belowCanvasBreakpoint ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {renderMainPane(
              <MobileInvestigationStack
                measurement={measurement}
                state={state}
                timeline={timeline}
                onSelectMeasurement={handleSelectMeasurement}
                onSelectHypothesis={handleSelectHypothesis}
                onRecordResult={handleRecordResult}
              />,
              true,
            )}
            {/* No persistent Trace pane below 1024px — the composer stays
                a reachable, full-width dock at the bottom of the page,
                exactly as it worked before this pass (unchanged; the
                responsive-tier rebuild is a separate, later delivery-
                sequence step). */}
            <div className="pointer-events-none sticky bottom-0 flex flex-col items-center gap-1.5 border-t border-border bg-card/95 px-4 pb-4 pt-2 backdrop-blur-sm">
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
        ) : belowRailBreakpoint ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {renderMainPane(
              <InvestigationCanvas
                measurement={measurement}
                state={state}
                timeline={timeline}
                onSelectMeasurement={handleSelectMeasurement}
                onSelectHypothesis={handleSelectHypothesis}
                onRecordResult={handleRecordResult}
              />,
              true,
            )}
            <div className="pointer-events-none sticky bottom-0 flex flex-col items-center gap-1.5 border-t border-border bg-card/95 px-4 pb-4 pt-2 backdrop-blur-sm sm:px-6">
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
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Desktop three-pane split (App Redesign Workstream C): Trace
                (persistent, left, with the case composer docked at its
                bottom) / Decision-or-active-tab (main, flat workbench) /
                Inspector (right, collapsed by default). All three are
                siblings in the same resizable panel group — not cards
                placed inside another page. Percentage sizes approximate
                the spec's px bands (Trace 320-420px, Inspector 300-360px)
                against a typical ≥1024px content width after the
                sidebar; each pane still resizes independently within its
                min/max. */}
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={27} minSize={20} maxSize={35} className="border-r border-border">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {state.agentActivity.length === 0 && state.activeTools.length === 0 && !state.agentActive ? (
                    <p className={`text-sm ${text.muted}`}>
                      No trace yet. Run an investigation to see Crado&rsquo;s live agent activity here.
                    </p>
                  ) : (
                    <InvestigationTracePanel
                      activeTools={state.activeTools}
                      completedActivity={state.agentActivity}
                      active={state.agentActive}
                      durationMs={state.agentMetrics?.totalDurationMs}
                      defaultCollapsed={false}
                      onSelectStep={handleTraceStepSelect}
                    />
                  )}
                </div>
                {/* Trace-pane composer (App Redesign): docked here, not
                    floating across the whole viewport. */}
                <div className="shrink-0 border-t border-border p-3">
                  <CaseComposer
                    caseId={caseId}
                    productId={productId}
                    revisionId={revisionId}
                    currentRevisionLabel={currentRevisionLabel}
                    measurement={measurement}
                    onMeasurementRecorded={handleMeasurementRecorded}
                    onObservationRecorded={handleObservationRecorded}
                  />
                  {busy ? (
                    <p className={`mt-1.5 text-xs ${text.muted}`} role="status" aria-live="polite">
                      Crado is investigating — you can still add an observation while it works.
                    </p>
                  ) : null}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={69} minSize={30}>
                {/* One canvas, four views — switching tabs never unmounts
                    the SSE connection above; only what's rendered here
                    changes. The dot grid is the canvas's one deliberate
                    texture (Investigation view only). */}
                {renderMainPane(
                  <InvestigationCanvas
                    measurement={measurement}
                    state={state}
                    timeline={timeline}
                    onSelectMeasurement={handleSelectMeasurement}
                    onSelectHypothesis={handleSelectHypothesis}
                    onRecordResult={handleRecordResult}
                  />,
                  false,
                )}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                ref={railPanelRef}
                defaultSize={4}
                minSize={18}
                maxSize={30}
                collapsible
                collapsedSize={4}
                onCollapse={() => setRailCollapsed(true)}
                onExpand={() => setRailCollapsed(false)}
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

        {/* The Inspector substitute for both the mobile-stack tier and the
            tablet/laptop canvas-without-rail tier: tapping a measurement,
            correlation or hypothesis sets the same `selection` state a
            desktop table/canvas click does, opened here as a bottom sheet
            reusing ContextRail's own detail views verbatim — never a
            second, divergent implementation of the same content. Gated on
            `belowRailBreakpoint` (not just an `lg:hidden` className on the
            sheet itself) so Radix's overlay/focus-trap never activates on
            large desktop, where the persistent Inspector already shows the
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
                  : selection?.kind === "correlation"
                    ? "Deterministic relationship"
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
