// Integration tests for MVP-11's "RECORD ENGINEERING CHANGE" core against
// real Postgres/RLS (local Supabase, `supabase start`). Covers what a
// hand-built fixture can't prove: the composite-FK lineage actually being
// set, REV17 staying byte-for-byte untouched, product_facts really copying
// forward, workspace isolation on the new columns, and the compensating
// delete on a genuine failure partway through. Run with
// `pnpm test:integration`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  createAdminClient,
  createConfirmedUser,
} from "@/lib/documents/integration-test-helpers";
import { createEngineeringChange } from "./create-engineering-change";
import { getLatestRevisionInLineage } from "@/lib/products/revision-lineage";

async function seedGatewayXCase(db: SupabaseClient<Database>) {
  const { data: product } = await db.from("products").insert({ name: "Gateway X" }).select("id").single();
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
    .insert({ product_revision_id: revision!.id, title: "Radiated emissions — Gateway X Rev17" })
    .select("id")
    .single();
  const { data: measurement } = await db
    .from("measurements")
    .insert({ failure_case_id: failureCase!.id, product_revision_id: revision!.id })
    .select("id")
    .single();
  await db.from("measurement_peaks").insert({
    measurement_id: measurement!.id,
    frequency_mhz: 200,
    margin_db: 7.4,
  });

  return { productId: product!.id, revisionId: revision!.id, failureCaseId: failureCase!.id };
}

describe("MVP-11: RECORD ENGINEERING CHANGE (createEngineeringChange)", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `mvp11-change-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `mvp11-change-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("creates REV18 chained from REV17 and leaves REV17 completely unchanged (revision creation and lineage)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await createEngineeringChange(
      userA.client,
      { failureCaseId: seed.failureCaseId, productId: seed.productId, fromRevisionId: seed.revisionId },
      {
        title: "Display termination changed",
        description: "Terminated the display data line.",
        affectedSubsystem: "Display path",
        reason: "Follow-up to investigation where disconnecting the display path reduced the 200 MHz peak by 9 dB.",
        newRevisionLabel: "Rev18",
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newRevisionLabel).toBe("Rev18");

    const { data: newRevision } = await userA.client
      .from("product_revisions")
      .select("id, label, supersedes_revision_id")
      .eq("id", result.newRevisionId)
      .single();
    expect(newRevision).toMatchObject({ label: "Rev18", supersedes_revision_id: seed.revisionId });

    const { data: oldRevision } = await userA.client
      .from("product_revisions")
      .select("id, label, supersedes_revision_id")
      .eq("id", seed.revisionId)
      .single();
    expect(oldRevision).toMatchObject({ label: "Rev17", supersedes_revision_id: null });

    const latest = await getLatestRevisionInLineage(userA.client, seed.revisionId);
    expect(latest?.id).toBe(result.newRevisionId);
  });

  it("copies REV17's product facts forward verbatim without inventing changes (deterministic copy)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await createEngineeringChange(
      userA.client,
      { failureCaseId: seed.failureCaseId, productId: seed.productId, fromRevisionId: seed.revisionId },
      { title: "Change", description: "Change.", newRevisionLabel: "Rev18" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data: copiedFacts } = await userA.client
      .from("product_facts")
      .select("category, fact")
      .eq("product_revision_id", result.newRevisionId);
    expect(copiedFacts).toHaveLength(1);
    expect(copiedFacts![0]).toMatchObject({
      category: "clock",
      fact: { label: "system clock", frequencyMhz: 40 },
    });

    // The original revision's own facts are untouched — same row, not moved.
    const { data: originalFacts } = await userA.client
      .from("product_facts")
      .select("category")
      .eq("product_revision_id", seed.revisionId);
    expect(originalFacts).toHaveLength(1);
  });

  it("records the structured engineering_changes row linking REV17 -> REV18", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await createEngineeringChange(
      userA.client,
      { failureCaseId: seed.failureCaseId, productId: seed.productId, fromRevisionId: seed.revisionId },
      {
        title: "Display termination changed",
        description: "Terminated the display data line.",
        affectedSubsystem: "Display path",
        previousValue: "Floating",
        newValue: "100 ohm terminated",
        reason: "Follow-up investigation.",
        notes: "Verified with a multimeter.",
        newRevisionLabel: "Rev18",
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data: change } = await userA.client
      .from("engineering_changes")
      .select("title, affected_subsystem, from_product_revision_id, to_product_revision_id, payload")
      .eq("failure_case_id", seed.failureCaseId)
      .single();
    expect(change).toMatchObject({
      title: "Display termination changed",
      affected_subsystem: "Display path",
      from_product_revision_id: seed.revisionId,
      to_product_revision_id: result.newRevisionId,
      payload: {
        previousValue: "Floating",
        newValue: "100 ohm terminated",
        reason: "Follow-up investigation.",
        notes: "Verified with a multimeter.",
      },
    });
  });

  it("compensates by deleting the new revision when the engineering_changes insert fails partway through (rollback)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    // A failure_case_id that doesn't exist violates the composite FK on
    // engineering_changes, failing the insert after the revision and facts
    // have already been created — exactly the partial-failure case the
    // compensating delete exists for.
    const result = await createEngineeringChange(
      userA.client,
      {
        failureCaseId: "00000000-0000-0000-0000-000000000000",
        productId: seed.productId,
        fromRevisionId: seed.revisionId,
      },
      { title: "Change", description: "Change.", newRevisionLabel: "Rev18" },
    );
    expect(result.ok).toBe(false);

    const { data: revisions } = await userA.client
      .from("product_revisions")
      .select("id, label")
      .eq("product_id", seed.productId);
    // Only the original REV17 remains — the half-created REV18 was rolled back.
    expect(revisions).toHaveLength(1);
    expect(revisions![0].label).toBe("Rev17");
  });

  it("scopes engineering changes by workspace — another user cannot create a change against someone else's revision (workspace isolation)", async () => {
    const seed = await seedGatewayXCase(userA.client);

    const result = await createEngineeringChange(
      userB.client,
      { failureCaseId: seed.failureCaseId, productId: seed.productId, fromRevisionId: seed.revisionId },
      { title: "Cross-workspace change", description: "Should not be created.", newRevisionLabel: "Rev18" },
    );
    expect(result.ok).toBe(false);

    const { data: revisions } = await userA.client
      .from("product_revisions")
      .select("id")
      .eq("product_id", seed.productId);
    expect(revisions).toHaveLength(1);
  });
});
