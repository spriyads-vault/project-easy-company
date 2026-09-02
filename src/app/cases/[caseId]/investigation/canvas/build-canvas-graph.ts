// DETERMINISTIC AUTO-LAYOUT (UX-04 Agent-Native, visual correction): pure
// function, no React Flow import — computes every node's position and
// every connecting edge from the same WorkspaceState + TimelineEntry[]
// data the canvas already consumes. LEFT-TO-RIGHT STAGE LAYOUT: each
// investigation "stage" (Measurement, Deterministic correlation,
// Hypothesis, Missing evidence/Observation, Next test,
// Change/Revision, Result/Outcome) gets its own column, in that reading
// order — never a single tall vertical chain. Where a stage has more
// than one node (multiple hypotheses, multiple correlations, a run of
// history entries), those nodes stack VERTICALLY within that one
// column, never spread sideways into their own columns — that was the
// previous design (hypotheses fanned out horizontally) and is exactly
// what produced a narrow, vertically-stretched canvas: every stage after
// the fan-out collapsed back onto a single x=0 trunk, so a real
// investigation with any history read as one long vertical strip no
// matter how wide the viewport was.
//
// A hypothesis and its own missing-evidence/next-test cards share one
// row (a "lane") across their three columns — grouped by shared y, not
// by shared x/stacking under each other — so a swimlane reads as one
// horizontal band left to right, matching the reference layout. This
// also structurally prevents the reported Observation/Next-test overlap:
// those two kinds now live in different columns (3 and 4), so they can
// never occupy the same visual space regardless of content length.
//
// getNodeHeight is a pluggable height lookup — buildCanvasGraph defaults
// it to ROW_HEIGHTS (a static per-kind estimate, good enough for the
// very first paint and for the pure-function unit tests below, which
// don't mount real DOM). investigation-canvas.tsx calls this function a
// second time, after React Flow has measured every node's REAL rendered
// height, with a lookup backed by those real measurements — correcting
// any case where a node's actual content (a long hypothesis, a four-item
// missing-evidence list) needed more room than the estimate guessed,
// without ever clipping or forcing a truncated card just to keep a
// uniform height.
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
  /** The graph's total content height in canvas units (max node bottom
   * edge) — callers use this to size the container/fitView padding from
   * real content, never a hand-picked constant. */
  height: number;
  /** The graph's total content width in canvas units (max node right
   * edge) — same purpose as `height`, for the horizontal axis. */
  width: number;
}

/** Card width shared with canvas-nodes.tsx (NodeShell) and
 * investigation-stack.tsx, so layout math and rendered width can never
 * silently drift apart. Widened from the previous 320px specifically so
 * real engineering copy (hypothesis titles, next-test instructions)
 * reads without wrapping into an unnecessarily tall card. */
export const NODE_WIDTH = 360;

const COLUMN_GAP = 140;
const COLUMN_PITCH = NODE_WIDTH + COLUMN_GAP;
const ROW_GAP = 48;

/** Static per-kind height estimates — the fallback for the very first
 * paint and for pure-function tests. Generous on purpose (previous
 * values, especially `missing` at 130, were the direct cause of real
 * card overlap: a 2-3 item missing-evidence list routinely needed
 * 200px+, so the next lane started 70-100px before the card above it
 * actually ended). The live remeasure pass in investigation-canvas.tsx
 * corrects any case these estimates still get wrong — it also reuses
 * this exact map (imported, never re-declared) as ITS OWN last-resort
 * fallback for a node that somehow has no measured height yet. */
export const ROW_HEIGHTS: Record<CanvasNodeData["kind"], number> = {
  measurement: 320,
  deterministic: 170,
  hypothesis: 210,
  missing: 210,
  nextAction: 200,
  observation: 130,
  change: 130,
  revision: 120,
  outcome: 230,
};

/** Left-to-right stage order. `missing` and `observation` deliberately
 * share a column — both are "what would narrow/has narrowed this" in
 * the investigation's reading order — and `change`/`revision` share the
 * column between "next test" and "result", since an engineering change
 * and the revision it produces are the same real-world step (an
 * engineer acts on the next test's recommendation before a new result
 * is measured). */
const STAGE_COLUMN: Record<CanvasNodeData["kind"], number> = {
  measurement: 0,
  deterministic: 1,
  hypothesis: 2,
  missing: 3,
  observation: 3,
  nextAction: 4,
  change: 5,
  revision: 5,
  outcome: 6,
};

export type NodeHeightLookup = (id: string, kind: CanvasNodeData["kind"]) => number;

function defaultNodeHeight(_id: string, kind: CanvasNodeData["kind"]): number {
  return ROW_HEIGHTS[kind];
}

export interface BuildCanvasGraphInput {
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
}

export function buildCanvasGraph(
  { measurement, state, timeline }: BuildCanvasGraphInput,
  getNodeHeight: NodeHeightLookup = defaultNodeHeight,
): CanvasGraph {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  // Each stage has its own independent vertical cursor — a long run of
  // history entries in the trailing columns no longer forces every
  // other stage down with it, which is what turned the old single-trunk
  // layout into one long vertical strip.
  const columnCursor: number[] = [0, 0, 0, 0, 0, 0, 0];

  function place(
    id: string,
    data: CanvasNodeData,
    y?: number,
    options?: { skipCursorUpdate?: boolean },
  ): void {
    const column = STAGE_COLUMN[data.kind];
    const resolvedY = y ?? columnCursor[column];
    nodes.push({ id, type: data.kind, x: column * COLUMN_PITCH, y: resolvedY, data });
    if (!options?.skipCursorUpdate) {
      const bottom = resolvedY + getNodeHeight(id, data.kind) + ROW_GAP;
      if (bottom > columnCursor[column]) columnCursor[column] = bottom;
    }
  }

  let previousTrunkId: string | null = null;

  if (measurement) {
    place("measurement", { kind: "measurement", measurement });
    previousTrunkId = "measurement";
  }

  for (const correlation of state.correlations) {
    const id = `deterministic-${correlation.productFactId}-${correlation.harmonicNumber}`;
    place(id, { kind: "deterministic", correlation });
    if (previousTrunkId) {
      edges.push({ id: `${previousTrunkId}->${id}`, source: previousTrunkId, target: id });
    }
    previousTrunkId = id;
  }

  // Hypotheses stack vertically in one column — each gets its own lane
  // (a shared row across the Hypothesis/Missing-evidence/Next-test
  // columns), not its own horizontal branch. A lane's height is the
  // tallest of its three cards, so the next hypothesis's lane never
  // starts before every card in the previous lane has actually ended.
  if (state.hypotheses.length > 0) {
    const hypothesisSourceId = previousTrunkId;
    let laneY = 0;

    state.hypotheses.forEach((hypothesis, index) => {
      const hypothesisId = `hypothesis-${index}`;
      place(hypothesisId, { kind: "hypothesis", hypothesis, index }, laneY, { skipCursorUpdate: true });
      if (hypothesisSourceId) {
        edges.push({ id: `${hypothesisSourceId}->${hypothesisId}`, source: hypothesisSourceId, target: hypothesisId });
      }
      let laneHeight = getNodeHeight(hypothesisId, "hypothesis");
      let lastIdInLane = hypothesisId;

      const missingItems = hypothesis.evidence.filter((item) => item.category === "missing");
      if (missingItems.length > 0) {
        const missingId = `missing-${index}`;
        place(missingId, { kind: "missing", items: missingItems, hypothesisIndex: index }, laneY, {
          skipCursorUpdate: true,
        });
        edges.push({ id: `${lastIdInLane}->${missingId}`, source: lastIdInLane, target: missingId });
        lastIdInLane = missingId;
        laneHeight = Math.max(laneHeight, getNodeHeight(missingId, "missing"));
      }

      const nextActionId = `next-action-${index}`;
      place(
        nextActionId,
        { kind: "nextAction", step: hypothesis.recommendedNextStep, hypothesisIndex: index },
        laneY,
        { skipCursorUpdate: true },
      );
      edges.push({ id: `${lastIdInLane}->${nextActionId}`, source: lastIdInLane, target: nextActionId });
      laneHeight = Math.max(laneHeight, getNodeHeight(nextActionId, "nextAction"));

      laneY += laneHeight + ROW_GAP;
    });

    // The lane columns' cursors need to reflect the whole block so a
    // later placement in the same column (an observation continuing to
    // stack in the Missing-evidence/Observation column) starts below
    // it, never overlapping the last hypothesis's row.
    columnCursor[STAGE_COLUMN.hypothesis] = laneY;
    columnCursor[STAGE_COLUMN.missing] = laneY;
    columnCursor[STAGE_COLUMN.nextAction] = laneY;
    // The trunk continues from a synthetic point after every lane — the
    // next trunk node (if any) connects from the first hypothesis,
    // reading as "the investigation continues" rather than picking one
    // hypothesis as more important than the others.
    previousTrunkId = "hypothesis-0";
  }

  // History: every non-measurement, non-hypothesis timeline entry, in
  // chronological order, each connecting from whatever came immediately
  // before it — unchanged topology from the original trunk design, only
  // the column (x) each kind lands in has changed.
  for (const entry of timeline) {
    if (entry.type === "measurement" || entry.type === "hypothesis") continue;
    let id: string;
    let data: CanvasNodeData;
    if (entry.type === "observation") {
      id = `observation-${entry.id}`;
      data = { kind: "observation", entry };
    } else if (entry.type === "engineering_change") {
      id = `change-${entry.id}`;
      data = { kind: "change", entry };
    } else if (entry.type === "new_revision") {
      id = `revision-${entry.id}`;
      data = { kind: "revision", entry };
    } else if (entry.type === "result") {
      id = `outcome-${entry.id}`;
      data = { kind: "outcome", entry };
    } else {
      continue;
    }
    place(id, data);
    if (previousTrunkId) {
      edges.push({ id: `${previousTrunkId}->${id}`, source: previousTrunkId, target: id });
    }
    previousTrunkId = id;
  }

  const height = nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.y + getNodeHeight(n.id, n.data.kind)));
  const width = nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH;

  return { nodes, edges, height, width };
}
