import { describe, expect, it } from "vitest";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import { MissingProviderApiKeyError } from "@/lib/ai/provider";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { HypothesisGenerationOutput } from "@/lib/hypotheses/schema";
import type { RunInvestigationAgentResult } from "@/lib/agents/investigation-agent";
import {
  runAnalysis,
  sanitizeAnalysisError,
  type InvestigationAgentRunner,
  type RunAnalysisInput,
} from "./run-analysis";
import type { AnalysisEvent } from "./events";

const gatewayXFacts: ProductFactRecord[] = [
  {
    id: "fact-clock-40mhz",
    category: "clock",
    fact: { label: "system clock", frequencyMhz: 40 },
    source: "user_entered",
  },
];

function baseInput(overrides: Partial<RunAnalysisInput> = {}): RunAnalysisInput {
  return {
    runId: "run-1",
    failureCaseId: "case-1",
    measurement: {
      id: "measurement-1",
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: "WiFi TX + display active",
    },
    productFacts: gatewayXFacts,
    productFactSummaries: [
      {
        id: "fact-clock-40mhz",
        category: "clock",
        label: "system clock",
        summary: "40 MHz system clock",
      },
    ],
    ...overrides,
  };
}

function fakeAdapter(response: HypothesisGenerationOutput): HypothesisModelAdapter {
  return { generateHypotheses: async () => response };
}

function throwingAdapter(error: unknown): HypothesisModelAdapter {
  return {
    generateHypotheses: async () => {
      throw error;
    },
  };
}

async function collect(
  generator: AsyncGenerator<AnalysisEvent, void, void>,
): Promise<AnalysisEvent[]> {
  const events: AnalysisEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe("runAnalysis — Gateway X happy path", () => {
  it("streams run.started -> measurement.loaded -> correlation.found (40 MHz x 5) -> hypothesis.created -> run.completed", async () => {
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "40 MHz clock 5th harmonic",
          confidenceBand: "medium",
          reasoning:
            "The measured frequency lines up with a 5th-order harmonic of the system clock.",
          missingEvidence: ["Check emissions with the clock disabled."],
          recommendedNextStep:
            "An engineer could re-clock or shield the oscillator and re-measure.",
        },
      ],
      clarificationQuestion: null,
    });

    const events = await collect(runAnalysis(baseInput(), adapter));

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "hypothesis.created",
      "run.completed",
    ]);

    const correlation = events[2];
    if (correlation.type !== "correlation.found") throw new Error("expected correlation.found");
    expect(correlation.payload.productFactId).toBe("fact-clock-40mhz");
    expect(correlation.payload.harmonicNumber).toBe(5);
    expect(correlation.payload.sourceFrequencyMhz).toBe(40);
    expect(correlation.payload.expectedFrequencyMhz).toBeCloseTo(200);

    const hypothesis = events[3];
    if (hypothesis.type !== "hypothesis.created") throw new Error("expected hypothesis.created");
    expect(hypothesis.payload.productFactId).toBe("fact-clock-40mhz");
    expect(hypothesis.payload.evidence.map((e) => e.category)).toEqual([
      "observed",
      "known",
      "inferred",
      "missing",
    ]);

    const completed = events[4];
    if (completed.type !== "run.completed") throw new Error("expected run.completed");
    expect(completed.payload).toEqual({
      correlationsFound: 1,
      hypothesesCreated: 1,
      clarificationRequired: false,
    });
  });

  it("assigns strictly increasing sequence numbers starting at 0, all stamped with the run id", async () => {
    const adapter = fakeAdapter({ hypotheses: [], clarificationQuestion: null });
    const events = await collect(runAnalysis(baseInput(), adapter));

    expect(events.map((e) => e.sequence)).toEqual([0, 1, 2, 3]);
    expect(events.every((e) => e.runId === "run-1")).toBe(true);
  });

  it("emits a clarification.required event when the hypothesis service asks a question", async () => {
    const adapter = fakeAdapter({
      hypotheses: [],
      clarificationQuestion: "Was the WiFi radio active during this scan?",
    });

    const events = await collect(runAnalysis(baseInput(), adapter));

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "clarification.required",
      "run.completed",
    ]);
  });
});

describe("runAnalysis — no correlation candidates (missing-data case)", () => {
  it("still completes with zero counts, without calling the model", async () => {
    let called = false;
    const adapter: HypothesisModelAdapter = {
      generateHypotheses: async () => {
        called = true;
        return { hypotheses: [], clarificationQuestion: null };
      },
    };

    const events = await collect(
      runAnalysis(baseInput({ productFacts: [], productFactSummaries: [] }), adapter),
    );

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "run.completed",
    ]);
    const completed = events[2];
    if (completed.type !== "run.completed") throw new Error("expected run.completed");
    expect(completed.payload).toEqual({
      correlationsFound: 0,
      hypothesesCreated: 0,
      clarificationRequired: false,
    });
    expect(called).toBe(false);
  });
});

describe("runAnalysis — failure handling", () => {
  it("emits run.failed as the last event, with a safe message, when the adapter throws (missing API key)", async () => {
    const events = await collect(
      runAnalysis(baseInput(), throwingAdapter(new MissingProviderApiKeyError())),
    );

    expect(events.at(-1)?.type).toBe("run.failed");
    const failed = events.at(-1);
    if (!failed || failed.type !== "run.failed") throw new Error("expected run.failed");
    expect(failed.payload.message).toBe(
      "ANTHROPIC_API_KEY is not configured. Set it in the environment before running analysis.",
    );
    // No run.completed after a failure.
    expect(events.some((e) => e.type === "run.completed")).toBe(false);
  });

  it("never leaks a raw/unexpected error's message to the client", async () => {
    const events = await collect(
      runAnalysis(
        baseInput(),
        throwingAdapter(new Error("Anthropic API key sk-ant-super-secret rejected")),
      ),
    );

    const failed = events.at(-1);
    if (!failed || failed.type !== "run.failed") throw new Error("expected run.failed");
    expect(failed.payload.message).not.toContain("sk-ant-super-secret");
    expect(failed.payload.message).toBe(
      "Analysis failed unexpectedly. Please try again or contact support.",
    );
  });
});

function fakeAgentRunner(
  result: RunInvestigationAgentResult,
): InvestigationAgentRunner {
  return { investigate: async () => result };
}

function throwingAgentRunner(error: unknown): InvestigationAgentRunner {
  return {
    investigate: async () => {
      throw error;
    },
  };
}

const emptyAgentMetrics = {
  documentsAvailable: 0,
  documentSearches: 0,
  passagesRetrieved: 0,
  passagesUsedAsEvidence: 0,
  deterministicRelationshipsChecked: 1,
  nextInvestigationCount: 0,
};

describe("runAnalysis — Investigation Agent phase (MVP-10B)", () => {
  it("uses the agent's hypotheses instead of the plain adapter's when an agentRunner is provided, and never calls the plain adapter", async () => {
    let plainAdapterCalled = false;
    const adapter: HypothesisModelAdapter = {
      generateHypotheses: async () => {
        plainAdapterCalled = true;
        return { hypotheses: [], clarificationQuestion: null };
      },
    };

    const agentRunner = fakeAgentRunner({
      activity: [
        { toolName: "getMeasurementContext", label: "Loaded measurement context / 1 peak", resultCount: 1, durationMs: 5, query: null },
        { toolName: "searchEngineeringDocuments", label: "Searched engineering documents / 2 passages retrieved", resultCount: 2, durationMs: 12, query: "40 MHz clock" },
      ],
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "5th harmonic of the system clock",
          confidenceBand: "medium",
          recommendedNextStep: "Disconnect the display path and re-measure.",
          evidence: [
            { category: "observed", description: "Measured 200 MHz." },
            { category: "known", description: "40 MHz system clock." },
            { category: "known", description: "EMC-Test-04.md: \"40 MHz times 5 equals 200 MHz.\"" },
            { category: "inferred", description: "Consistent with the fifth harmonic." },
            { category: "missing", description: "Measurement with display disconnected." },
          ],
        },
      ],
      clarificationQuestion: null,
      metrics: { ...emptyAgentMetrics, documentSearches: 1, passagesRetrieved: 2, passagesUsedAsEvidence: 1, nextInvestigationCount: 1 },
    });

    const events = await collect(runAnalysis(baseInput(), adapter, agentRunner));

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "agent.started",
      "agent.tool.completed",
      "agent.tool.completed",
      "agent.completed",
      "hypothesis.created",
      "run.completed",
    ]);
    expect(plainAdapterCalled).toBe(false);

    const started = events[3];
    if (started.type !== "agent.started") throw new Error("expected agent.started");
    expect(started.payload).toEqual({ correlationCount: 1 });

    const toolEvents = events.filter((e) => e.type === "agent.tool.completed");
    expect(toolEvents.map((e) => (e.type === "agent.tool.completed" ? e.payload.toolName : null))).toEqual([
      "getMeasurementContext",
      "searchEngineeringDocuments",
    ]);

    const completed = events[6];
    if (completed.type !== "agent.completed") throw new Error("expected agent.completed");
    expect(completed.payload.passagesUsedAsEvidence).toBe(1);

    const hypothesis = events[7];
    if (hypothesis.type !== "hypothesis.created") throw new Error("expected hypothesis.created");
    expect(hypothesis.payload.evidence.map((e) => e.category)).toEqual([
      "observed",
      "known",
      "known",
      "inferred",
      "missing",
    ]);
  });

  it("still emits guaranteed deterministic correlation.found events before the agent phase (correlation stays authoritative)", async () => {
    const agentRunner = fakeAgentRunner({
      activity: [],
      hypotheses: [],
      clarificationQuestion: null,
      metrics: emptyAgentMetrics,
    });

    const events = await collect(
      runAnalysis(baseInput(), fakeAdapterUnused(), agentRunner),
    );

    const correlationIndex = events.findIndex((e) => e.type === "correlation.found");
    const agentStartedIndex = events.findIndex((e) => e.type === "agent.started");
    expect(correlationIndex).toBeGreaterThanOrEqual(0);
    expect(agentStartedIndex).toBeGreaterThan(correlationIndex);
  });

  it("falls back to the plain adapter path when there are no correlation candidates, even with an agentRunner provided (no relevant documents to ground on)", async () => {
    let agentCalled = false;
    const agentRunner: InvestigationAgentRunner = {
      investigate: async () => {
        agentCalled = true;
        throw new Error("should never be called with zero correlation candidates");
      },
    };

    const events = await collect(
      runAnalysis(
        baseInput({ productFacts: [], productFactSummaries: [] }),
        fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
        agentRunner,
      ),
    );

    expect(agentCalled).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["run.started", "measurement.loaded", "run.completed"]);
  });

  it("emits run.failed, not an unhandled rejection, when the agent phase itself throws (model/tool failure)", async () => {
    const agentRunner = throwingAgentRunner(new Error("Anthropic request failed"));

    const events = await collect(runAnalysis(baseInput(), fakeAdapterUnused(), agentRunner));

    expect(events.at(-1)?.type).toBe("run.failed");
    expect(events.some((e) => e.type === "hypothesis.created")).toBe(false);
    expect(events.some((e) => e.type === "run.completed")).toBe(false);
  });

  it("emits a clarification.required event sourced from the agent's output", async () => {
    const agentRunner = fakeAgentRunner({
      activity: [],
      hypotheses: [],
      clarificationQuestion: "Was the display refresh clock documented?",
      metrics: emptyAgentMetrics,
    });

    const events = await collect(runAnalysis(baseInput(), fakeAdapterUnused(), agentRunner));

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "agent.started",
      "agent.completed",
      "clarification.required",
      "run.completed",
    ]);
  });
});

function fakeAdapterUnused(): HypothesisModelAdapter {
  return {
    generateHypotheses: async () => {
      throw new Error("the plain adapter should never be called when an agentRunner handles the run");
    },
  };
}

describe("sanitizeAnalysisError", () => {
  it("passes through the safe MissingProviderApiKeyError message", () => {
    expect(sanitizeAnalysisError(new MissingProviderApiKeyError())).toContain(
      "ANTHROPIC_API_KEY",
    );
  });

  it("replaces any other error with a generic safe message", () => {
    expect(sanitizeAnalysisError(new Error("some internal detail"))).toBe(
      "Analysis failed unexpectedly. Please try again or contact support.",
    );
    expect(sanitizeAnalysisError("not even an Error object")).toBe(
      "Analysis failed unexpectedly. Please try again or contact support.",
    );
  });
});
