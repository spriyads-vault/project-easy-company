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

  it("places the measurement alone when nothing else is available (boundary case)", () => {
    const graph = buildCanvasGraph({ measurement, state: initialWorkspaceState, timeline: [] });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: "measurement", type: "measurement", x: 0, y: 0 });
  });

  it("chains measurement -> deterministic with a connecting edge (positive case)", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, correlations: [correlation] };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });
    const deterministicNode = graph.nodes.find((n) => n.type === "deterministic");
    expect(deterministicNode).toBeDefined();
    expect(deterministicNode!.x).toBe(0);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: "measurement", target: deterministicNode!.id }),
    );
  });

  it("gives a single hypothesis its own missing-evidence and next-action nodes below it, same column", () => {
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis()] };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    const hypothesisNode = graph.nodes.find((n) => n.id === "hypothesis-0")!;
    const missingNode = graph.nodes.find((n) => n.id === "missing-0")!;
    const nextActionNode = graph.nodes.find((n) => n.id === "next-action-0")!;

    expect(hypothesisNode.x).toBe(0);
    expect(missingNode.x).toBe(hypothesisNode.x);
    expect(nextActionNode.x).toBe(hypothesisNode.x);
    expect(missingNode.y).toBeGreaterThan(hypothesisNode.y);
    expect(nextActionNode.y).toBeGreaterThan(missingNode.y);

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

  it("branches two hypotheses into symmetric columns around the trunk (positive case: multiple hypotheses)", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [hypothesis({ title: "Hypothesis A" }), hypothesis({ title: "Hypothesis B" })],
    };
    const graph = buildCanvasGraph({ measurement, state, timeline: [] });

    const columnA = graph.nodes.find((n) => n.id === "hypothesis-0")!;
    const columnB = graph.nodes.find((n) => n.id === "hypothesis-1")!;

    expect(columnA.x).toBeLessThan(0);
    expect(columnB.x).toBeGreaterThan(0);
    expect(columnA.x).toBe(-columnB.x);
    expect(columnA.y).toBe(columnB.y);
  });

  it("appends observation/change/revision/outcome history entries back on the trunk, in order", () => {
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
});
