import { describe, expect, it } from "vitest";
import { buildCanvasGraph } from "./build-canvas-graph";
import { initialWorkspaceState, type WorkspaceState } from "@/lib/investigation/reconstruct";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { TimelineEntry } from "@/lib/investigation/timeline";

const measurement: MeasurementRow = {
  id: "m1",
  label: null,
  operatingMode: "WiFi TX",
  notes: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  productRevisionId: "rev-1",
  revisionLabel: "Rev17",
  peaks: [{ id: "p1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
};

const correlation: CorrelationFoundPayload = {
  productFactId: "fact-1",
  productFactCategory: "clock",
  productFactLabel: "system clock",
  sourceFrequencyMhz: 40,
  harmonicNumber: 5,
  expectedFrequencyMhz: 200,
  measuredFrequencyMhz: 200,
  deviationMhz: 0,
  deviationRatio: 0,
  description: "40 MHz x 5 = 200 MHz",
};

function hypothesis(overrides: Partial<HypothesisCreatedPayload> = {}): HypothesisCreatedPayload {
  return {
    productFactId: "fact-1",
    title: "5th harmonic of system clock",
    confidenceBand: "medium",
    recommendedNextStep: "Disconnect display and remeasure",
    evidence: [
      { category: "observed", description: "200 MHz peak" },
      { category: "missing", description: "Display-disconnected measurement" },
    ],
    ...overrides,
  };
}

describe("buildCanvasGraph", () => {
  it("places nothing when there is no measurement and no state (missing-data case)", () => {
    const graph = buildCanvasGraph({ measurement: null, state: initialWorkspaceState, timeline: [] });
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("places the measurement alone, in the leftmost column, when nothing else is available (boundary case)", () => {
    const graph = buildCanvasGraph({ measurement, state: initialWorkspaceState, timeline: [] });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: "measurement", type: "measurement", x: 0, y: 0 });
  });

  // --- Left-to-right stage ordering -----------------------------------

  it("chains measurement -> deterministic -> hypothesis strictly left to right, each in its own column", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, correlations: [correlation], hypotheses: [hypothesis()] };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    const measurementNode = graph.nodes.find((n) => n.id === "measurement")!;
    const deterministicNode = graph.nodes.find((n) => n.type === "deterministic")!;
    const hypothesisNode = graph.nodes.find((n) => n.id === "hypothesis-0")!;
    const missingNode = graph.nodes.find((n) => n.id === "missing-0")!;
    const nextActionNode = graph.nodes.find((n) => n.id === "next-action-0")!;

    // Strictly increasing x — a real left-to-right reading order, not
    // just "not the same column."
    expect(measurementNode.x).toBeLessThan(deterministicNode.x);
    expect(deterministicNode.x).toBeLessThan(hypothesisNode.x);
    expect(hypothesisNode.x).toBeLessThan(missingNode.x);
    expect(missingNode.x).toBeLessThan(nextActionNode.x);

    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: "measurement", target: deterministicNode.id }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: deterministicNode.id, target: "hypothesis-0" }),
    );
  });

  it("keeps a hypothesis and its own missing-evidence/next-test cards on one visual row (grouped), spread across columns, never stacked under each other", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis()] };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    const hypothesisNode = graph.nodes.find((n) => n.id === "hypothesis-0")!;
    const missingNode = graph.nodes.find((n) => n.id === "missing-0")!;
    const nextActionNode = graph.nodes.find((n) => n.id === "next-action-0")!;

    // Same row (grouped) ...
    expect(missingNode.y).toBe(hypothesisNode.y);
    expect(nextActionNode.y).toBe(hypothesisNode.y);
    // ... different columns (left to right, never overlapping).
    expect(missingNode.x).toBeGreaterThan(hypothesisNode.x);
    expect(nextActionNode.x).toBeGreaterThan(missingNode.x);

    expect(graph.edges).toContainEqual(expect.objectContaining({ source: "hypothesis-0", target: "missing-0" }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: "missing-0", target: "next-action-0" }));
  });

  it("skips the missing-evidence node when a hypothesis has no missing evidence, connecting next-action directly", () => {
    const noMissing = hypothesis({ evidence: [{ category: "observed", description: "200 MHz peak" }] });
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [noMissing] };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    expect(graph.nodes.some((n) => n.id === "missing-0")).toBe(false);
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: "hypothesis-0", target: "next-action-0" }));
  });

  // --- Vertical separation of parallel nodes --------------------------

  it("stacks two hypotheses vertically in the SAME column (a lane each), never fanning them into separate columns", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [hypothesis({ title: "Hypothesis A" }), hypothesis({ title: "Hypothesis B" })],
    };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    const laneA = graph.nodes.find((n) => n.id === "hypothesis-0")!;
    const laneB = graph.nodes.find((n) => n.id === "hypothesis-1")!;

    expect(laneA.x).toBe(laneB.x);
    expect(laneB.y).toBeGreaterThan(laneA.y);
  });

  it("advances the next hypothesis's lane past the tallest card in the previous lane, not a fixed guess — this is the direct regression test for the reported card-overlap defect", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [hypothesis({ title: "A" }), hypothesis({ title: "B" })],
    };
    // A getNodeHeight lookup simulating a real DOM measurement far taller
    // than the static estimate (e.g. a missing-evidence list with many
    // long items) — the second hypothesis's lane must still start below
    // it, proving the layout genuinely consults the height lookup rather
    // than a hard-coded per-kind constant.
    const tallMissingHeight = 900;
    const graph = buildCanvasGraph({ measurement, state, timeline: [] }, (id) =>
      id === "missing-0" ? tallMissingHeight : 40,
    );

    const laneAMissing = graph.nodes.find((n) => n.id === "missing-0")!;
    const laneB = graph.nodes.find((n) => n.id === "hypothesis-1")!;
    expect(laneB.y).toBeGreaterThanOrEqual(laneAMissing.y + tallMissingHeight);
  });

  // --- No overlap between Observation and Next Test -------------------

  it("places Observation and Next-test in different columns, so they can never overlap regardless of content length (the reported defect)", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis()] };
    const timeline: TimelineEntry[] = [
      { type: "observation", id: "obs1", createdAt: "t1", observation: "Reflowed the ferrite bead.", measurementChange: null },
    ];
    const graph = buildCanvasGraph({ measurement, state, timeline });

    const observationNode = graph.nodes.find((n) => n.id === "observation-obs1")!;
    const nextActionNode = graph.nodes.find((n) => n.id === "next-action-0")!;
    expect(observationNode.x).not.toBe(nextActionNode.x);
  });

  it("stacks a later observation below the hypothesis block in the same (missing-evidence/observation) column, never overlapping it", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis()] };
    const timeline: TimelineEntry[] = [
      { type: "observation", id: "obs1", createdAt: "t1", observation: "Reflowed the ferrite bead.", measurementChange: null },
    ];
    const graph = buildCanvasGraph({ measurement, state, timeline });

    const missingNode = graph.nodes.find((n) => n.id === "missing-0")!;
    const observationNode = graph.nodes.find((n) => n.id === "observation-obs1")!;
    expect(observationNode.x).toBe(missingNode.x);
    expect(observationNode.y).toBeGreaterThan(missingNode.y);
  });

  it("appends observation/change/revision/outcome history entries, in order, each connecting from the previous one", () => {
    const timeline: TimelineEntry[] = [
      { type: "measurement", id: "tm1", createdAt: "t1", label: null, frequencyMhz: 200, marginDb: 7.4, revisionLabel: "Rev17" },
      { type: "observation", id: "obs1", createdAt: "t2", observation: "Display disconnected", measurementChange: "-9 dB" },
      {
        type: "engineering_change",
        id: "chg1",
        createdAt: "t3",
        title: "Display termination modified",
        affectedSubsystem: "Display path",
        fromRevisionLabel: "Rev17",
        toRevisionLabel: "Rev18",
      },
      { type: "new_revision", id: "rev1", createdAt: "t4", label: "Rev18", supersedesLabel: "Rev17" },
      {
        type: "result",
        id: "res1",
        createdAt: "t5",
        comparison: {
          before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
          after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -3.6 },
          deltaDb: 11,
          improved: true,
          sameFrequency: true,
        },
      },
    ];
    const graph = buildCanvasGraph({ measurement: null, state: initialWorkspaceState, timeline });

    const kinds = graph.nodes.map((n) => n.type);
    expect(kinds).toEqual(["observation", "change", "revision", "outcome"]);
    // Change/revision share a column (the step between "next test" and
    // "result"); outcome is its own, final column, further right.
    const change = graph.nodes.find((n) => n.id === "change-chg1")!;
    const revision = graph.nodes.find((n) => n.id === "revision-rev1")!;
    const outcome = graph.nodes.find((n) => n.id === "outcome-res1")!;
    expect(change.x).toBe(revision.x);
    expect(outcome.x).toBeGreaterThan(revision.x);
  });

  it("connects an outcome node onward to a later observation — an outcome is not necessarily the end of history", () => {
    const timeline: TimelineEntry[] = [
      {
        type: "result",
        id: "res1",
        createdAt: "t1",
        comparison: {
          before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
          after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -3.6 },
          deltaDb: 11,
          improved: true,
          sameFrequency: true,
        },
      },
      { type: "observation", id: "obs2", createdAt: "t2", observation: "Further check after the fix.", measurementChange: null },
    ];
    const graph = buildCanvasGraph({ measurement: null, state: initialWorkspaceState, timeline });

    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: "outcome-res1", target: "observation-obs2" }),
    );
  });

  it("never places two nodes at the exact same (x, y) — a real layout guarantee, not just a visual guess", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      correlations: [correlation],
      hypotheses: [hypothesis({ title: "A" }), hypothesis({ title: "B" })],
    };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });
    const positions = graph.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  // --- Long-content sizing / non-clipping (getNodeHeight is consulted) --

  it("reports a total height that reflects the getNodeHeight lookup, not just the static default — proving long content is measured, not clipped", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis()] };
    const defaultGraph = buildCanvasGraph({ measurement, state, timeline: [] });
    const tallGraph = buildCanvasGraph({ measurement, state, timeline: [] }, () => 2000);
    expect(tallGraph.height).toBeGreaterThan(defaultGraph.height);
  });

  it("reports a total width proportional to how many stage columns are actually used", () => {
    const measurementOnly = buildCanvasGraph({ measurement, state: initialWorkspaceState, timeline: [] });
    const withHypothesis = buildCanvasGraph({
      measurement,
      state: { ...initialWorkspaceState, hypotheses: [hypothesis()] },
      timeline: [],
    });
    expect(withHypothesis.width).toBeGreaterThan(measurementOnly.width);
  });
});
