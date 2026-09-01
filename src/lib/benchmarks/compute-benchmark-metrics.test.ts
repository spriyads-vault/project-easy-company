import { describe, expect, it } from "vitest";
import type { AnalysisEvent } from "@/lib/analysis/events";
import { computeBenchmarkMetrics } from "./compute-benchmark-metrics";
import type { GroundTruth } from "./ground-truth";

function event<T extends AnalysisEvent>(partial: T): T {
  return partial;
}

const baseGroundTruth: GroundTruth = {
  benchmarkCaseId: "bc-1",
  rootCause: "Cracked ground plane stitching near the connector",
  diagnosticActionsTaken: "Near-field probing",
  successfulEngineeringChange: "Added stitching vias every 5mm",
  finalFrequencyMhz: 200,
  finalMarginDb: -2.1,
  finalOutcomeNotes: null,
};

describe("computeBenchmarkMetrics", () => {
  it("computes run timing, tool, and hypothesis counts from a full happy-path event stream (expected positive case)", () => {
    const events: AnalysisEvent[] = [
      event({
        type: "run.started",
        runId: "r1",
        sequence: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: { failureCaseId: "fc1", measurementId: "m1" },
      }),
      event({
        type: "agent.tool.completed",
        runId: "r1",
        sequence: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
        payload: {
          toolName: "searchEngineeringDocuments",
          label: "Searched documents",
          resultCount: 3,
          durationMs: 100,
          query: "ground plane",
        },
      }),
      event({
        type: "hypothesis.created",
        runId: "r1",
        sequence: 2,
        createdAt: "2026-01-01T00:00:05.000Z",
        payload: {
          productFactId: "pf1",
          title: "Ground plane stitching gap",
          confidenceBand: "medium",
          recommendedNextStep: "Add stitching vias.",
          evidence: [
            { category: "observed", description: "200 MHz at 7.4 dB" },
            { category: "inferred", description: "matches a known stitching-gap pattern" },
            {
              category: "known",
              description: "prior investigation flagged a similar gap",
              citation: {
                documentId: "d1",
                chunkId: "c1",
                filename: "emc-report.pdf",
                documentType: "lab_report",
                pageNumber: 3,
                section: "Findings",
                passage: "A similar stitching gap was observed near the connector.",
              },
            },
          ],
        },
      }),
      event({
        type: "run.completed",
        runId: "r1",
        sequence: 3,
        createdAt: "2026-01-01T00:00:10.000Z",
        payload: { correlationsFound: 1, hypothesesCreated: 1, clarificationRequired: false },
      }),
    ];

    const metrics = computeBenchmarkMetrics(events);

    expect(metrics.hypothesesCount).toBe(1);
    expect(metrics.toolCallCount).toBe(1);
    expect(metrics.unnecessarySearchCount).toBe(0);
    expect(metrics.citationsUsedCount).toBe(1);
    expect(metrics.totalRunTimeMs).toBe(10_000);
    expect(metrics.timeToFirstHypothesisMs).toBe(5_000);
    expect(metrics.groundTruthComparison).toBeUndefined();
  });

  it("counts a zero-result searchEngineeringDocuments call as unnecessary and a run.failed as the terminal event (expected negative case)", () => {
    const events: AnalysisEvent[] = [
      event({
        type: "run.started",
        runId: "r1",
        sequence: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: { failureCaseId: "fc1", measurementId: "m1" },
      }),
      event({
        type: "agent.tool.completed",
        runId: "r1",
        sequence: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
        payload: {
          toolName: "searchEngineeringDocuments",
          label: "Searched documents",
          resultCount: 0,
          durationMs: 50,
          query: "nonexistent term",
        },
      }),
      event({
        type: "run.failed",
        runId: "r1",
        sequence: 2,
        createdAt: "2026-01-01T00:00:02.000Z",
        payload: { message: "The model provider returned an error." },
      }),
    ];

    const metrics = computeBenchmarkMetrics(events);

    expect(metrics.unnecessarySearchCount).toBe(1);
    expect(metrics.hypothesesCount).toBe(0);
    expect(metrics.citationsUsedCount).toBe(0);
    expect(metrics.totalRunTimeMs).toBe(2_000);
    expect(metrics.timeToFirstHypothesisMs).toBeNull();
  });

  it("leaves timing null and PERF-01 fields undefined for an event stream with no terminal or agent.completed event (missing-data case)", () => {
    const events: AnalysisEvent[] = [
      event({
        type: "run.started",
        runId: "r1",
        sequence: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: { failureCaseId: "fc1", measurementId: "m1" },
      }),
    ];

    const metrics = computeBenchmarkMetrics(events);

    expect(metrics.totalRunTimeMs).toBeNull();
    expect(metrics.timeToFirstHypothesisMs).toBeNull();
    expect(metrics.documentsAvailable).toBeUndefined();
    expect(metrics.stepCount).toBeUndefined();
    expect(metrics.hypothesesCount).toBe(0);
  });

  it("only computes groundTruthComparison when ground truth is explicitly passed, as a labeled non-authoritative keyword-overlap signal (boundary case)", () => {
    const events: AnalysisEvent[] = [
      event({
        type: "hypothesis.created",
        runId: "r1",
        sequence: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: {
          productFactId: "pf1",
          title: "Stitching via gap near connector",
          confidenceBand: "medium",
          recommendedNextStep: "Add stitching vias.",
          evidence: [
            { category: "inferred", description: "ground plane stitching gap pattern" },
          ],
        },
      }),
      event({
        type: "hypothesis.created",
        runId: "r1",
        sequence: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
        payload: {
          productFactId: "pf2",
          title: "Unrelated clock harmonic",
          confidenceBand: "low",
          recommendedNextStep: "Re-clock the oscillator.",
          evidence: [{ category: "inferred", description: "completely different mechanism" }],
        },
      }),
    ];

    const withoutGroundTruth = computeBenchmarkMetrics(events);
    expect(withoutGroundTruth.groundTruthComparison).toBeUndefined();

    const withGroundTruth = computeBenchmarkMetrics(events, baseGroundTruth);
    expect(withGroundTruth.groundTruthComparison?.rootCause).toBe(baseGroundTruth.rootCause);
    expect(withGroundTruth.groundTruthComparison?.keywordOverlapByHypothesis).toEqual([
      { title: "Stitching via gap near connector", sharedTermCount: expect.any(Number) },
      { title: "Unrelated clock harmonic", sharedTermCount: 0 },
    ]);
    const stitchingOverlap =
      withGroundTruth.groundTruthComparison!.keywordOverlapByHypothesis[0].sharedTermCount;
    expect(stitchingOverlap).toBeGreaterThan(0);
  });
});
