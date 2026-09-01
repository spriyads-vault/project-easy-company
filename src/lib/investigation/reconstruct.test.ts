import { describe, expect, it } from "vitest";
import type { AnalysisEvent } from "@/lib/analysis/events";
import {
  applyAnalysisEvent,
  initialWorkspaceState,
  isRunActive,
  reconstructFromPersistedEvents,
} from "./reconstruct";

function event(
  overrides: Partial<AnalysisEvent> & Pick<AnalysisEvent, "type" | "payload">,
): AnalysisEvent {
  return {
    runId: "run-1",
    sequence: 0,
    createdAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  } as AnalysisEvent;
}

const runStarted = () =>
  event({
    type: "run.started",
    sequence: 0,
    payload: { failureCaseId: "case-1", measurementId: "measurement-1" },
  });

const measurementLoaded = () =>
  event({
    type: "measurement.loaded",
    sequence: 1,
    payload: {
      measurementId: "measurement-1",
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: "WiFi TX + display active",
    },
  });

const correlationFound = (overrides: Partial<{ sourceFrequencyMhz: number; harmonicNumber: number; productFactId: string }> = {}) =>
  event({
    type: "correlation.found",
    sequence: 2,
    payload: {
      productFactId: overrides.productFactId ?? "fact-clock-40mhz",
      productFactCategory: "clock",
      productFactLabel: "system clock",
      sourceFrequencyMhz: overrides.sourceFrequencyMhz ?? 40,
      harmonicNumber: overrides.harmonicNumber ?? 5,
      expectedFrequencyMhz: 200,
      measuredFrequencyMhz: 200,
      deviationMhz: 0,
      deviationRatio: 0,
      description: "200 MHz is consistent with the 5th harmonic of \"system clock\".",
    },
  });

const hypothesisCreated = () =>
  event({
    type: "hypothesis.created",
    sequence: 3,
    payload: {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "medium",
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [
        { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
        { category: "known", description: "40 MHz system clock." },
        { category: "inferred", description: "The fifth harmonic relationship may be relevant." },
        { category: "missing", description: "Measurement with display disconnected." },
      ],
    },
  });

const clarificationRequired = () =>
  event({
    type: "clarification.required",
    sequence: 4,
    payload: { question: "Was the display refresh clock documented?" },
  });

const agentStarted = () =>
  event({
    type: "agent.started",
    sequence: 3,
    payload: { correlationCount: 1 },
  });

const agentToolCompleted = (overrides: Partial<{ toolName: string; label: string }> = {}) =>
  event({
    type: "agent.tool.completed",
    sequence: 4,
    payload: {
      toolName: overrides.toolName ?? "searchEngineeringDocuments",
      label: overrides.label ?? "Searched engineering documents / 2 passages retrieved",
      resultCount: 2,
      durationMs: 120,
      query: "40 MHz clock",
    },
  });

const agentCompleted = () =>
  event({
    type: "agent.completed",
    sequence: 5,
    payload: {
      documentsAvailable: 12,
      documentSearches: 1,
      passagesRetrieved: 2,
      passagesUsedAsEvidence: 1,
      deterministicRelationshipsChecked: 1,
      nextInvestigationCount: 1,
    },
  });

const runCompleted = () =>
  event({
    type: "run.completed",
    sequence: 5,
    payload: { correlationsFound: 1, hypothesesCreated: 1, clarificationRequired: true },
  });

const runFailed = () =>
  event({
    type: "run.failed",
    sequence: 1,
    payload: { message: "Analysis failed unexpectedly. Please try again or contact support." },
  });

describe("applyAnalysisEvent", () => {
  it("run.started resets to running and clears prior state (positive + RUN AGAIN case)", () => {
    const priorRun = [runStarted(), measurementLoaded(), hypothesisCreated(), runCompleted()].reduce(
      applyAnalysisEvent,
      initialWorkspaceState,
    );
    expect(priorRun.status).toBe("completed");
    expect(priorRun.hypotheses).toHaveLength(1);

    const restarted = applyAnalysisEvent(priorRun, runStarted());
    expect(restarted.status).toBe("running");
    expect(restarted.hypotheses).toEqual([]);
    expect(restarted.correlations).toEqual([]);
    expect(restarted.summary).toBeNull();
    expect(restarted.lastEventSummary).toBe("Analyzing measurement…");
  });

  it("measurement.loaded populates the measurement and status line", () => {
    const state = applyAnalysisEvent(initialWorkspaceState, measurementLoaded());
    expect(state.measurement).toEqual({
      measurementId: "measurement-1",
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: "WiFi TX + display active",
    });
    expect(state.lastEventSummary).toBe("200 MHz measurement loaded");
  });

  it("correlation.found appends candidates (multiple correlations case)", () => {
    const state = [correlationFound(), correlationFound({ productFactId: "fact-radio-2400", sourceFrequencyMhz: 2400, harmonicNumber: 1 })].reduce(
      applyAnalysisEvent,
      initialWorkspaceState,
    );
    expect(state.correlations).toHaveLength(2);
    expect(state.correlations[0].productFactId).toBe("fact-clock-40mhz");
    expect(state.correlations[1].productFactId).toBe("fact-radio-2400");
  });

  it("hypothesis.created appends the hypothesis with its evidence categories intact", () => {
    const state = applyAnalysisEvent(initialWorkspaceState, hypothesisCreated());
    expect(state.hypotheses).toHaveLength(1);
    const categories = state.hypotheses[0].evidence.map((item) => item.category);
    expect(categories).toEqual(["observed", "known", "inferred", "missing"]);
  });

  it("clarification.required sets the question (negative case: absent by default)", () => {
    expect(initialWorkspaceState.clarification).toBeNull();
    const state = applyAnalysisEvent(initialWorkspaceState, clarificationRequired());
    expect(state.clarification).toBe("Was the display refresh clock documented?");
  });

  it("run.completed sets status completed and stores the summary", () => {
    const state = applyAnalysisEvent(initialWorkspaceState, runCompleted());
    expect(state.status).toBe("completed");
    expect(state.summary).toEqual({
      correlationsFound: 1,
      hypothesesCreated: 1,
      clarificationRequired: true,
    });
  });

  it("run.failed sets status failed with the safe message (never re-triggers anything)", () => {
    const state = applyAnalysisEvent(initialWorkspaceState, runFailed());
    expect(state.status).toBe("failed");
    expect(state.errorMessage).toBe(
      "Analysis failed unexpectedly. Please try again or contact support.",
    );
  });

  it("agent.started marks the agent phase active, without disturbing the correlations already shown", () => {
    const state = [correlationFound(), agentStarted()].reduce(applyAnalysisEvent, initialWorkspaceState);
    expect(state.agentActive).toBe(true);
    expect(state.correlations).toHaveLength(1);
    expect(state.lastEventSummary).toBe("Investigation agent started");
  });

  it("agent.tool.completed appends observable activity in order, never touching hidden reasoning", () => {
    const state = [
      agentStarted(),
      agentToolCompleted({ toolName: "getMeasurementContext", label: "Loaded measurement context / 1 peak" }),
      agentToolCompleted({ toolName: "searchEngineeringDocuments", label: "Searched engineering documents / 2 passages retrieved" }),
    ].reduce(applyAnalysisEvent, initialWorkspaceState);

    expect(state.agentActivity.map((a) => a.toolName)).toEqual([
      "getMeasurementContext",
      "searchEngineeringDocuments",
    ]);
    expect(state.lastEventSummary).toBe("Searched engineering documents / 2 passages retrieved");
  });

  it("agent.completed stores the truthful metrics and clears agentActive", () => {
    const state = [agentStarted(), agentCompleted()].reduce(applyAnalysisEvent, initialWorkspaceState);
    expect(state.agentActive).toBe(false);
    expect(state.agentMetrics).toEqual({
      documentsAvailable: 12,
      documentSearches: 1,
      passagesRetrieved: 2,
      passagesUsedAsEvidence: 1,
      deterministicRelationshipsChecked: 1,
      nextInvestigationCount: 1,
    });
  });

  it("run.completed with zero correlations/hypotheses stays a valid completed state (empty hypotheses case)", () => {
    const state = [
      runStarted(),
      measurementLoaded(),
      event({
        type: "run.completed",
        sequence: 2,
        payload: { correlationsFound: 0, hypothesesCreated: 0, clarificationRequired: false },
      }),
    ].reduce(applyAnalysisEvent, initialWorkspaceState);
    expect(state.status).toBe("completed");
    expect(state.correlations).toEqual([]);
    expect(state.hypotheses).toEqual([]);
  });
});

describe("isRunActive", () => {
  it("is true only while running", () => {
    expect(isRunActive("running")).toBe(true);
    expect(isRunActive("idle")).toBe(false);
    expect(isRunActive("completed")).toBe(false);
    expect(isRunActive("failed")).toBe(false);
    expect(isRunActive("interrupted")).toBe(false);
  });
});

describe("reconstructFromPersistedEvents", () => {
  it("returns idle state for no persisted events (missing-data case)", () => {
    expect(reconstructFromPersistedEvents([])).toEqual(initialWorkspaceState);
  });

  it("reconstructs a fully completed run exactly as a live stream would produce it", () => {
    const events = [
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      clarificationRequired(),
      runCompleted(),
    ];
    const state = reconstructFromPersistedEvents(events);
    expect(state.status).toBe("completed");
    expect(state.correlations).toHaveLength(1);
    expect(state.hypotheses).toHaveLength(1);
    expect(state.clarification).toBe("Was the display refresh clock documented?");
  });

  it("reconstructs a completed run that went through the Investigation Agent phase (MVP-10B)", () => {
    const events = [
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      agentStarted(),
      agentToolCompleted(),
      agentCompleted(),
      hypothesisCreated(),
      runCompleted(),
    ];
    const state = reconstructFromPersistedEvents(events);
    expect(state.status).toBe("completed");
    expect(state.agentActive).toBe(false);
    expect(state.agentActivity).toHaveLength(1);
    expect(state.agentMetrics).not.toBeNull();
    expect(state.hypotheses).toHaveLength(1);
  });

  it("reconstructs a failed run", () => {
    const state = reconstructFromPersistedEvents([runStarted(), runFailed()]);
    expect(state.status).toBe("failed");
  });

  it("marks a run with no terminal event as interrupted, not still running (refresh-recovery boundary case)", () => {
    const state = reconstructFromPersistedEvents([runStarted(), measurementLoaded()]);
    expect(state.status).toBe("interrupted");
    expect(state.errorMessage).toContain("Run again to retry");
  });
});
