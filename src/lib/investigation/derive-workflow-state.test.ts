import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "./timeline";
import { deriveWorkflowState, WORKFLOW_STATE_LABEL, WORKFLOW_STATE_TONE } from "./derive-workflow-state";

const hypothesisWithMissingEvidence = {
  productFactId: "fact-1",
  title: "5th harmonic of 40 MHz system clock",
  confidenceBand: "medium" as const,
  recommendedNextStep: "Disconnect the display path and re-measure.",
  evidence: [
    { category: "observed" as const, description: "200 MHz peak, 7.4 dB above the selected limit." },
    { category: "missing" as const, description: "Measurement with display disconnected." },
  ],
};

const hypothesisFullyEvidenced = {
  ...hypothesisWithMissingEvidence,
  evidence: [{ category: "observed" as const, description: "200 MHz peak, 7.4 dB above the selected limit." }],
};

function engineeringChange(createdAt: string): TimelineEntry {
  return {
    type: "engineering_change",
    id: "change-1",
    createdAt,
    title: "Added ferrite bead on display ribbon",
    affectedSubsystem: "display",
    fromRevisionLabel: "Rev17",
    toRevisionLabel: "Rev18",
  };
}

function resultEntry(createdAt: string): TimelineEntry {
  return {
    type: "result",
    id: "result-1",
    createdAt,
    comparison: {
      before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
      after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -1.2 },
      deltaDb: 8.6,
      improved: true,
      sameFrequency: true,
    },
  };
}

describe("deriveWorkflowState", () => {
  it("reads awaiting_measurement when no measurement has been recorded, regardless of run status", () => {
    expect(
      deriveWorkflowState({ runStatus: "idle", hasMeasurement: false, hypotheses: [], timeline: [] }),
    ).toBe("awaiting_measurement");
  });

  it("reads idle once a measurement exists but no run has ever started", () => {
    expect(
      deriveWorkflowState({ runStatus: "idle", hasMeasurement: true, hypotheses: [], timeline: [] }),
    ).toBe("idle");
  });

  it("reads analysis_in_progress while a run is streaming", () => {
    expect(
      deriveWorkflowState({ runStatus: "running", hasMeasurement: true, hypotheses: [], timeline: [] }),
    ).toBe("analysis_in_progress");
  });

  it("reads analysis_failed for a failed run", () => {
    expect(
      deriveWorkflowState({ runStatus: "failed", hasMeasurement: true, hypotheses: [], timeline: [] }),
    ).toBe("analysis_failed");
  });

  it("reads interrupted for a connection dropped mid-run", () => {
    expect(
      deriveWorkflowState({ runStatus: "interrupted", hasMeasurement: true, hypotheses: [], timeline: [] }),
    ).toBe("interrupted");
  });

  it("reads more_evidence_needed when a completed run produced no hypotheses at all", () => {
    expect(
      deriveWorkflowState({ runStatus: "completed", hasMeasurement: true, hypotheses: [], timeline: [] }),
    ).toBe("more_evidence_needed");
  });

  it("reads ready_for_next_test when a leading hypothesis still has missing evidence", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisWithMissingEvidence],
        timeline: [],
      }),
    ).toBe("ready_for_next_test");
  });

  it("reads more_evidence_needed (not ready_for_next_test) when every hypothesis is already fully evidenced with no recorded next test", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisFullyEvidenced],
        timeline: [],
      }),
    ).toBe("more_evidence_needed");
  });

  it("reads change_ready_to_verify once an engineering change was recorded and no measurement/result followed it", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisWithMissingEvidence],
        timeline: [engineeringChange("2026-08-30T00:00:00.000Z")],
      }),
    ).toBe("change_ready_to_verify");
  });

  it("reads outcome_ready_for_review once a result exists after the latest engineering change", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisWithMissingEvidence],
        timeline: [
          engineeringChange("2026-08-30T00:00:00.000Z"),
          resultEntry("2026-08-31T00:00:00.000Z"),
        ],
      }),
    ).toBe("outcome_ready_for_review");
  });

  it("boundary: a second engineering change after the result reverts to change_ready_to_verify, never silently staying on the stale outcome state", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisWithMissingEvidence],
        timeline: [
          engineeringChange("2026-08-30T00:00:00.000Z"),
          resultEntry("2026-08-31T00:00:00.000Z"),
          engineeringChange("2026-09-01T00:00:00.000Z"),
        ],
      }),
    ).toBe("change_ready_to_verify");
  });

  it("reads resolved only when the case record itself says resolved — never inferred from a run finishing", () => {
    expect(
      deriveWorkflowState({
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisWithMissingEvidence],
        timeline: [],
        caseStatus: "resolved",
      }),
    ).toBe("resolved");
  });

  it("resolved case status takes priority even over an in-flight run status", () => {
    expect(
      deriveWorkflowState({
        runStatus: "running",
        hasMeasurement: true,
        hypotheses: [],
        timeline: [],
        caseStatus: "resolved",
      }),
    ).toBe("resolved");
  });

  it("every WorkflowState has a label and a tone — no state can render blank", () => {
    for (const state of Object.keys(WORKFLOW_STATE_LABEL) as (keyof typeof WORKFLOW_STATE_LABEL)[]) {
      expect(WORKFLOW_STATE_LABEL[state]).toBeTruthy();
      expect(WORKFLOW_STATE_TONE[state]).toBeTruthy();
    }
  });
});
