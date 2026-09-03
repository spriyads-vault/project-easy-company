import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { deriveWorkflowState, type WorkflowState } from "@/lib/investigation/derive-workflow-state";
import {
  deriveQueueWorkflowState,
  describeRequiredNextAction,
  queueFilterBucket,
  type QueueWorkflowStateInput,
} from "./derive-queue-workflow-state";

const baseInput: QueueWorkflowStateInput = {
  caseStatus: "open",
  hasMeasurement: true,
  latestRunStatus: "completed",
  latestRunHypothesisCount: 1,
  latestRunHasMissingEvidence: false,
  lastEngineeringChangeAt: null,
  lastResultAt: null,
};

describe("deriveQueueWorkflowState", () => {
  it("reads resolved from case status regardless of everything else", () => {
    expect(
      deriveQueueWorkflowState({ ...baseInput, caseStatus: "resolved", hasMeasurement: false, latestRunStatus: null }),
    ).toBe("resolved");
    expect(deriveQueueWorkflowState({ ...baseInput, caseStatus: "archived" })).toBe("resolved");
  });

  it("reads awaiting_measurement when no measurement exists yet", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, hasMeasurement: false, latestRunStatus: null })).toBe(
      "awaiting_measurement",
    );
  });

  it("reads analysis_in_progress for both pending and running", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunStatus: "pending" })).toBe("analysis_in_progress");
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunStatus: "running" })).toBe("analysis_in_progress");
  });

  it("reads analysis_failed", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunStatus: "failed" })).toBe("analysis_failed");
  });

  it("reads idle when a measurement exists but no run has ever started", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunStatus: null })).toBe("idle");
  });

  it("reads change_ready_to_verify when the last change is newer than the last result", () => {
    expect(
      deriveQueueWorkflowState({
        ...baseInput,
        lastEngineeringChangeAt: "2026-01-02T00:00:00Z",
        lastResultAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe("change_ready_to_verify");
  });

  it("reads change_ready_to_verify when a change exists and no result exists yet", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, lastEngineeringChangeAt: "2026-01-02T00:00:00Z" })).toBe(
      "change_ready_to_verify",
    );
  });

  it("reads outcome_ready_for_review when the last result is at least as new as the last change", () => {
    expect(
      deriveQueueWorkflowState({
        ...baseInput,
        lastEngineeringChangeAt: "2026-01-01T00:00:00Z",
        lastResultAt: "2026-01-02T00:00:00Z",
      }),
    ).toBe("outcome_ready_for_review");
  });

  it("reads more_evidence_needed when the latest completed run produced zero hypotheses", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunHypothesisCount: 0 })).toBe("more_evidence_needed");
  });

  it("reads ready_for_next_test when the latest hypothesis has a real missing-evidence gap", () => {
    expect(deriveQueueWorkflowState({ ...baseInput, latestRunHasMissingEvidence: true })).toBe("ready_for_next_test");
  });

  it("reads more_evidence_needed when hypotheses exist with no missing-evidence gap", () => {
    expect(deriveQueueWorkflowState(baseInput)).toBe("more_evidence_needed");
  });
});

describe("queueFilterBucket", () => {
  it("maps every WorkflowState to exactly one of the four ticket-named buckets", () => {
    const allStates: WorkflowState[] = [
      "awaiting_measurement",
      "idle",
      "analysis_in_progress",
      "analysis_failed",
      "interrupted",
      "more_evidence_needed",
      "ready_for_next_test",
      "change_ready_to_verify",
      "outcome_ready_for_review",
      "resolved",
    ];
    const buckets = allStates.map(queueFilterBucket);
    expect(new Set(buckets)).toEqual(new Set(["active", "needs_evidence", "ready_for_review", "resolved"]));
    expect(queueFilterBucket("resolved")).toBe("resolved");
    expect(queueFilterBucket("outcome_ready_for_review")).toBe("ready_for_review");
    expect(queueFilterBucket("change_ready_to_verify")).toBe("ready_for_review");
    expect(queueFilterBucket("more_evidence_needed")).toBe("needs_evidence");
    expect(queueFilterBucket("ready_for_next_test")).toBe("needs_evidence");
    expect(queueFilterBucket("idle")).toBe("active");
  });
});

describe("describeRequiredNextAction", () => {
  it("returns a distinct, non-empty string for every WorkflowState", () => {
    const allStates: WorkflowState[] = [
      "awaiting_measurement",
      "idle",
      "analysis_in_progress",
      "analysis_failed",
      "interrupted",
      "more_evidence_needed",
      "ready_for_next_test",
      "change_ready_to_verify",
      "outcome_ready_for_review",
      "resolved",
    ];
    const descriptions = allStates.map(describeRequiredNextAction);
    expect(descriptions.every((d) => d.length > 0)).toBe(true);
    expect(new Set(descriptions).size).toBe(allStates.length);
  });
});

// Equivalence: for every scenario expressible in both the full
// deriveWorkflowState (case-detail) and the batched queue inputs, the two
// must reach the identical WorkflowState — proving the queue-scale
// shortcut never drifts from the canonical single-case derivation it's
// standing in for.
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

describe("deriveQueueWorkflowState agrees with deriveWorkflowState", () => {
  const scenarios: { name: string; full: Parameters<typeof deriveWorkflowState>[0]; queue: QueueWorkflowStateInput }[] = [
    {
      name: "resolved case",
      full: { runStatus: "completed", hasMeasurement: true, hypotheses: [], timeline: [], caseStatus: "resolved" },
      queue: { ...baseInput, caseStatus: "resolved", latestRunHypothesisCount: 0 },
    },
    {
      name: "no measurement yet",
      full: { runStatus: "idle", hasMeasurement: false, hypotheses: [], timeline: [] },
      queue: { ...baseInput, hasMeasurement: false, latestRunStatus: null, latestRunHypothesisCount: 0 },
    },
    {
      name: "run in progress",
      full: { runStatus: "running", hasMeasurement: true, hypotheses: [], timeline: [] },
      queue: { ...baseInput, latestRunStatus: "running", latestRunHypothesisCount: 0 },
    },
    {
      name: "run failed",
      full: { runStatus: "failed", hasMeasurement: true, hypotheses: [], timeline: [] },
      queue: { ...baseInput, latestRunStatus: "failed", latestRunHypothesisCount: 0 },
    },
    {
      name: "measurement recorded, never run",
      full: { runStatus: "idle", hasMeasurement: true, hypotheses: [], timeline: [] },
      queue: { ...baseInput, latestRunStatus: null, latestRunHypothesisCount: 0 },
    },
    {
      name: "change newer than result",
      full: {
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisFullyEvidenced],
        timeline: [engineeringChange("2026-01-02T00:00:00Z"), resultEntry("2026-01-01T00:00:00Z")],
      },
      queue: {
        ...baseInput,
        lastEngineeringChangeAt: "2026-01-02T00:00:00Z",
        lastResultAt: "2026-01-01T00:00:00Z",
      },
    },
    {
      name: "result newer than change",
      full: {
        runStatus: "completed",
        hasMeasurement: true,
        hypotheses: [hypothesisFullyEvidenced],
        timeline: [engineeringChange("2026-01-01T00:00:00Z"), resultEntry("2026-01-02T00:00:00Z")],
      },
      queue: {
        ...baseInput,
        lastEngineeringChangeAt: "2026-01-01T00:00:00Z",
        lastResultAt: "2026-01-02T00:00:00Z",
      },
    },
    {
      name: "no hypotheses in completed run",
      full: { runStatus: "completed", hasMeasurement: true, hypotheses: [], timeline: [] },
      queue: { ...baseInput, latestRunHypothesisCount: 0 },
    },
    {
      name: "hypothesis with a real missing-evidence gap",
      full: { runStatus: "completed", hasMeasurement: true, hypotheses: [hypothesisWithMissingEvidence], timeline: [] },
      queue: { ...baseInput, latestRunHasMissingEvidence: true },
    },
    {
      name: "fully evidenced hypothesis, nothing missing",
      full: { runStatus: "completed", hasMeasurement: true, hypotheses: [hypothesisFullyEvidenced], timeline: [] },
      queue: { ...baseInput, latestRunHasMissingEvidence: false },
    },
  ];

  it.each(scenarios)("$name", ({ full, queue }) => {
    expect(deriveQueueWorkflowState(queue)).toBe(deriveWorkflowState(full));
  });
});
