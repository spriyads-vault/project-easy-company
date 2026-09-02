// DETERMINISTIC AUTO-LAYOUT (UX-04 Agent-Native): pure function, no React
// Flow import — computes every node's position and every connecting edge
// from the same WorkspaceState + TimelineEntry[] data the old stacked-card
// canvas already consumed. Top-to-bottom primary path (Measurement →
// Deterministic → history), hypotheses branch horizontally, each with its
// own Missing-evidence/Next-test column — exactly the ticket's ASCII
// diagram. No node position is ever hand-picked; this is the one place
// layout math lives, which is what makes it unit-testable without
// mounting React Flow at all.
import type { MeasurementRow } from "@/lib/cases/queries";
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import type { FinalEvidenceItem } from "@/lib/hypotheses/schema";

export type CanvasNodeData =
  | { kind: "measurement"; measurement: MeasurementRow }
  | { kind: "deterministic"; correlation: CorrelationFoundPayload }
  | { kind: "hypothesis"; hypothesis: HypothesisCreatedPayload; index: number }
  | { kind: "missing"; items: FinalEvidenceItem[]; hypothesisIndex: number }
  | { kind: "nextAction"; step: string; hypothesisIndex: number }
  | { kind: "observation"; entry: Extract<TimelineEntry, { type: "observation" }> }
  | { kind: "change"; entry: Extract<TimelineEntry, { type: "engineering_change" }> }
  | { kind: "revision"; entry: Extract<TimelineEntry, { type: "new_revision" }> }
  | { kind: "outcome"; entry: Extract<TimelineEntry, { type: "result" }> };

export interface CanvasNode {
  id: string;
  type: CanvasNodeData["kind"];
  x: number;
  y: number;
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** The graph's total height in canvas units — callers use this to size
   * fitView padding sensibly; never hand-computed elsewhere. */
  height: number;
}

const COLUMN_PITCH = 380;
const ROW_HEIGHTS: Record<CanvasNodeData["kind"], number> = {
  measurement: 300,
  deterministic: 200,
  hypothesis: 190,
  missing: 130,
  nextAction: 140,
  observation: 120,
  change: 120,
  revision: 110,
  outcome: 220,
};
const ROW_GAP = 56;

export interface BuildCanvasGraphInput {
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
}

export function buildCanvasGraph({ measurement, state, timeline }: BuildCanvasGraphInput): CanvasGraph {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  let trunkY = 0;
  let previousTrunkId: string | null = null;

  function placeTrunk(id: string, data: CanvasNodeData): void {
    nodes.push({ id, type: data.kind, x: 0, y: trunkY, data });
    if (previousTrunkId) {
      edges.push({ id: `${previousTrunkId}->${id}`, source: previousTrunkId, target: id });
    }
    previousTrunkId = id;
    trunkY += ROW_HEIGHTS[data.kind] + ROW_GAP;
  }

  if (measurement) {
    placeTrunk("measurement", { kind: "measurement", measurement });
  }

  for (const correlation of state.correlations) {
    placeTrunk(`deterministic-${correlation.productFactId}-${correlation.harmonicNumber}`, {
      kind: "deterministic",
      correlation,
    });
  }

  // Hypotheses branch horizontally off the trunk — each gets its own
  // column, its own Missing-evidence node (if it has missing evidence)
  // and Next-test node, stacked below the hypothesis in that column.
  if (state.hypotheses.length > 0) {
    const branchStartY = trunkY;
    const hypothesisSourceId = previousTrunkId;
    const columnCount = state.hypotheses.length;
    const startX = -((columnCount - 1) * COLUMN_PITCH) / 2;
    let maxBranchY = branchStartY;

    state.hypotheses.forEach((hypothesis, index) => {
      const x = startX + index * COLUMN_PITCH;
      let y = branchStartY;
      const hypothesisId = `hypothesis-${index}`;

      nodes.push({ id: hypothesisId, type: "hypothesis", x, y, data: { kind: "hypothesis", hypothesis, index } });
      if (hypothesisSourceId) {
        edges.push({ id: `${hypothesisSourceId}->${hypothesisId}`, source: hypothesisSourceId, target: hypothesisId });
      }
      y += ROW_HEIGHTS.hypothesis + ROW_GAP;

      const missingItems = hypothesis.evidence.filter((item) => item.category === "missing");
      let lastIdInColumn = hypothesisId;
      if (missingItems.length > 0) {
        const missingId = `missing-${index}`;
        nodes.push({ id: missingId, type: "missing", x, y, data: { kind: "missing", items: missingItems, hypothesisIndex: index } });
        edges.push({ id: `${lastIdInColumn}->${missingId}`, source: lastIdInColumn, target: missingId });
        lastIdInColumn = missingId;
        y += ROW_HEIGHTS.missing + ROW_GAP;
      }

      const nextActionId = `next-action-${index}`;
      nodes.push({
        id: nextActionId,
        type: "nextAction",
        x,
        y,
        data: { kind: "nextAction", step: hypothesis.recommendedNextStep, hypothesisIndex: index },
      });
      edges.push({ id: `${lastIdInColumn}->${nextActionId}`, source: lastIdInColumn, target: nextActionId });
      y += ROW_HEIGHTS.nextAction + ROW_GAP;

      maxBranchY = Math.max(maxBranchY, y);
    });

    trunkY = maxBranchY;
    // The trunk continues from a synthetic point below every branch —
    // the next trunk node (if any) connects from the first hypothesis
    // column, reading as "the investigation continues" rather than
    // picking one hypothesis as more important than the others.
    previousTrunkId = "hypothesis-0";
  }

  // History: every non-measurement, non-hypothesis timeline entry, in
  // chronological order, back on the main trunk.
  for (const entry of timeline) {
    if (entry.type === "measurement" || entry.type === "hypothesis") continue;
    if (entry.type === "observation") {
      placeTrunk(`observation-${entry.id}`, { kind: "observation", entry });
    } else if (entry.type === "engineering_change") {
      placeTrunk(`change-${entry.id}`, { kind: "change", entry });
    } else if (entry.type === "new_revision") {
      placeTrunk(`revision-${entry.id}`, { kind: "revision", entry });
    } else if (entry.type === "result") {
      placeTrunk(`outcome-${entry.id}`, { kind: "outcome", entry });
    }
  }

  return { nodes, edges, height: trunkY };
}
