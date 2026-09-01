// Integration tests for MVP-11's physical-investigation feedback loop
// against real Postgres/RLS (local Supabase, `supabase start`). Covers the
// parts of the ticket's test list that need a real database rather than a
// hand-built fixture: recording an observation, workspace isolation, the
// Investigation Agent's tools actually seeing new evidence/prior
// hypotheses, and the timeline proving old hypotheses stay historical
// (never rewritten) even after a run fails. Run with
// `pnpm test:integration`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  createAdminClient,
  createConfirmedUser,
} from "@/lib/documents/integration-test-helpers";
import { insertInvestigationObservation } from "./record-observation";
import { getInvestigationTimeline } from "./timeline";
import { createInvestigationTools, type InvestigationToolsContext } from "@/lib/agents/tools";

async function seedGatewayXCase(db: SupabaseClient<Database>) {
  const { data: product } = await db.from("products").insert({ name: "Gateway X" }).select("id").single();
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
    .insert({ product_revision_id: revision!.id, title: "Radiated emissions — Gateway X Rev17" })
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

async function insertHypothesisEvent(
  db: SupabaseClient<Database>,
  runId: string,
  sequence: number,
  overrides: {
    title: string;
    factId: string;
    update?: { status: string; previousHypothesisTitle: string };
  },
) {
  await db.from("analysis_events").insert({
    analysis_run_id: runId,
    sequence,
    event_type: "hypothesis.created",
    payload: {
      productFactId: overrides.factId,
      title: overrides.title,
      confidenceBand: "medium",
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [{ category: "observed", description: "Measured 200 MHz." }],
      ...(overrides.update ? { update: overrides.update } : {}),
    },
  });
}

function minimalToolsContext(
  supabase: SupabaseClient<Database>,
  seed: Awaited<ReturnType<typeof seedGatewayXCase>>,
): InvestigationToolsContext {
  return {
    supabase,
    product: { id: seed.productId, name: "Gateway X" },
    revision: { id: seed.revisionId, label: "Rev17" },
    failureCase: { id: seed.failureCaseId, title: "Radiated emissions", status: "open" },
    measurement: {
      id: seed.measurementId,
      label: null,
      operatingMode: "WiFi TX + display active",
      peaks: [{ id: "peak-1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
    },
    productFacts: [{ id: seed.factId, category: "clock", label: "system clock", summary: "40 MHz system clock" }],
    correlationCandidates: [],
  };
}

describe("MVP-11: the physical investigation feedback loop", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `mvp11-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `mvp11-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("records an engineer observation with the exact structured fields entered (record + persistence)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await insertInvestigationObservation(userA.client, userA.id, seed.failureCaseId, {
      observation: "Display path disconnected.",
      measurementChange: "200 MHz peak dropped 9 dB.",
      operatingMode: "WiFi TX only",
      notes: "Display ribbon cable fully removed, not just powered off.",
    });
    expect(result.ok).toBe(true);

    const { data: rows } = await userA.client
      .from("investigation_events")
      .select("event_type, description, payload")
      .eq("failure_case_id", seed.failureCaseId)
      .eq("event_type", "observation");

    expect(rows).toHaveLength(1);
    expect(rows![0].description).toBe("Display path disconnected. 200 MHz peak dropped 9 dB.");
    expect(rows![0].payload).toEqual({
      observation: "Display path disconnected.",
      measurementChange: "200 MHz peak dropped 9 dB.",
      operatingMode: "WiFi TX only",
      notes: "Display ribbon cable fully removed, not just powered off.",
    });
  });

  it("scopes observations by workspace — another user can neither record into nor read someone else's case (workspace isolation)", async () => {
    const seed = await seedGatewayXCase(userA.client);
    await insertInvestigationObservation(userA.client, userA.id, seed.failureCaseId, {
      observation: "Display path disconnected.",
    });

    // Cross-workspace insert: rejected, not silently written elsewhere.
    const crossInsert = await insertInvestigationObservation(userB.client, userB.id, seed.failureCaseId, {
      observation: "Attempted cross-workspace write.",
    });
    expect(crossInsert.ok).toBe(false);

    // Cross-workspace read: RLS makes it look like the case doesn't exist,
    // never an error and never someone else's data.
    const timelineAsB = await getInvestigationTimeline(userB.client, seed.failureCaseId);
    expect(timelineAsB).toEqual([]);

    const timelineAsA = await getInvestigationTimeline(userA.client, seed.failureCaseId);
    expect(timelineAsA.some((entry) => entry.type === "observation")).toBe(true);
  });

  it("the Investigation Agent's getPreviousInvestigations tool sees a newly recorded observation (agent receives previous investigation)", async () => {
    const seed = await seedGatewayXCase(userA.client);
    await insertInvestigationObservation(userA.client, userA.id, seed.failureCaseId, {
      observation: "Display path disconnected.",
      measurementChange: "Peak dropped 9 dB.",
    });

    const tools = createInvestigationTools(minimalToolsContext(userA.client, seed));
    // The tool's `execute` signature takes a second (unused-by-us) options
    // arg the ToolLoopAgent normally supplies — irrelevant here since none
    // of these tools read it, so `{} as never` stands in for it.
    const result = (await tools.getPreviousInvestigations.execute?.({}, {} as never)) as {
      events: { eventType: string; description: string }[];
    };

    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("observation");
    expect(result.events[0].description).toBe("Display path disconnected. Peak dropped 9 dB.");
  });

  it("getPreviousHypotheses returns a prior completed run's hypothesis and excludes the run currently in flight", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const { data: completedRun } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "completed" })
      .select("id")
      .single();
    await insertHypothesisEvent(userA.client, completedRun!.id, 0, {
      title: "5th harmonic of the system clock via the display path",
      factId: seed.factId,
    });

    const { data: runningRun } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "running" })
      .select("id")
      .single();
    await insertHypothesisEvent(userA.client, runningRun!.id, 0, {
      title: "Should never be visible — its own run is still in flight",
      factId: seed.factId,
    });

    const tools = createInvestigationTools(minimalToolsContext(userA.client, seed));
    const result = (await tools.getPreviousHypotheses.execute?.({}, {} as never)) as {
      hypotheses: { id: string; title: string }[];
    };

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].id).toBe(`${completedRun!.id}:0`);
    expect(result.hypotheses[0].title).toBe("5th harmonic of the system clock via the display path");
  });

  it("keeps the original hypothesis fully historical — the timeline shows both it and the updated hypothesis after a follow-up run, in order (old hypothesis remains historical)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const { data: run1 } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "completed" })
      .select("id")
      .single();
    await insertHypothesisEvent(userA.client, run1!.id, 0, {
      title: "5th harmonic of the system clock, coupling via the display path",
      factId: seed.factId,
    });

    await insertInvestigationObservation(userA.client, userA.id, seed.failureCaseId, {
      observation: "Display path disconnected.",
      measurementChange: "Peak dropped 9 dB.",
    });

    const { data: run2 } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "completed" })
      .select("id")
      .single();
    await insertHypothesisEvent(userA.client, run2!.id, 0, {
      title: "5th harmonic of the system clock, coupling via the display path",
      factId: seed.factId,
      update: { status: "supported_by_new_evidence", previousHypothesisTitle: "5th harmonic of the system clock, coupling via the display path" },
    });

    const timeline = await getInvestigationTimeline(userA.client, seed.failureCaseId);
    const types = timeline.map((entry) => entry.type);
    expect(types).toEqual(["measurement", "hypothesis", "observation", "hypothesis"]);

    const [, originalHypothesis, , updatedHypothesis] = timeline;
    expect(originalHypothesis.type).toBe("hypothesis");
    if (originalHypothesis.type === "hypothesis") {
      // Never rewritten — the original entry still carries no update.
      expect(originalHypothesis.update).toBeNull();
    }
    expect(updatedHypothesis.type).toBe("hypothesis");
    if (updatedHypothesis.type === "hypothesis") {
      expect(updatedHypothesis.update).toEqual({
        status: "supported_by_new_evidence",
        previousHypothesisTitle: "5th harmonic of the system clock, coupling via the display path",
      });
    }
  });

  it("a failed follow-up run never corrupts or removes previously recorded history (failed agent update)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const { data: run1 } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "completed" })
      .select("id")
      .single();
    await insertHypothesisEvent(userA.client, run1!.id, 0, {
      title: "5th harmonic of the system clock",
      factId: seed.factId,
    });
    await insertInvestigationObservation(userA.client, userA.id, seed.failureCaseId, {
      observation: "Display path disconnected.",
    });

    const { data: run2 } = await userA.client
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, status: "failed" })
      .select("id")
      .single();
    await userA.client.from("analysis_events").insert({
      analysis_run_id: run2!.id,
      sequence: 0,
      event_type: "run.failed",
      payload: { message: "Analysis failed unexpectedly. Please try again or contact support." },
    });

    const timeline = await getInvestigationTimeline(userA.client, seed.failureCaseId);
    // The failed run produced no hypothesis.created event, so it adds
    // nothing — but crucially removes nothing either.
    expect(timeline.map((entry) => entry.type)).toEqual(["measurement", "hypothesis", "observation"]);
    const hypothesisEntry = timeline.find((entry) => entry.type === "hypothesis");
    expect(hypothesisEntry).toMatchObject({ title: "5th harmonic of the system clock" });
  });
});
