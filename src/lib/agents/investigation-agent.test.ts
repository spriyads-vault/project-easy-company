// End-to-end test of the real ToolLoopAgent wiring (MVP-10B) against a fake
// LanguageModelV4 — no real Anthropic call. Scripts a multi-step tool loop
// (measurement context -> deterministic correlations -> one document
// search -> structured output) and proves the whole pipeline: tool
// execution, the observable agent.tool.completed activity, the retrieved
// registry, and independent citation/certainty validation all work
// together. The real live Anthropic run is a separate, manual test (see
// docs/PROGRESS.md) — this is the "fake model" coverage MVP-10B asks for.
import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { runInvestigationAgent, selectActiveTools } from "./investigation-agent";
import { createInvestigationTools, type InvestigationToolsContext } from "./tools";
import { agentOutputSchema } from "./schema";

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined, toolCalls: undefined },
};

function toolCallStep(toolCallId: string, toolName: string, input: unknown) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: USAGE,
    warnings: [],
  };
}

function textStep(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: USAGE,
    warnings: [],
  };
}

const DOCUMENT_CHUNK_ID = "chunk-real-1";
const DOCUMENT_ID = "doc-real-1";

function buildCaseContext(
  supabase: SupabaseClient<Database>,
): InvestigationToolsContext {
  return {
    supabase,
    product: { id: "product-1", name: "Gateway X" },
    revision: { id: "revision-1", label: "Rev17" },
    failureCase: { id: "case-1", title: "Radiated emissions", status: "open" },
    measurement: {
      id: "measurement-1",
      label: null,
      operatingMode: "WiFi TX + display active",
      peaks: [
        {
          id: "peak-1",
          frequencyMhz: 200,
          marginDb: 7.4,
          detector: null,
          limitLine: null,
        },
      ],
    },
    productFacts: [
      {
        id: "fact-clock-40mhz",
        category: "clock",
        label: "system clock",
        summary: "system clock — 40 MHz",
      },
    ],
    correlationCandidates: [
      {
        productFactId: "fact-clock-40mhz",
        productFactCategory: "clock",
        productFactLabel: "system clock",
        sourceFrequencyMhz: 40,
        harmonicNumber: 5,
        expectedFrequencyMhz: 200,
        measuredFrequencyMhz: 200,
        deviationMhz: 0,
        deviationRatio: 0,
        description:
          '200 MHz is consistent with the 5th harmonic of "system clock" (40 MHz x 5 = 200.000 MHz).',
      },
    ],
    // PERF-01: non-zero by default so every existing scripted tool call in
    // this file (getPreviousRevisions/getPreviousInvestigations/
    // getPreviousHypotheses aren't scripted here, but keeping these >0
    // means this fixture doesn't silently start omitting tools other tests
    // might later script calls to) stays offered. Tests that specifically
    // exercise omission set their own zeroed priorContext instead.
    priorContext: {
      previousRevisionCount: 1,
      previousInvestigationCount: 1,
      previousCompletedRunCount: 1,
    },
  };
}

/** A fake Supabase client whose only used method is
 * searchEngineeringDocuments' underlying `.rpc(...)` call — every other
 * tool's DB read is exercised by real local-Supabase integration tests, not
 * here; this test's job is the agent loop itself. */
function fakeSupabase(): SupabaseClient<Database> {
  return {
    rpc: async () => ({
      data: [
        {
          chunk_id: DOCUMENT_CHUNK_ID,
          document_id: DOCUMENT_ID,
          filename: "EMC-Test-04.md",
          document_type: "test_report",
          page_number: null,
          section: "Suspected Source",
          content:
            "The 40 MHz system clock is a strong candidate: 40 MHz times 5 equals 200 MHz exactly.",
          keyword_score: 0.8,
          semantic_score: 0.6,
          combined_score: 0.7,
        },
      ],
      error: null,
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("runInvestigationAgent (fake model, no real Anthropic call)", () => {
  it("executes a scripted tool loop, builds observable activity, and validates the structured output", async () => {
    const supabase = fakeSupabase();
    const caseContext = buildCaseContext(supabase);

    const validOutput = agentOutputSchema.parse({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "5th harmonic of the 40 MHz system clock",
          confidenceBand: "medium",
          reasoning:
            "The 200 MHz peak is consistent with the fifth harmonic of the 40 MHz clock, and the retrieved test note suggests the same relationship.",
          evidenceRefs: [
            { sourceType: "document_passage", chunkId: DOCUMENT_CHUNK_ID, documentId: DOCUMENT_ID },
            // A hallucinated chunk id — never returned by any tool call —
            // must be dropped without discarding the whole hypothesis.
            { sourceType: "document_passage", chunkId: "chunk-never-retrieved", documentId: "doc-x" },
          ],
          missingEvidence: ["Measurement with the display path disconnected."],
          nextInvestigation:
            "Disconnect the display path and repeat the measurement under the same operating mode.",
          previousHypothesisId: null,
          hypothesisUpdateStatus: null,
        },
      ],
      clarificationQuestion: null,
      investigationStatus: "hypotheses_ready",
    });

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        if (call === 1) return toolCallStep("call-1", "getMeasurementContext", {});
        if (call === 2) return toolCallStep("call-2", "getDeterministicCorrelations", {});
        if (call === 3) {
          return toolCallStep("call-3", "searchEngineeringDocuments", {
            query: "40 MHz clock display path",
          });
        }
        return textStep(JSON.stringify(validOutput));
      },
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      12,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    // Observable activity — one entry per tool call actually made, in order,
    // with safe display fields only.
    expect(result.activity.map((a) => a.toolName)).toEqual([
      "getMeasurementContext",
      "getDeterministicCorrelations",
      "searchEngineeringDocuments",
    ]);
    expect(result.activity[1].label).toBe("Checked deterministic relationships / 1 candidate found");
    expect(result.activity[2]).toMatchObject({
      label: "Searched engineering documents / 1 passage retrieved",
      query: "40 MHz clock display path",
    });
    expect(result.activity.every((a) => typeof a.durationMs === "number")).toBe(true);

    // The hypothesis survives (real candidate, no certainty language), the
    // hallucinated citation is silently dropped, and the real one is kept
    // as KNOWN evidence sourced from the stored passage text — never the
    // model's own restatement of it.
    expect(result.hypotheses).toHaveLength(1);
    const categories = result.hypotheses[0].evidence.map((e) => e.category);
    expect(categories).toEqual(["observed", "known", "known", "inferred", "missing"]);
    const documentEvidence = result.hypotheses[0].evidence.find((e) =>
      e.description.includes("EMC-Test-04.md"),
    );
    expect(documentEvidence?.description).toContain("40 MHz times 5 equals 200 MHz");
    expect(
      result.hypotheses[0].evidence.some((e) => e.description.includes("chunk-never-retrieved")),
    ).toBe(false);

    // Truthful, actually-computed metrics — never fabricated.
    expect(result.metrics).toMatchObject({
      documentsAvailable: 12,
      documentSearches: 1,
      passagesRetrieved: 1,
      passagesUsedAsEvidence: 1,
      deterministicRelationshipsChecked: 1,
      nextInvestigationCount: 1,
    });
    // PERF-01 timing instrumentation — real wall-clock numbers, so only
    // shape/non-negativity is asserted here, not exact values.
    expect(result.metrics.stepCount).toBe(4);
    expect(result.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.modelDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.toolDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.retrievalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("pluralizes the activity label correctly for more than one result (never \"passage retrieveds\")", async () => {
    const supabase = {
      rpc: async () => ({
        data: [
          { chunk_id: "c1", document_id: "d1", filename: "a.md", document_type: "test_report", page_number: null, section: null, content: "x", keyword_score: 0.5, semantic_score: 0.5, combined_score: 0.5 },
          { chunk_id: "c2", document_id: "d1", filename: "a.md", document_type: "test_report", page_number: null, section: null, content: "y", keyword_score: 0.5, semantic_score: 0.5, combined_score: 0.5 },
        ],
        error: null,
      }),
    } as unknown as SupabaseClient<Database>;
    const caseContext = buildCaseContext(supabase);
    const output = agentOutputSchema.parse({
      hypotheses: [],
      clarificationQuestion: null,
      investigationStatus: "insufficient_evidence",
    });

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        if (call === 1) {
          return toolCallStep("call-1", "searchEngineeringDocuments", { query: "clock" });
        }
        return textStep(JSON.stringify(output));
      },
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      // PERF-01: searchEngineeringDocuments is only offered at all when
      // documents are actually indexed — a non-zero count here is what
      // makes this specific tool-call scenario reachable to test.
      3,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    expect(result.activity[0].label).toBe("Searched engineering documents / 2 passages retrieved");
  });

  it("rejects a hypothesis whose productFactId was never a real correlation candidate", async () => {
    const supabase = fakeSupabase();
    const caseContext = buildCaseContext(supabase);

    const hallucinatedOutput = agentOutputSchema.parse({
      hypotheses: [
        {
          productFactId: "fact-that-does-not-exist",
          title: "Invented cause",
          confidenceBand: "low",
          reasoning: "This references a fact never returned by any tool.",
          evidenceRefs: [],
          missingEvidence: [],
          nextInvestigation: "Re-measure with the suspect component removed.",
          previousHypothesisId: null,
          hypothesisUpdateStatus: null,
        },
      ],
      clarificationQuestion: null,
      investigationStatus: "hypotheses_ready",
    });

    const model = new MockLanguageModelV4({
      doGenerate: async () => textStep(JSON.stringify(hallucinatedOutput)),
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      0,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    expect(result.hypotheses).toEqual([]);
  });

  it("rejects a hypothesis that uses certainty/root-cause language", async () => {
    const supabase = fakeSupabase();
    const caseContext = buildCaseContext(supabase);

    const overclaimingOutput = agentOutputSchema.parse({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "Root cause found",
          confidenceBand: "high",
          reasoning: "This is definitely the root cause of the failure.",
          evidenceRefs: [],
          missingEvidence: [],
          nextInvestigation: "Ship it.",
          previousHypothesisId: null,
          hypothesisUpdateStatus: null,
        },
      ],
      clarificationQuestion: null,
      investigationStatus: "hypotheses_ready",
    });

    const model = new MockLanguageModelV4({
      doGenerate: async () => textStep(JSON.stringify(overclaimingOutput)),
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      0,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    expect(result.hypotheses).toEqual([]);
  });

  it("handles a tool execution failure without crashing the run", async () => {
    const supabase = {
      rpc: async () => {
        throw new Error("connection reset");
      },
    } as unknown as SupabaseClient<Database>;
    const caseContext = buildCaseContext(supabase);

    const output = agentOutputSchema.parse({
      hypotheses: [],
      clarificationQuestion: null,
      investigationStatus: "insufficient_evidence",
    });

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        if (call === 1) {
          return toolCallStep("call-1", "searchEngineeringDocuments", { query: "clock" });
        }
        return textStep(JSON.stringify(output));
      },
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      // PERF-01: non-zero so searchEngineeringDocuments is still offered —
      // this test is specifically about a tool call that fails, not about
      // the zero-documents omission case.
      3,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    expect(result.activity).toHaveLength(1);
    expect(result.activity[0].label).toContain("unavailable");
    expect(result.hypotheses).toEqual([]);
    expect(result.metrics.documentSearches).toBe(0);
  });

  it("stays within the step limit rather than the SDK's 20-step default when the model only ever calls tools", async () => {
    const supabase = fakeSupabase();
    const caseContext = buildCaseContext(supabase);

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        // Never produces a final answer — proves the agent is bounded by
        // its own explicit stopWhen rather than looping indefinitely (or
        // to the SDK's default 20 steps).
        return toolCallStep(`call-${call}`, "getDeterministicCorrelations", {});
      },
    });

    await expect(
      runInvestigationAgent(
        { supabase, model, caseContext },
        0,
        { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
      ),
    ).rejects.toThrow();

    // Bounded well under the SDK's default 20-step allowance.
    expect(call).toBeLessThan(20);
    expect(call).toBeGreaterThan(0);
  });
});

describe("selectActiveTools (PERF-01: avoid reflexively offering tools with nothing to find)", () => {
  const tools = createInvestigationTools(buildCaseContext(fakeSupabase()));

  it("keeps the three always-on grounding tools regardless of history", () => {
    const active = selectActiveTools(
      tools,
      { previousRevisionCount: 0, previousInvestigationCount: 0, previousCompletedRunCount: 0 },
      0,
    );
    expect(active.getMeasurementContext).toBeDefined();
    expect(active.getDeterministicCorrelations).toBeDefined();
    expect(active.getProductContext).toBeDefined();
  });

  it("omits all four history/document tools when nothing exists to find (fresh first-run case)", () => {
    const active = selectActiveTools(
      tools,
      { previousRevisionCount: 0, previousInvestigationCount: 0, previousCompletedRunCount: 0 },
      0,
    );
    expect(active.getPreviousRevisions).toBeUndefined();
    expect(active.getPreviousInvestigations).toBeUndefined();
    expect(active.getPreviousHypotheses).toBeUndefined();
    expect(active.searchEngineeringDocuments).toBeUndefined();
    expect(Object.keys(active)).toHaveLength(3);
  });

  it("offers exactly the tools whose backing count is non-zero (mixed case)", () => {
    const active = selectActiveTools(
      tools,
      { previousRevisionCount: 2, previousInvestigationCount: 0, previousCompletedRunCount: 1 },
      5,
    );
    expect(active.getPreviousRevisions).toBeDefined();
    expect(active.getPreviousInvestigations).toBeUndefined();
    expect(active.getPreviousHypotheses).toBeDefined();
    expect(active.searchEngineeringDocuments).toBeDefined();
    expect(Object.keys(active)).toHaveLength(6);
  });

  it("offers every tool (all 7) when every kind of history and documents exist", () => {
    const active = selectActiveTools(
      tools,
      { previousRevisionCount: 1, previousInvestigationCount: 1, previousCompletedRunCount: 1 },
      1,
    );
    expect(Object.keys(active)).toHaveLength(7);
    expect(Object.values(active).every((tool) => tool !== undefined)).toBe(true);
  });
});

describe("runInvestigationAgent — zero-history behavior (PERF-01)", () => {
  it("never calls a history/document tool on a fresh case with no prior revisions, investigations, or documents, even fewer steps result", async () => {
    const supabase = fakeSupabase();
    const caseContext: InvestigationToolsContext = {
      ...buildCaseContext(supabase),
      priorContext: {
        previousRevisionCount: 0,
        previousInvestigationCount: 0,
        previousCompletedRunCount: 0,
      },
    };
    const output = agentOutputSchema.parse({
      hypotheses: [],
      clarificationQuestion: null,
      investigationStatus: "insufficient_evidence",
    });

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        if (call === 1) return toolCallStep("call-1", "getMeasurementContext", {});
        if (call === 2) return toolCallStep("call-2", "getDeterministicCorrelations", {});
        if (call === 3) return toolCallStep("call-3", "getProductContext", {});
        return textStep(JSON.stringify(output));
      },
    });

    const result = await runInvestigationAgent(
      { supabase, model, caseContext },
      0,
      { frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
    );

    expect(result.activity.map((a) => a.toolName)).toEqual([
      "getMeasurementContext",
      "getDeterministicCorrelations",
      "getProductContext",
    ]);
    expect(result.activity.some((a) => a.toolName === "getPreviousRevisions")).toBe(false);
    expect(result.activity.some((a) => a.toolName === "getPreviousInvestigations")).toBe(false);
    expect(result.activity.some((a) => a.toolName === "getPreviousHypotheses")).toBe(false);
    expect(result.activity.some((a) => a.toolName === "searchEngineeringDocuments")).toBe(false);
    expect(result.metrics.stepCount).toBe(4);
  });
});
