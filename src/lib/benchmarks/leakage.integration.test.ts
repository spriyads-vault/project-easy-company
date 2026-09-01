// VALIDATION-01's load-bearing test: proves "Crado must never access
// hidden ground truth during the investigation" against the real
// Investigation Agent pipeline, not just by inspecting import graphs.
//
// A benchmark case's ground truth (root cause, diagnostic actions taken,
// the fix, the final measurement) is seeded with a unique marker string
// nothing else in the case touches. The real createAnalysisRunForFailureCase
// pipeline then runs against the case's underlying failure_case/measurement
// (exactly what the Investigation Agent workspace calls in production),
// using a MockLanguageModelV4 that records every call it receives
// (doGenerateCalls, from the AI SDK's own test harness — see
// node_modules/ai/src/test/mock-language-model-v4.ts). If the marker ever
// reached the model's prompt, or ever landed in a persisted analysis_events
// row, isolation would be broken. It should be structurally impossible: no
// file under src/lib/agents or src/lib/analysis imports
// src/lib/benchmarks/ground-truth.ts, the only module that queries
// benchmark_ground_truth at all.
//
// Run with `pnpm test:integration` (requires `supabase start`).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { Database } from "@/lib/supabase/database.types";
import { createAnalysisRunForFailureCase } from "@/lib/analysis/create-analysis-run";
import { createBenchmarkCase } from "./create-benchmark-case";

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
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

/** Gateway X-shaped case: product, revision, 40 MHz clock fact, a
 * radiated-emissions failure case, and a 200 MHz / +7.4 dB measurement
 * during "WiFi TX + display active" — the same fixture shape used
 * throughout src/lib/analysis's own integration tests. */
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
  await db.from("product_facts").insert({
    product_revision_id: revision!.id,
    category: "clock",
    fact: { label: "system clock", frequencyMhz: 40 },
  });
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

  return { failureCaseId: failureCase!.id, measurementId: measurement!.id };
}

describe("benchmark ground-truth leakage", () => {
  const admin = createClient<Database>(API_URL, SERVICE_ROLE_KEY);
  let userA: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    userA = await createConfirmedUser(admin, `benchmark-leakage-${Date.now()}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
  });

  it("never sends hidden ground truth to the model, and never persists it in analysis_events, during a real blind investigation run", async () => {
    const seed = await seedGatewayXCase(userA.client);
    const marker = `XYZZY-GROUND-TRUTH-MARKER-${Date.now()}`;

    const registration = await createBenchmarkCase(
      {
        failureCaseId: seed.failureCaseId,
        name: "Leakage test case",
        sourceDescription: "Synthetic case for VALIDATION-01's leakage test.",
      },
      {
        rootCause: `Cracked ground plane stitching via near the connector, marker: ${marker}`,
        diagnosticActionsTaken: `Probed with near-field probe and found the stitching gap, marker: ${marker}`,
        successfulEngineeringChange: `Added stitching vias every 5mm, marker: ${marker}`,
        finalFrequencyMhz: 200,
        finalMarginDb: -2.1,
        finalOutcomeNotes: `Passed on re-test, marker: ${marker}`,
      },
      userA.client,
    );
    if (!registration.ok) throw new Error(`expected ok registration, got: ${registration.message}`);

    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined, toolCalls: undefined },
    };
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
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
      }),
    });

    const result = await createAnalysisRunForFailureCase(
      { failureCaseId: seed.failureCaseId, measurementId: seed.measurementId },
      { generateHypotheses: async () => ({ hypotheses: [], clarificationQuestion: null }) },
      userA.client,
      { agentModel: model },
    );
    if (!result.ok) throw new Error(`expected ok result, got: ${result.message}`);

    const events = [];
    for await (const event of result.events) events.push(event);
    expect(events.some((e) => e.type === "run.completed")).toBe(true);

    // The prompt actually sent to the model, across every step this run
    // took — the marker must never appear anywhere in it.
    expect(model.doGenerateCalls.length).toBeGreaterThan(0);
    const promptText = JSON.stringify(model.doGenerateCalls);
    expect(promptText).not.toContain(marker);

    // What actually got persisted — the same guarantee, against the
    // database rather than the mock's in-memory record.
    const { data: persistedEvents } = await userA.client
      .from("analysis_events")
      .select("payload")
      .eq("analysis_run_id", result.runId);
    const persistedText = JSON.stringify(persistedEvents ?? []);
    expect(persistedText).not.toContain(marker);
  }, 20_000);
});
