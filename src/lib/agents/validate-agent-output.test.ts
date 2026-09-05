import { describe, expect, it } from "vitest";
import type { HarmonicCorrelationCandidate } from "@/lib/correlation/harmonic-correlation";
import type { AgentOutput } from "./schema";
import {
  createEmptyRegistry,
  validateAgentOutput,
  buildAgentCompletedPayload,
  type RetrievedRegistry,
} from "./validate-agent-output";

const candidate: HarmonicCorrelationCandidate = {
  productFactId: "fact-clock-40mhz",
  productFactCategory: "clock",
  productFactLabel: "system clock",
  sourceFrequencyMhz: 40,
  harmonicNumber: 5,
  expectedFrequencyMhz: 200,
  measuredFrequencyMhz: 200,
  deviationMhz: 0,
  deviationRatio: 0,
  description: '200 MHz is consistent with the 5th harmonic of "system clock".',
};

const measurement = {
  frequencyMhz: 200,
  marginDb: 7.4,
  operatingMode: "WiFi TX + display active",
};

const productFacts = [
  { id: "fact-clock-40mhz", category: "clock" as const, label: "system clock", summary: "40 MHz system clock" },
];

function baseAgentOutput(overrides: Partial<AgentOutput["hypotheses"][number]> = {}): AgentOutput {
  return {
    hypotheses: [
      {
        productFactId: "fact-clock-40mhz",
        title: "5th harmonic of the system clock",
        confidenceBand: "medium",
        reasoning: "The 200 MHz peak lines up with a fifth-order harmonic of the clock.",
        evidenceRefs: [],
        missingEvidence: ["Measurement with the clock disabled."],
        nextInvestigation: "Re-measure with the clock disconnected.",
        previousHypothesisId: null,
        hypothesisUpdateStatus: null,
        ...overrides,
      },
    ],
    clarificationQuestion: null,
    investigationStatus: "hypotheses_ready",
  };
}

function registryWithPassage(): RetrievedRegistry {
  const registry = createEmptyRegistry(5);
  registry.documentPassagesByChunkId.set("chunk-1", {
    chunkId: "chunk-1",
    documentId: "doc-1",
    filename: "EMC-Test-04.md",
    documentType: "test_report",
    pageNumber: null,
    section: "Suspected Source",
    passage: "The 40 MHz system clock is a strong candidate.",
  });
  registry.passagesRetrievedCount = 1;
  registry.documentSearchCount = 1;
  return registry;
}

describe("validateAgentOutput", () => {
  it("assembles OBSERVED/KNOWN/INFERRED/MISSING evidence for a well-grounded hypothesis (positive case)", () => {
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput(),
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].evidence.map((e) => e.category)).toEqual([
      "observed",
      "known",
      "inferred",
      "missing",
    ]);
    expect(result.rejectedHypothesisCount).toBe(0);
    expect(result.droppedCitationCount).toBe(0);
  });

  it("rejects a hypothesis whose productFactId was never a real correlation candidate (hallucinated id)", () => {
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({ productFactId: "fact-invented" }),
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toEqual([]);
    expect(result.rejectedHypothesisCount).toBe(1);
  });

  it("rejects a hypothesis containing certainty/root-cause language", () => {
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({ reasoning: "This is definitely the root cause." }),
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toEqual([]);
    expect(result.rejectedHypothesisCount).toBe(1);
  });

  it("rejects certainty language in nextInvestigation too, not only reasoning", () => {
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({ nextInvestigation: "Confirmed as the cause — ship it." }),
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toEqual([]);
  });

  it("keeps a valid document citation as KNOWN evidence, sourced from the stored passage text", () => {
    const registry = registryWithPassage();
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "document_passage", chunkId: "chunk-1", documentId: "doc-1" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toHaveLength(1);
    const documentEvidence = result.hypotheses[0].evidence.find((e) =>
      e.description.includes("EMC-Test-04.md"),
    );
    expect(documentEvidence).toBeDefined();
    expect(documentEvidence?.description).toContain("The 40 MHz system clock is a strong candidate.");
    expect(documentEvidence?.citation).toEqual({
      documentId: "doc-1",
      chunkId: "chunk-1",
      filename: "EMC-Test-04.md",
      documentType: "test_report",
      pageNumber: null,
      section: "Suspected Source",
      passage: "The 40 MHz system clock is a strong candidate.",
    });
    expect(documentEvidence?.category).toBe("known");
    expect(result.passagesUsedAsEvidence).toBe(1);
  });

  it("drops a citation whose chunkId was never actually retrieved this run, without discarding the hypothesis (hallucinated citation)", () => {
    const registry = registryWithPassage();
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [
          { sourceType: "document_passage", chunkId: "chunk-never-retrieved", documentId: "doc-1" },
        ],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].evidence.some((e) => e.description.includes("chunk-never-retrieved"))).toBe(
      false,
    );
    expect(result.droppedCitationCount).toBe(1);
    expect(result.passagesUsedAsEvidence).toBe(0);
  });

  it("drops a citation whose documentId doesn't match the retrieved chunk's real document (mismatched pairing)", () => {
    const registry = registryWithPassage();
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "document_passage", chunkId: "chunk-1", documentId: "doc-wrong" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.droppedCitationCount).toBe(1);
    expect(result.passagesUsedAsEvidence).toBe(0);
  });

  it("drops a product_fact citation that the agent never actually received back from a tool call", () => {
    const registry = createEmptyRegistry(0);
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "product_fact", productFactId: "fact-clock-40mhz" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.droppedCitationCount).toBe(1);
  });

  it("keeps a product_fact citation the agent did actually receive", () => {
    const registry = createEmptyRegistry(0);
    registry.productFactIds.add("fact-clock-40mhz");
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "product_fact", productFactId: "fact-clock-40mhz" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.droppedCitationCount).toBe(0);
    expect(result.hypotheses[0].evidence.some((e) => e.description.includes("40 MHz system clock"))).toBe(
      true,
    );
  });

  it("de-duplicates the KNOWN evidence line when the model's own evidenceRef cites the same fact the correlation candidate already grounds the hypothesis on (UX-07 correction — regression for a real duplicate-line bug)", () => {
    const registry = createEmptyRegistry(0);
    registry.productFactIds.add("fact-clock-40mhz");
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        // Same fact as `candidate.productFactId` above — this exact
        // combination previously rendered "Product context: 40 MHz system
        // clock" twice in one hypothesis's KNOWN section.
        evidenceRefs: [{ sourceType: "product_fact", productFactId: "fact-clock-40mhz" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    const knownLines = result.hypotheses[0].evidence.filter(
      (e) => e.category === "known" && e.description.includes("40 MHz system clock"),
    );
    expect(knownLines).toHaveLength(1);
  });

  it("drops an investigation-event citation never actually retrieved this run", () => {
    const registry = createEmptyRegistry(0);
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "previous_investigation", investigationEventId: "event-1" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.droppedCitationCount).toBe(1);
  });

  it("classifies an engineer observation citation as OBSERVED, distinguishable from KNOWN (MVP-11)", () => {
    const registry = createEmptyRegistry(0);
    registry.investigationEventsById.set("event-1", {
      id: "event-1",
      eventType: "observation",
      description: "Display path disconnected. 200 MHz peak dropped 9 dB.",
    });
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "previous_investigation", investigationEventId: "event-1" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    const observationEvidence = result.hypotheses[0].evidence.find((e) =>
      e.description.includes("Display path disconnected"),
    );
    expect(observationEvidence?.category).toBe("observed");
    expect(observationEvidence?.description).toBe(
      "Engineer observation: Display path disconnected. 200 MHz peak dropped 9 dB.",
    );
    expect(result.droppedCitationCount).toBe(0);
  });

  it("keeps a non-observation investigation event (e.g. a note) as KNOWN, not OBSERVED", () => {
    const registry = createEmptyRegistry(0);
    registry.investigationEventsById.set("event-2", {
      id: "event-2",
      eventType: "note",
      description: "Engineer suspects the ribbon cable.",
    });
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        evidenceRefs: [{ sourceType: "previous_investigation", investigationEventId: "event-2" }],
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    const noteEvidence = result.hypotheses[0].evidence.find((e) =>
      e.description.includes("ribbon cable"),
    );
    expect(noteEvidence?.category).toBe("known");
  });

  it("attaches a hypothesis-update status when previousHypothesisId matches one actually retrieved this run (MVP-11)", () => {
    const registry = createEmptyRegistry(0);
    registry.previousHypothesesById.set("run-1:0", {
      id: "run-1:0",
      title: "5th harmonic of the system clock, coupling via the display path",
    });
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        previousHypothesisId: "run-1:0",
        hypothesisUpdateStatus: "supported_by_new_evidence",
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses[0].update).toEqual({
      status: "supported_by_new_evidence",
      previousHypothesisTitle: "5th harmonic of the system clock, coupling via the display path",
    });
  });

  it("drops a hallucinated previousHypothesisId (never actually returned by getPreviousHypotheses this run)", () => {
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        previousHypothesisId: "run-invented:0",
        hypothesisUpdateStatus: "supported_by_new_evidence",
      }),
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].update).toBeUndefined();
    expect(result.droppedCitationCount).toBe(1);
  });

  it("never claims a Bayesian/probability update — the status is one of the four qualitative labels only", () => {
    const registry = createEmptyRegistry(0);
    registry.previousHypothesesById.set("run-1:0", { id: "run-1:0", title: "Prior hypothesis" });
    const result = validateAgentOutput({
      agentOutput: baseAgentOutput({
        previousHypothesisId: "run-1:0",
        hypothesisUpdateStatus: "weakened_by_new_evidence",
      }),
      registry,
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(["supported_by_new_evidence", "weakened_by_new_evidence", "unchanged", "needs_more_evidence"]).toContain(
      result.hypotheses[0].update?.status,
    );
  });

  it("clears a clarificationQuestion that contains certainty language", () => {
    const result = validateAgentOutput({
      agentOutput: {
        hypotheses: [],
        clarificationQuestion: "Is this definitely the root cause?",
        investigationStatus: "clarification_needed",
      },
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.clarificationQuestion).toBeNull();
  });

  it("passes through a well-formed clarificationQuestion", () => {
    const result = validateAgentOutput({
      agentOutput: {
        hypotheses: [],
        clarificationQuestion: "Was the display refresh clock documented?",
        investigationStatus: "clarification_needed",
      },
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate],
      productFacts,
      measurement,
    });

    expect(result.clarificationQuestion).toBe("Was the display refresh clock documented?");
  });

  it("handles multiple hypotheses, rejecting only the unsound one (multiple correlations case)", () => {
    const secondCandidate: HarmonicCorrelationCandidate = {
      ...candidate,
      productFactId: "fact-radio-2400",
      productFactCategory: "radio",
      productFactLabel: "WiFi radio",
      sourceFrequencyMhz: 2400,
      harmonicNumber: 1,
      expectedFrequencyMhz: 2400,
    };

    const output: AgentOutput = {
      hypotheses: [
        baseAgentOutput().hypotheses[0],
        {
          productFactId: "fact-invented",
          title: "Invented",
          confidenceBand: "low",
          reasoning: "References a fact never returned.",
          evidenceRefs: [],
          missingEvidence: [],
          nextInvestigation: "Check something.",
          previousHypothesisId: null,
          hypothesisUpdateStatus: null,
        },
      ],
      clarificationQuestion: null,
      investigationStatus: "hypotheses_ready",
    };

    const result = validateAgentOutput({
      agentOutput: output,
      registry: createEmptyRegistry(0),
      correlationCandidates: [candidate, secondCandidate],
      productFacts,
      measurement,
    });

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].productFactId).toBe("fact-clock-40mhz");
    expect(result.rejectedHypothesisCount).toBe(1);
  });

  it("returns no hypotheses for empty model output (no correlations to ground on)", () => {
    const result = validateAgentOutput({
      agentOutput: { hypotheses: [], clarificationQuestion: null, investigationStatus: "insufficient_evidence" },
      registry: createEmptyRegistry(0),
      correlationCandidates: [],
      productFacts: [],
      measurement,
    });

    expect(result.hypotheses).toEqual([]);
    expect(result.rejectedHypothesisCount).toBe(0);
  });
});

const zeroTimings = {
  stepCount: 0,
  totalDurationMs: 0,
  modelDurationMs: 0,
  toolDurationMs: 0,
  retrievalDurationMs: 0,
};

describe("buildAgentCompletedPayload", () => {
  it("reports truthful, actually-computed counts — never a placeholder", () => {
    const registry = registryWithPassage();
    const payload = buildAgentCompletedPayload(registry, [candidate], 1, 1, zeroTimings);

    expect(payload).toEqual({
      documentsAvailable: 5,
      documentSearches: 1,
      passagesRetrieved: 1,
      passagesUsedAsEvidence: 1,
      deterministicRelationshipsChecked: 1,
      nextInvestigationCount: 1,
      ...zeroTimings,
    });
  });

  it("reports zero counts truthfully when nothing was searched (no documents available case)", () => {
    const registry = createEmptyRegistry(0);
    const payload = buildAgentCompletedPayload(registry, [], 0, 0, zeroTimings);

    expect(payload).toEqual({
      documentsAvailable: 0,
      documentSearches: 0,
      passagesRetrieved: 0,
      passagesUsedAsEvidence: 0,
      deterministicRelationshipsChecked: 0,
      nextInvestigationCount: 0,
      ...zeroTimings,
    });
  });

  it("passes real timing instrumentation through untouched (PERF-01)", () => {
    const registry = createEmptyRegistry(0);
    const timings = {
      stepCount: 3,
      totalDurationMs: 4200,
      modelDurationMs: 4100,
      toolDurationMs: 100,
      retrievalDurationMs: 60,
    };
    const payload = buildAgentCompletedPayload(registry, [], 0, 0, timings);
    expect(payload).toMatchObject(timings);
  });
});
