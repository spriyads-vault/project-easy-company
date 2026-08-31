// Integration test: proves the full domain chain (Product -> ProductRevision
// -> FailureCase -> Measurement -> AnalysisRun -> AnalysisEvent ->
// DiagnosticHypothesis -> EvidenceItem, plus InvestigationEvent and
// EngineeringChange) persists against real Postgres, and that workspace
// isolation (RLS + composite FKs) holds for a child table, not just
// `workspaces` itself. Requires `supabase start`; run with
// `pnpm test:integration`.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

interface TestUser {
  id: string;
  client: SupabaseClient<Database>;
}

async function createConfirmedUser(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<TestUser> {
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

describe("core domain schema", () => {
  const admin = createClient<Database>(API_URL, SERVICE_ROLE_KEY);
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `domain-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `domain-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("persists the full investigation chain for one user", async () => {
    const db = userA.client;

    const { data: product, error: productError } = await db
      .from("products")
      .insert({ name: "Gateway X" })
      .select()
      .single();
    expect(productError).toBeNull();
    expect(product?.name).toBe("Gateway X");

    const { data: revision, error: revisionError } = await db
      .from("product_revisions")
      .insert({ product_id: product!.id, label: "Rev17" })
      .select()
      .single();
    expect(revisionError).toBeNull();
    expect(revision?.label).toBe("Rev17");

    const { data: fact, error: factError } = await db
      .from("product_facts")
      .insert({
        product_revision_id: revision!.id,
        category: "clock",
        fact: { frequency_mhz: 40, label: "system clock" },
      })
      .select()
      .single();
    expect(factError).toBeNull();
    expect(fact?.category).toBe("clock");

    const { data: failureCase, error: failureCaseError } = await db
      .from("failure_cases")
      .insert({ product_revision_id: revision!.id })
      .select()
      .single();
    expect(failureCaseError).toBeNull();
    expect(failureCase?.test_type).toBe("radiated_emissions");

    const { data: measurement, error: measurementError } = await db
      .from("measurements")
      .insert({
        failure_case_id: failureCase!.id,
        product_revision_id: revision!.id,
        operating_mode: "WiFi TX + display active",
      })
      .select()
      .single();
    expect(measurementError).toBeNull();

    const { data: peak, error: peakError } = await db
      .from("measurement_peaks")
      .insert({
        measurement_id: measurement!.id,
        frequency_mhz: 200,
        margin_db: 7.4,
      })
      .select()
      .single();
    expect(peakError).toBeNull();
    expect(Number(peak?.margin_db)).toBeCloseTo(7.4);

    const { data: run, error: runError } = await db
      .from("analysis_runs")
      .insert({
        failure_case_id: failureCase!.id,
        measurement_id: measurement!.id,
      })
      .select()
      .single();
    expect(runError).toBeNull();

    const { data: event, error: eventError } = await db
      .from("analysis_events")
      .insert({
        analysis_run_id: run!.id,
        sequence: 1,
        event_type: "run.started",
        payload: {},
      })
      .select()
      .single();
    expect(eventError).toBeNull();
    expect(event?.event_type).toBe("run.started");

    const { data: hypothesis, error: hypothesisError } = await db
      .from("diagnostic_hypotheses")
      .insert({
        analysis_run_id: run!.id,
        failure_case_id: failureCase!.id,
        title: "40 MHz clock 5th harmonic at 200 MHz",
        confidence_band: "medium",
      })
      .select()
      .single();
    expect(hypothesisError).toBeNull();

    const { error: evidenceError } = await db.from("evidence_items").insert({
      hypothesis_id: hypothesis!.id,
      category: "known",
      description: "Product context lists a 40 MHz system clock.",
    });
    expect(evidenceError).toBeNull();

    const { error: investigationEventError } = await db
      .from("investigation_events")
      .insert({
        failure_case_id: failureCase!.id,
        event_type: "case_opened",
        description: "Radiated emissions case opened.",
        created_by: userA.id,
      });
    expect(investigationEventError).toBeNull();

    const { data: revision18, error: revision18Error } = await db
      .from("product_revisions")
      .insert({ product_id: product!.id, label: "Rev18" })
      .select()
      .single();
    expect(revision18Error).toBeNull();

    const { error: changeError } = await db.from("engineering_changes").insert({
      failure_case_id: failureCase!.id,
      from_product_revision_id: revision!.id,
      to_product_revision_id: revision18!.id,
      description: "Display termination Rev17 -> Rev18",
    });
    expect(changeError).toBeNull();
  });

  it("does not let a user read another user's product", async () => {
    const { data: productB } = await userB.client
      .from("products")
      .insert({ name: "User B's product" })
      .select()
      .single();
    expect(productB).toBeTruthy();

    const { data, error } = await userA.client
      .from("products")
      .select("id")
      .eq("id", productB!.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects a child row that targets another workspace's parent", async () => {
    const { data: productB } = await admin
      .from("products")
      .select("id")
      .eq("name", "User B's product")
      .single();
    expect(productB).toBeTruthy();

    // A tries to create a revision under B's product. workspace_id is forced
    // to A's own workspace by trigger, which then violates the composite FK
    // (product_id, workspace_id) -> products(id, workspace_id) because that
    // product belongs to B's workspace, not A's.
    const { error } = await userA.client
      .from("product_revisions")
      .insert({ product_id: productB!.id, label: "hijack attempt" });

    expect(error).not.toBeNull();
  });
});
