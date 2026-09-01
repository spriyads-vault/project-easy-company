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
import { createEngineeringChange } from "@/lib/engineering-changes/create-engineering-change";
import { compareMeasurements } from "@/lib/measurements/compare-measurements";

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

describe("MVP-11 continued: ENGINEERING CHANGE + SECOND MEASUREMENT + REVISION COMPARISON", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `mvp11-loop-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `mvp11-loop-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  /** Runs the full loop the ticket describes: REV17 measurement + hypothesis
   * + observation -> engineering change -> REV18 -> REV18 measurement. */
  async function runGatewayXLoop(db: SupabaseClient<Database>, userId: string) {
    const seed = await seedGatewayXCase(db);

    const { data: run1 } = await db
      .from("analysis_runs")
      .insert({ failure_case_id: seed.failureCaseId, measurement_id: seed.measurementId, status: "completed" })
      .select("id")
      .single();
    await insertHypothesisEvent(db, run1!.id, 0, {
      title: "5th harmonic of the system clock, coupling via the display path",
      factId: seed.factId,
    });

    await insertInvestigationObservation(db, userId, seed.failureCaseId, {
      observation: "Display path disconnected.",
      measurementChange: "200 MHz peak dropped 9 dB.",
    });

    const changeResult = await createEngineeringChange(
      db,
      { failureCaseId: seed.failureCaseId, productId: seed.productId, fromRevisionId: seed.revisionId },
      {
        title: "Display termination changed",
        description: "Terminated the display data line to reduce coupling.",
        affectedSubsystem: "Display path",
        reason: "Follow-up to investigation where disconnecting the display path reduced the 200 MHz peak by 9 dB.",
        newRevisionLabel: "Rev18",
      },
    );
    if (!changeResult.ok) throw new Error(changeResult.message);

    const { data: measurement2 } = await db
      .from("measurements")
      .insert({
        failure_case_id: seed.failureCaseId,
        product_revision_id: changeResult.newRevisionId,
        operating_mode: "WiFi TX + display active",
      })
      .select("id")
      .single();
    await db.from("measurement_peaks").insert({
      measurement_id: measurement2!.id,
      frequency_mhz: 200,
      margin_db: -3.6,
    });

    return { ...seed, run1Id: run1!.id, revision18Id: changeResult.newRevisionId, measurement2Id: measurement2!.id };
  }

  it("the timeline shows the full extended chain in order: measurement -> hypothesis -> observation -> engineering change -> new revision -> measurement -> result (investigation timeline)", async () => {
    const loop = await runGatewayXLoop(userA.client, userA.id);

    const timeline = await getInvestigationTimeline(userA.client, loop.failureCaseId);
    expect(timeline.map((entry) => entry.type)).toEqual([
      "measurement",
      "hypothesis",
      "observation",
      "engineering_change",
      "new_revision",
      "measurement",
      "result",
    ]);

    const resultEntry = timeline.find((entry) => entry.type === "result");
    expect(resultEntry?.type).toBe("result");
    if (resultEntry?.type === "result") {
      // The exact Gateway X numbers from the ticket: +7.4 dB -> -3.6 dB is
      // an 11 dB improvement, computed deterministically — never by the LLM.
      expect(resultEntry.comparison).toEqual(
        compareMeasurements(
          { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
          { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -3.6 },
        ),
      );
      expect(resultEntry.comparison.deltaDb).toBe(11);
      expect(resultEntry.comparison.improved).toBe(true);
    }
  });

  it("keeps REV17's original evidence exactly where it was and never silently moves it to REV18 (evidence ownership)", async () => {
    const loop = await runGatewayXLoop(userA.client, userA.id);

    const { data: originalMeasurement } = await userA.client
      .from("measurements")
      .select("product_revision_id")
      .eq("id", loop.measurementId)
      .single();
    expect(originalMeasurement!.product_revision_id).toBe(loop.revisionId);

    const { data: originalRun } = await userA.client
      .from("analysis_runs")
      .select("measurement_id")
      .eq("id", loop.run1Id)
      .single();
    expect(originalRun!.measurement_id).toBe(loop.measurementId);

    const { data: newMeasurement } = await userA.client
      .from("measurements")
      .select("product_revision_id")
      .eq("id", loop.measurement2Id)
      .single();
    expect(newMeasurement!.product_revision_id).toBe(loop.revision18Id);

    // The original revision itself was never rewritten to point forward to
    // a fabricated "current" state — REV17 stays exactly REV17.
    const { data: revision17 } = await userA.client
      .from("product_revisions")
      .select("label, supersedes_revision_id")
      .eq("id", loop.revisionId)
      .single();
    expect(revision17).toEqual({ label: "Rev17", supersedes_revision_id: null });
  });

  it("scopes the extended loop by workspace — another user sees neither the engineering change nor the second measurement (workspace isolation)", async () => {
    const loop = await runGatewayXLoop(userA.client, userA.id);

    const timelineAsB = await getInvestigationTimeline(userB.client, loop.failureCaseId);
    expect(timelineAsB).toEqual([]);

    const { data: changeAsB } = await userB.client
      .from("engineering_changes")
      .select("id")
      .eq("failure_case_id", loop.failureCaseId);
    expect(changeAsB).toEqual([]);
  });

  it("never claims PASS or CERTIFIED anywhere in the persisted timeline data (no pass/certification claim)", async () => {
    const loop = await runGatewayXLoop(userA.client, userA.id);
    const timeline = await getInvestigationTimeline(userA.client, loop.failureCaseId);
    const serialized = JSON.stringify(timeline);
    expect(serialized).not.toMatch(/\bPASS\b/);
    expect(serialized).not.toMatch(/\bCERTIFIED\b/);
    expect(serialized).not.toMatch(/root cause confirmed/i);
  });

  it("records exactly one peak for the recorded second measurement, with no stray duplicate row (duplicate submission)", async () => {
    // The actual duplicate-submission guard lives client-side (the submit
    // button disables for the duration of the action — see
    // record-engineering-change-form.test.tsx and add-measurement-form's
    // existing tests); what the domain layer needs to guarantee is that one
    // legitimate submission produces exactly one measurement/peak, not more.
    const loop = await runGatewayXLoop(userA.client, userA.id);

    const { data: peaks } = await userA.client
      .from("measurement_peaks")
      .select("id")
      .eq("measurement_id", loop.measurement2Id);
    expect(peaks).toHaveLength(1);

    const { data: measurementsOnRevision18 } = await userA.client
      .from("measurements")
      .select("id")
      .eq("product_revision_id", loop.revision18Id);
    expect(measurementsOnRevision18).toHaveLength(1);
  });
});
