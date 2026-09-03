"use client";

// INVESTIGATION CANVAS (UX-04 Agent-Native, visual correction): a visual
// investigation surface, not a workflow editor — nodes are selectable
// (click for context-rail detail) and the canvas pans/zooms, but nothing
// is draggable, connectable, or deletable by the user. The graph
// represents FACTUAL INVESTIGATION STATE (auto-laid-out by
// build-canvas-graph.ts), never something the engineer arranges.
//
// TWO-PASS LAYOUT: buildCanvasGraph's default pass uses static per-kind
// height ESTIMATES (good enough for first paint, and it's all a pure
// function can know without a DOM). Once React Flow has actually
// measured every node (useNodesInitialized flips true — the officially
// documented pattern for this, see xyflow's own useNodesInitialized
// docs), this re-runs buildCanvasGraph a second time with a height
// lookup backed by those real measurements and re-fits the view. This is
// what "recalculate layout after node dimensions become available"
// means in practice — it's what prevents a long hypothesis or a
// multi-item missing-evidence list from silently overlapping the row
// after it, which is exactly what static estimates alone produced
// before this correction.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnMoveStart,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { buildCanvasGraph, NODE_WIDTH, ROW_HEIGHTS, type CanvasNodeData } from "./build-canvas-graph";
import { canvasNodeTypes } from "./canvas-nodes";

interface InvestigationCanvasProps {
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  onSelectMeasurement: () => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onRecordResult: () => void;
}

// The initial (and "Reset view") readable default — never the floor a
// very large graph's fitView is allowed to shrink past, and never so
// close to 100% that a normal-sized investigation clips at the edges.
const DEFAULT_ZOOM = 0.85;
// fitView's own floor: "Fit investigation" tries to show everything, but
// never below a size body text stays legible at — past this point the
// user pans instead of the whole graph shrinking further.
const FIT_VIEW_MIN_ZOOM = 0.65;
const FIT_VIEW_OPTIONS = { padding: 0.18, minZoom: FIT_VIEW_MIN_ZOOM, maxZoom: 1 };
// The very first thing an engineer should see is the START of the
// investigation (the Measurement node, graph origin 0,0) at a readable
// zoom — not an auto-`fitView` centered on the whole bounding box, which
// for any investigation wider than the container clips BOTH ends
// (the reported "cards are too small, must zoom in" defect was this:
// fitView shrinking to fit a tall, narrow graph; the fix widened the
// layout, but a plain fitView on a WIDE graph clips left and right
// instead — same root problem, different axis). Panning right reveals
// the rest, exactly as the ticket asks for.
const CANVAS_PADDING = 32;

// Container height derived from real graph content (build-canvas-graph's
// own `height`, not a guessed constant), clamped to a sensible range —
// short investigations (one measurement, one hypothesis) don't carry
// hundreds of pixels of dead space, and long ones (several hypotheses,
// a long history) don't force the container to grow without bound; past
// the max, the user pans/zooms within it instead.
const MIN_CANVAS_HEIGHT = 460;
const MAX_CANVAS_HEIGHT = 760;
const CANVAS_HEIGHT_PADDING = 160;

function InvestigationCanvasInner({
  measurement,
  state,
  timeline,
  onSelectMeasurement,
  onSelectHypothesis,
  onRecordResult,
}: InvestigationCanvasProps) {
  const graph = useMemo(() => buildCanvasGraph({ measurement, state, timeline }), [measurement, state, timeline]);

  const initialNodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: node.x, y: node.y },
        // Passing an initial width (matching build-canvas-graph's own
        // NODE_WIDTH) gives React Flow correct bounds for the very first
        // fitView, before it has measured the real DOM node — this is
        // what avoids an initial "jump" from a wrong guess to the
        // corrected layout, not just cosmetic.
        width: NODE_WIDTH,
        data: node.data as unknown as Record<string, unknown>,
        draggable: false,
        connectable: false,
        deletable: false,
      })),
    [graph.nodes],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
        className: "crado-connector-draw",
      })),
    [graph.edges],
  );

  const { getNodes, fitView, setCenter, setViewport } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  // The corrected, real-measurement-aware node list — a plain derived
  // value computed at render time (useMemo), not local state kept in
  // sync via an effect. `getNodes()` is a synchronous read of React
  // Flow's own store; reading it here to compute this render's output is
  // "using an external value to render," not "syncing state from an
  // external system" (the latter is what needs an effect, and what
  // this repo's react-hooks/set-state-in-effect rule hard-errors on).
  // Before nodesInitialized is true, this is identical to initialNodes.
  const nodes: Node[] = useMemo(() => {
    if (!nodesInitialized) return initialNodes;
    const measuredHeights = new Map<string, number>();
    for (const flowNode of getNodes()) {
      if (flowNode.measured?.height) measuredHeights.set(flowNode.id, flowNode.measured.height);
    }
    if (measuredHeights.size === 0) return initialNodes;

    const remeasured = buildCanvasGraph(
      { measurement, state, timeline },
      (id, kind) => measuredHeights.get(id) ?? ROW_HEIGHTS[kind],
    );
    return initialNodes.map((flowNode) => {
      const corrected = remeasured.nodes.find((n) => n.id === flowNode.id);
      if (!corrected) return flowNode;
      return { ...flowNode, position: { x: corrected.x, y: corrected.y } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getNodes is a stable ReactFlow store accessor; measurement/state/timeline are already covered by initialNodes (derived from graph, derived from those three) changing identity whenever they do.
  }, [nodesInitialized, initialNodes]);

  // FOLLOW AGENT (UX-04 reopened: real-time flow) — the viewport otherwise
  // never moves after its initial defaultViewport anchor (deliberately, to
  // avoid the both-ends-clipping bug fitView caused on a wide graph — see
  // the CANVAS_PADDING comment above). Once real streamed events can add
  // nodes far outside that fixed first view (a hypothesis's whole lane,
  // several columns to the right), something has to reveal them, or the
  // canvas reads as empty even though the canonical graph already has
  // content — exactly the reported defect. Default on; a manual pan/zoom
  // (see onMoveStart below) pauses it so the interface never fights the
  // user, and the button re-enables it.
  const [followAgent, setFollowAgent] = useState(true);
  const knownNodeIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const previousIds = knownNodeIdsRef.current;
    const currentIds = new Set(graph.nodes.map((n) => n.id));
    // The very first population of the graph (including the common case of
    // Measurement appearing immediately on mount) is already handled by
    // defaultViewport's fixed origin anchor — recording ids here without
    // moving the viewport avoids a redundant/competing fitBounds call on
    // first paint.
    if (previousIds === null) {
      knownNodeIdsRef.current = currentIds;
      return;
    }
    const newNodes = graph.nodes.filter((n) => !previousIds.has(n.id));
    knownNodeIdsRef.current = currentIds;
    if (!followAgent || newNodes.length === 0) return;

    const left = Math.min(...newNodes.map((n) => n.x));
    const top = Math.min(...newNodes.map((n) => n.y));
    const right = Math.max(...newNodes.map((n) => n.x + NODE_WIDTH));
    const bottom = Math.max(...newNodes.map((n) => n.y + ROW_HEIGHTS[n.data.kind]));
    // setCenter at a FIXED readable zoom, not fitBounds/fitView — the
    // ticket is explicit that following new work must never shrink the
    // growing graph to keep fitting it all in. Centering on whatever is
    // new, at the same DEFAULT_ZOOM every other view in this canvas uses,
    // reveals it without ever making anything smaller/harder to read.
    void setCenter((left + right) / 2, (top + bottom) / 2, { zoom: DEFAULT_ZOOM, duration: 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setCenter is a stable ReactFlow imperative accessor, not reactive state.
  }, [graph.nodes, followAgent]);

  const handleToggleFollowAgent = useCallback(() => {
    setFollowAgent((prev) => !prev);
  }, []);

  // The documented xyflow convention for telling a user-driven viewport
  // change apart from a programmatic one (our own fitBounds/setViewport/
  // fitView calls above): `event` is the real DOM event for a genuine
  // drag/wheel/pinch, and null when React Flow itself moved the viewport.
  // Only a real user gesture should pause following.
  const handleMoveStart = useCallback<OnMoveStart>((event) => {
    if (event) setFollowAgent(false);
  }, []);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      // "Record result" is a real button inside NextActionNode, not the
      // node click itself — handled first so clicking it doesn't also
      // fire the (harmless but pointless) node-select branch below.
      if ((event.target as HTMLElement).closest('[data-canvas-action="record-result"]')) {
        onRecordResult();
        return;
      }
      const data = node.data as unknown as CanvasNodeData;
      if (data.kind === "measurement") {
        onSelectMeasurement();
      } else if (data.kind === "hypothesis") {
        onSelectHypothesis(data.hypothesis, data.index);
      }
    },
    [onSelectMeasurement, onSelectHypothesis, onRecordResult],
  );

  const handleResetView = useCallback(() => {
    // A fixed return to the graph's origin (the Measurement node) at the
    // readable default zoom — deliberately NOT `fitView` (which adapts to
    // content and, on a wide graph, can leave the viewport centered
    // somewhere with neither end visible). Distinct from "Fit
    // investigation" below: Reset always lands in the same place;
    // Fit adapts to however large the investigation currently is.
    void setViewport({ x: CANVAS_PADDING, y: CANVAS_PADDING, zoom: DEFAULT_ZOOM }, { duration: 200 });
  }, [setViewport]);

  const handleFitInvestigation = useCallback(() => {
    void fitView({ ...FIT_VIEW_OPTIONS, duration: 200 });
  }, [fitView]);

  const isEmpty = graph.nodes.length === 0;
  if (isEmpty && state.status === "idle") {
    // A genuinely idle case (no run has ever started, nothing to follow)
    // stays exactly as before this correction — no canvas at all, not even
    // a placeholder, since there is no "current genuine state" to show.
    return null;
  }

  // Real content height, not a guessed constant — clamped so a short
  // investigation isn't padded with empty space and a long one doesn't
  // grow the page without bound (past the max, pan/zoom takes over).
  const containerHeight = Math.min(
    MAX_CANVAS_HEIGHT,
    Math.max(MIN_CANVAS_HEIGHT, graph.height + CANVAS_HEIGHT_PADDING),
  );

  return (
    <div className="relative w-full" style={{ height: containerHeight }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={canvasNodeTypes}
        onNodeClick={handleNodeClick}
        onMoveStart={handleMoveStart}
        // Without this, <Controls> (added for real zoom/pan navigation)
        // renders using xyflow's own default LIGHT theme CSS variables —
        // a plain white panel clashing with the rest of this dark app.
        // The custom node cards were never affected by this (their colors
        // come from this app's own theme classes, not xyflow's), which is
        // why the app looked fine before Controls existed.
        colorMode="dark"
        // No `fitView` prop on mount — see CANVAS_PADDING above. The
        // starting view is always the graph's origin at a fixed, readable
        // zoom, never an auto-fit that can center on empty space between
        // two clipped ends for a graph wider than the container.
        defaultViewport={{ x: CANVAS_PADDING, y: CANVAS_PADDING, zoom: DEFAULT_ZOOM }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(245,246,247,0.06)" />
        <Controls
          position="bottom-left"
          showZoom
          showFitView
          showInteractive={false}
          fitViewOptions={FIT_VIEW_OPTIONS}
        >
          <ControlButton
            onClick={handleToggleFollowAgent}
            title={followAgent ? "Following agent — click to pause" : "Follow agent"}
            aria-label={followAgent ? "Following agent — click to pause" : "Follow agent"}
            aria-pressed={followAgent}
            className={followAgent ? "!text-[#22c55e]" : undefined}
          >
            <FollowIcon />
          </ControlButton>
          <ControlButton onClick={handleFitInvestigation} title="Fit investigation" aria-label="Fit investigation">
            <FitIcon />
          </ControlButton>
          <ControlButton onClick={handleResetView} title="Reset to readable zoom" aria-label="Reset to readable zoom">
            <ResetIcon />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {/* UX-04 reopened: never an unexplained empty black canvas — this
          shows the same real, typed lastEventSummary the compact status
          line above the canvas already renders (never a fabricated
          per-node progress guess), and disappears the instant the first
          real node (almost always Measurement, present from mount) lands
          in `graph.nodes`. Pointer-events none so it never blocks the
          canvas underneath once nodes exist behind it during the fade. */}
      {isEmpty ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="flex items-center gap-2.5 text-sm text-[#8b95a3]">
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />
            {state.status === "failed" || state.status === "interrupted"
              ? (state.errorMessage ?? "Analysis did not complete.")
              : (state.lastEventSummary ?? "Crado is investigating…")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FollowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

// A fresh ReactFlowProvider per mount — this canvas is the only place in
// the app that needs one, so it's scoped here rather than wrapping the
// whole investigation workspace.
export function InvestigationCanvas(props: InvestigationCanvasProps) {
  return (
    <ReactFlowProvider>
      <InvestigationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
