import { describe, expect, it } from "vitest";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import { MissingProviderApiKeyError } from "@/lib/ai/provider";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { HypothesisGenerationOutput } from "@/lib/hypotheses/schema";
import { runAnalysis, sanitizeAnalysisError, type RunAnalysisInput } from "./run-analysis";
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
