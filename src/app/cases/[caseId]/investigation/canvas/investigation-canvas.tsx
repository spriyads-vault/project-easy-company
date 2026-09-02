"use client";

// INVESTIGATION CANVAS (UX-04 Agent-Native): a visual investigation
// surface, not a workflow editor — nodes are selectable (click for
// context-rail detail) and the canvas pans/zooms, but nothing is
// draggable, connectable, or deletable by the user. The graph represents
// FACTUAL INVESTIGATION STATE (auto-laid-out by build-canvas-graph.ts),
// never something the engineer arranges.
import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { buildCanvasGraph, type CanvasNodeData } from "./build-canvas-graph";
import { canvasNodeTypes } from "./canvas-nodes";

interface InvestigationCanvasProps {
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  onSelectMeasurement: () => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onRecordResult: () => void;
}

function InvestigationCanvasInner({
  measurement,
  state,
  timeline,
  onSelectMeasurement,
  onSelectHypothesis,
  onRecordResult,
}: InvestigationCanvasProps) {
  const graph = useMemo(() => buildCanvasGraph({ measurement, state, timeline }), [measurement, state, timeline]);

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { x: node.x, y: node.y },
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

  if (graph.nodes.length === 0) {
    return null;
  }

  return (
    <div className="h-[560px] w-full sm:h-[640px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={canvasNodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(245,246,247,0.06)" />
      </ReactFlow>
    </div>
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
