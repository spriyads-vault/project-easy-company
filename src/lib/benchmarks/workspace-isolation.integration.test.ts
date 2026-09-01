// Integration test: RLS on the three VALIDATION-01 tables
// (benchmark_cases, benchmark_ground_truth, benchmark_expert_scores),
// mirroring src/lib/workspace/workspace-rls.integration.test.ts's own
// pattern — plus the create/score/reveal business-rule guards. Run with
// `pnpm test:integration` (requires `supabase start`).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createBenchmarkCase } from "./create-benchmark-case";
import { recordExpertScore } from "./record-expert-score";
import { revealGroundTruth } from "./reveal-ground-truth";

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

async function seedFailureCase(db: SupabaseClient<Database>) {
  const { data: product } = await db
    .from("products")
    .insert({ name: "Gateway X" })
    .select("id")
    .single();
  const { data: revision } = await db
    .from("product_revisions")
    .insert({ product_id: product!.id, label: "Rev1" })
    .select("id")
    .single();
  const { data: failureCase } = await db
    .from("failure_cases")
    .insert({ product_revision_id: revision!.id })
    .select("id")
    .single();
  return { failureCaseId: failureCase!.id };
}

async function seedBenchmarkCase(db: SupabaseClient<Database>) {
  const { failureCaseId } = await seedFailureCase(db);
  const result = await createBenchmarkCase(
    { failureCaseId, name: "Isolation test case", sourceDescription: "Synthetic." },
    {
      rootCause: "Cracked ground plane stitching.",
      diagnosticActionsTaken: "Near-field probing.",
      successfulEngineeringChange: "Added stitching vias.",
    },
    db,
  );
  if (!result.ok || !result.benchmarkCaseId) {
    throw new Error(`expected ok result, got: ${result.message}`);
  }
  return result.benchmarkCaseId;
}

describe("benchmark harness workspace isolation and business rules", () => {
  const admin = createClient<Database>(API_URL, SERVICE_ROLE_KEY);
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `benchmark-iso-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `benchmark-iso-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("does not let a user read another workspace's benchmark_cases row", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);

    const { data, error } = await userB.client
      .from("benchmark_cases")
      .select("id")
      .eq("id", benchmarkCaseId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let a user read another workspace's benchmark_ground_truth row, even by guessed benchmark_case_id", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);

    const { data, error } = await userB.client
      .from("benchmark_ground_truth")
      .select("root_cause")
      .eq("benchmark_case_id", benchmarkCaseId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let a user insert a benchmark_ground_truth row against another workspace's benchmark_case_id", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);

    const { error } = await userB.client.from("benchmark_ground_truth").insert({
      benchmark_case_id: benchmarkCaseId,
      root_cause: "hijacked",
      diagnostic_actions_taken: "hijacked",
      successful_engineering_change: "hijacked",
    });

    // The composite FK (benchmark_case_id, workspace_id) references A's
    // row under A's workspace_id; B's row would be tagged with B's
    // workspace_id by the insert trigger, so no matching parent row exists
    // — this must fail, not silently attach to A's case.
    expect(error).not.toBeNull();
  });

  it("does not let a user read another workspace's benchmark_expert_scores row", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);
    const { data: benchmarkCase } = await userA.client
      .from("benchmark_cases")
      .select("failure_case_id")
      .eq("id", benchmarkCaseId)
      .single();
    const { data: run } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: benchmarkCase!.failure_case_id, status: "completed" })
      .select("id")
      .single();
    await recordExpertScore(
      benchmarkCaseId,
      run!.id,
      {
        nextActionUseful: 4,
        hypothesesUseful: 3,
        misleading: false,
        wouldChangeNextAction: true,
      },
      userA.client,
    );

    const { data, error } = await userB.client
      .from("benchmark_expert_scores")
      .select("id")
      .eq("benchmark_case_id", benchmarkCaseId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses a second expert score for the same analysis run", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);
    const { data: benchmarkCase } = await userA.client
      .from("benchmark_cases")
      .select("failure_case_id")
      .eq("id", benchmarkCaseId)
      .single();
    const { data: run } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: benchmarkCase!.failure_case_id, status: "completed" })
      .select("id")
      .single();

    const scoreInput = {
      nextActionUseful: 5,
      hypothesesUseful: 5,
      misleading: false,
      wouldChangeNextAction: false,
    };
    const first = await recordExpertScore(benchmarkCaseId, run!.id, scoreInput, userA.client);
    expect(first.ok).toBe(true);

    const second = await recordExpertScore(benchmarkCaseId, run!.id, scoreInput, userA.client);
    expect(second).toEqual({ ok: false, message: "This run has already been scored." });
  });

  it("refuses to reveal ground truth before any run has been scored", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);

    const result = await revealGroundTruth(benchmarkCaseId, userA.client);

    expect(result).toEqual({
      ok: false,
      message: "Score at least one investigation run before revealing ground truth.",
    });
  });

  it("reveals ground truth once a run has been scored", async () => {
    const benchmarkCaseId = await seedBenchmarkCase(userA.client);
    const { data: benchmarkCase } = await userA.client
      .from("benchmark_cases")
      .select("failure_case_id")
      .eq("id", benchmarkCaseId)
      .single();
    const { data: run } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: benchmarkCase!.failure_case_id, status: "completed" })
      .select("id")
      .single();
    await recordExpertScore(
      benchmarkCaseId,
      run!.id,
      { nextActionUseful: 4, hypothesesUseful: 4, misleading: false, wouldChangeNextAction: false },
      userA.client,
    );

    const result = await revealGroundTruth(benchmarkCaseId, userA.client);

    expect(result.ok).toBe(true);
    expect(result.groundTruth?.rootCause).toBe("Cracked ground plane stitching.");

    const { data: updatedCase } = await userA.client
      .from("benchmark_cases")
      .select("status, revealed_at")
      .eq("id", benchmarkCaseId)
      .single();
    expect(updatedCase?.status).toBe("revealed");
    expect(updatedCase?.revealed_at).not.toBeNull();
  });
});
