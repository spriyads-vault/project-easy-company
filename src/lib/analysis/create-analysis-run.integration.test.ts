// Integration test: proves the actual database-touching half of MVP-08
// against real Postgres/RLS (local Supabase, `supabase start`), with a fake
// HypothesisModelAdapter standing in for the model — no ANTHROPIC_API_KEY
// needed. This is what src/app/api/analysis-runs/route.ts calls; testing it
// directly here covers "the full route/stream lifecycle" without fighting
// Next.js's request-cookie machinery (see route.test.ts for the thin HTTP
// wrapper's own tests). Run with `pnpm test:integration`.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { Database } from "@/lib/supabase/database.types";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import type { HypothesisGenerationOutput } from "@/lib/hypotheses/schema";
import { createAnalysisRunForFailureCase } from "./create-analysis-run";
import type { AnalysisEvent } from "./events";

const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function createConfirmedUser(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<{ id: string; client: SupabaseClient<Database> }> {
  const password = "correct-horse-battery-staple";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user returned");

  const client = createClient<Database>(API_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

function fakeAdapter(
  response: HypothesisGenerationOutput,
): HypothesisModelAdapter {
  return { generateHypotheses: async () => response };
}

async function collect(
  events: AsyncGenerator<AnalysisEvent, void, void>,
): Promise<AnalysisEvent[]> {
  const collected: AnalysisEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

/** Builds a full Gateway X-shaped case for the signed-in client: product,
 * revision, 40 MHz clock fact, a radiated-emissions failure case, and a
 * 200 MHz / +7.4 dB measurement during "WiFi TX + display active". */
async function seedGatewayXCase(db: SupabaseClient<Database>) {
  const { data: product } = await db
    .from("products")
    .insert({ name: "Gateway X" })
    .select("id")
    .single();
  const { data: revision } = await db
    .from("product_revisions")
    .insert({ product_id: product!.id, label: "Rev17" })
    .select("id")
    .single();
  const { data: fact } = await db
    .from("product_facts")
    .insert({
      product_revision_id: revision!.id,
      category: "clock",
      fact: { label: "system clock", frequencyMhz: 40 },
    })
    .select("id")
    .single();
  const { data: failureCase } = await db
    .from("failure_cases")
    .insert({ product_revision_id: revision!.id })
    .select("id")
    .single();
  const { data: measurement } = await db
    .from("measurements")
    .insert({
      failure_case_id: failureCase!.id,
      product_revision_id: revision!.id,
      operating_mode: "WiFi TX + display active",
    })
    .select("id")
    .single();
  await db.from("measurement_peaks").insert({
    measurement_id: measurement!.id,
    frequency_mhz: 200,
    margin_db: 7.4,
  });

  return {
    productId: product!.id,
    revisionId: revision!.id,
    factId: fact!.id,
    failureCaseId: failureCase!.id,
    measurementId: measurement!.id,
  };
}

describe("createAnalysisRunForFailureCase", () => {
  const admin = createClient<Database>(API_URL, SERVICE_ROLE_KEY);
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `analysis-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `analysis-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("runs the full Gateway X flow: 200 MHz -> measurement.loaded -> 40 MHz x 5 correlation.found -> hypothesis.created -> run.completed, and persists every event", async () => {
    const seed = await seedGatewayXCase(userA.client);
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: seed.factId,
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

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      adapter,
      userA.client,
    );
    if (!result.ok) throw new Error(`expected ok result, got: ${result.message}`);

    const events = await collect(result.events);

    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "hypothesis.created",
      "run.completed",
    ]);

    const correlation = events[2];
    if (correlation.type !== "correlation.found") throw new Error("expected correlation.found");
    expect(correlation.payload).toMatchObject({
      productFactId: seed.factId,
      productFactCategory: "clock",
      sourceFrequencyMhz: 40,
      harmonicNumber: 5,
    });
    expect(correlation.payload.expectedFrequencyMhz).toBeCloseTo(200);

    const hypothesis = events[3];
    if (hypothesis.type !== "hypothesis.created") throw new Error("expected hypothesis.created");
    expect(hypothesis.payload.productFactId).toBe(seed.factId);
    expect(hypothesis.payload.evidence.map((e) => e.category)).toEqual([
      "observed",
      "known",
      "inferred",
      "missing",
    ]);
    expect(hypothesis.payload.evidence[0].description).toContain("200");

    // Persistence: every streamed event actually landed in analysis_events,
    // and the run itself is marked completed.
    const { data: persistedEvents } = await userA.client
      .from("analysis_events")
      .select("event_type, sequence")
      .eq("analysis_run_id", result.runId)
      .order("sequence", { ascending: true });
    expect(persistedEvents?.map((e) => e.event_type)).toEqual(
      events.map((e) => e.type),
    );

    const { data: run } = await userA.client
      .from("analysis_runs")
      .select("status")
      .eq("id", result.runId)
      .single();
    expect(run?.status).toBe("completed");
  });

  it("FIX-03: retries exactly once when the model returns nothing at all, and persists a real hypothesis.retried row (not just an in-process event)", async () => {
    // Proven wrong live on the hosted deployment before this test existed:
    // a real run's tool trace doubled (10 checks instead of 5 — two full
    // attemptHypothesisGeneration() passes) but analysis_events had zero
    // hypothesis.retried rows anywhere in the database. The gap was in
    // persistAndYield's insert, which discarded its own error result — the
    // event streamed to the client and was gone the moment anyone
    // refreshed. A fake adapter reproduces the trigger condition
    // deterministically; only real Postgres proves the persistence half
    // that fake actually caught the bug.
    const seed = await seedGatewayXCase(userA.client);

    let call = 0;
    const retryingAdapter: HypothesisModelAdapter = {
      generateHypotheses: async () => {
        call += 1;
        if (call === 1) {
          // The exact miss run-analysis.ts retries on: no hypothesis, no
          // clarification question, despite a real correlation candidate.
          return { hypotheses: [], clarificationQuestion: null };
        }
        return {
          hypotheses: [
            {
              productFactId: seed.factId,
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
        };
      },
    };

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      retryingAdapter,
      userA.client,
    );
    if (!result.ok) throw new Error(`expected ok result, got: ${result.message}`);

    const events = await collect(result.events);

    expect(call).toBe(2);
    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "measurement.loaded",
      "correlation.found",
      "hypothesis.retried",
      "hypothesis.created",
      "run.completed",
    ]);

    const retried = events.find((e) => e.type === "hypothesis.retried");
    if (!retried || retried.type !== "hypothesis.retried") {
      throw new Error("expected hypothesis.retried");
    }
    expect(retried.payload.correlationCount).toBe(1);

    // Direct Postgres check, not just trust in the in-process stream — this
    // is the exact query that returned zero rows for real on the hosted
    // deployment, against the same event type, before the fix.
    const { data: persistedEvents } = await userA.client
      .from("analysis_events")
      .select("event_type, sequence")
      .eq("analysis_run_id", result.runId)
      .order("sequence", { ascending: true });
    expect(persistedEvents?.map((e) => e.event_type)).toEqual(events.map((e) => e.type));
    expect(persistedEvents?.some((e) => e.event_type === "hypothesis.retried")).toBe(true);
  });

  it("persists a run.failed event and marks the run failed when the adapter throws", async () => {
    const seed = await seedGatewayXCase(userA.client);
    const throwingAdapter: HypothesisModelAdapter = {
      generateHypotheses: async () => {
        throw new Error("simulated provider failure");
      },
    };

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      throwingAdapter,
      userA.client,
    );
    if (!result.ok) throw new Error(`expected ok result, got: ${result.message}`);

    const events = await collect(result.events);
    expect(events.at(-1)?.type).toBe("run.failed");

    const { data: run } = await userA.client
      .from("analysis_runs")
      .select("status")
      .eq("id", result.runId)
      .single();
    expect(run?.status).toBe("failed");
  });

  it("returns 404 rather than another workspace's data for a cross-workspace failureCaseId", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userB.client, // signed in as B, referencing A's case
    );

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Failure case not found.",
    });
  });

  it("returns 404 for a measurementId that doesn't belong to the given failureCaseId", async () => {
    const seed = await seedGatewayXCase(userA.client);
    const { data: otherCase } = await userA.client
      .from("failure_cases")
      .insert({ product_revision_id: seed.revisionId })
      .select("id")
      .single();

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: otherCase!.id, measurementId: seed.measurementId },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userA.client,
    );

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Measurement not found for this failure case.",
    });
  });

  it("returns 400 for a measurement with no recorded peak (boundary)", async () => {
    const seed = await seedGatewayXCase(userA.client);
    const { data: bareMeasurement } = await userA.client
      .from("measurements")
      .insert({
        failure_case_id: seed.failureCaseId,
        product_revision_id: seed.revisionId,
        operating_mode: "idle",
      })
      .select("id")
      .single();

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: bareMeasurement!.id },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userA.client,
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "This measurement has no recorded peak to analyze.",
    });
  });

  it("MVP-11: analyzes a measurement using its own revision's product facts, not the failure case's original revision (RE-EVALUATE after an engineering change)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    // REV17 -> REV18, same shape createEngineeringChange produces, but with
    // *no* facts carried onto REV18 (deliberately not copied here — unlike
    // createEngineeringChange's own real copy-forward — so the presence or
    // absence of a correlation unambiguously proves which revision's facts
    // were actually loaded). REV17 keeps its 40 MHz clock fact, which is
    // exactly what the 200 MHz/5th-harmonic correlation depends on. If this
    // measurement were still analyzed against REV17's facts, the
    // correlation would incorrectly fire even though REV18 has none.
    const { data: revision18 } = await userA.client
      .from("product_revisions")
      .insert({ product_id: seed.productId, label: "Rev18", supersedes_revision_id: seed.revisionId })
      .select("id")
      .single();
    const { data: measurement18 } = await userA.client
      .from("measurements")
      .insert({
        failure_case_id: seed.failureCaseId,
        product_revision_id: revision18!.id,
        operating_mode: "WiFi TX only",
      })
      .select("id")
      .single();
    await userA.client.from("measurement_peaks").insert({
      measurement_id: measurement18!.id,
      frequency_mhz: 200,
      margin_db: -3.6,
    });

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: measurement18!.id },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userA.client,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events = await collect(result.events);

    // The 40 MHz fact (REV17-only) would produce a 5th-harmonic
    // correlation.found at 200 MHz — its absence proves REV18's own facts
    // were used, not REV17's.
    expect(events.some((e) => e.type === "correlation.found")).toBe(false);
  });

  it("PERF-01: computes real prior-context counts against Postgres and omits history tools accordingly on a fresh case", async () => {
    const seed = await seedGatewayXCase(userA.client);

    // A model that immediately tries a history tool this fresh case has
    // nothing to offer — getPreviousRevisions/getPreviousInvestigations/
    // getPreviousHypotheses/searchEngineeringDocuments should all be
    // omitted (previousRevisionCount, previousInvestigationCount,
    // previousCompletedRunCount, and documentsAvailable are all genuinely
    // 0 for this brand-new case), so the model goes straight to the
    // always-on grounding tools instead.
    let call = 0;
    const validOutput = {
      hypotheses: [],
      clarificationQuestion: null,
      investigationStatus: "insufficient_evidence" as const,
    };
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        const usage = {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined, toolCalls: undefined },
        };
        if (call === 1) {
          return {
            content: [
              { type: "tool-call" as const, toolCallId: "c1", toolName: "getMeasurementContext", input: "{}" },
            ],
            finishReason: { unified: "tool-calls" as const, raw: undefined },
            usage,
            warnings: [],
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(validOutput) }],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage,
          warnings: [],
        };
      },
    });

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userA.client,
      { agentModel: model },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events = await collect(result.events);

    const toolActivity = events.filter((e) => e.type === "agent.tool.completed");
    expect(toolActivity.map((e) => e.payload.toolName)).toEqual(["getMeasurementContext"]);

    const completed = events.find((e) => e.type === "agent.completed");
    expect(completed?.payload).toMatchObject({ documentsAvailable: 0, documentSearches: 0 });
    if (completed?.type === "agent.completed") {
      expect(completed.payload.stepCount).toBe(2);
      expect(completed.payload.totalDurationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("UX-05: persists a real agent.tool.started row, in Postgres, strictly before its matching agent.tool.completed row for a real tool invocation", async () => {
    const seed = await seedGatewayXCase(userA.client);

    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        call += 1;
        const usage = {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined, toolCalls: undefined },
        };
        if (call === 1) {
          return {
            content: [
              { type: "tool-call" as const, toolCallId: "c1", toolName: "getMeasurementContext", input: "{}" },
            ],
            finishReason: { unified: "tool-calls" as const, raw: undefined },
            usage,
            warnings: [],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                hypotheses: [],
                clarificationQuestion: null,
                investigationStatus: "insufficient_evidence" as const,
              }),
            },
          ],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage,
          warnings: [],
        };
      },
    });

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      fakeAdapter({ hypotheses: [], clarificationQuestion: null }),
      userA.client,
      { agentModel: model },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events = await collect(result.events);

    const started = events.find((e) => e.type === "agent.tool.started");
    const completed = events.find((e) => e.type === "agent.tool.completed");
    if (!started || started.type !== "agent.tool.started") throw new Error("expected a real agent.tool.started event");
    if (!completed || completed.type !== "agent.tool.completed") throw new Error("expected a real agent.tool.completed event");
    expect(started.payload.toolName).toBe("getMeasurementContext");
    expect(completed.payload.toolCallId).toBe(started.payload.toolCallId);

    // Direct Postgres check, not just trust in the in-process stream order:
    // both rows are genuinely persisted, and the started row's own sequence
    // number is strictly lower than the completed row's.
    const { data: rows } = await userA.client
      .from("analysis_events")
      .select("event_type, sequence")
      .eq("analysis_run_id", result.runId)
      .in("event_type", ["agent.tool.started", "agent.tool.completed"])
      .order("sequence", { ascending: true });

    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({ event_type: "agent.tool.started" });
    expect(rows?.[1]).toMatchObject({ event_type: "agent.tool.completed" });
    expect(rows![0].sequence).toBeLessThan(rows![1].sequence);
  });
});
