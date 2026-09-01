// The database-touching core of "RECORD ENGINEERING CHANGE" (MVP-11). Takes
// an already-authenticated Supabase client — same split as
// src/lib/investigation/record-observation.ts, for the same reason: direct
// integration-testability against real Postgres/RLS without fighting
// next/cache's revalidatePath.
//
// Recording the change is what creates the new revision (REV 17 -> REV 18):
// this function (1) creates the new product_revisions row with
// supersedes_revision_id set — REV 17 is never overwritten, only ever
// superseded; (2) copies REV 17's product_facts forward verbatim (no
// invented changes — an explicit fact change is the engineer's job via the
// existing add/edit-fact UI on the new revision, not this action's job);
// (3) inserts the engineering_changes row linking both revisions and the
// failure case. A failure partway compensates by deleting the new revision
// (and its copied facts cascade with it via the FK), matching the
// compensating-action pattern MVP-05's measurement/peak insert already
// established — an acceptable simplification over a DB transaction per
// CLAUDE.md's "simplest reversible implementation" tie-breaker.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { EngineeringChangeInput } from "@/lib/domain/schema";

export type CreateEngineeringChangeResult =
  | { ok: true; newRevisionId: string; newRevisionLabel: string }
  | { ok: false; message: string };

export async function createEngineeringChange(
  supabase: SupabaseClient<Database>,
  params: {
    failureCaseId: string;
    productId: string;
    fromRevisionId: string;
  },
  input: EngineeringChangeInput,
): Promise<CreateEngineeringChangeResult> {
  const { data: newRevision, error: revisionError } = await supabase
    .from("product_revisions")
    .insert({
      product_id: params.productId,
      label: input.newRevisionLabel,
      supersedes_revision_id: params.fromRevisionId,
    })
    .select("id, label")
    .single();
  if (revisionError || !newRevision) {
    // The composite FK rejects this if productId/fromRevisionId aren't in
    // this workspace — never a silent cross-workspace write.
    return { ok: false, message: "Could not create the new revision." };
  }

  const { data: previousFacts, error: factsReadError } = await supabase
    .from("product_facts")
    .select("category, fact, source")
    .eq("product_revision_id", params.fromRevisionId);
  if (factsReadError) {
    await supabase.from("product_revisions").delete().eq("id", newRevision.id);
    return { ok: false, message: "Could not read the previous revision's product facts." };
  }

  if (previousFacts && previousFacts.length > 0) {
    const { error: factsCopyError } = await supabase.from("product_facts").insert(
      previousFacts.map((fact) => ({
        product_revision_id: newRevision.id,
        category: fact.category,
        fact: fact.fact,
        source: fact.source,
      })),
    );
    if (factsCopyError) {
      await supabase.from("product_revisions").delete().eq("id", newRevision.id);
      return { ok: false, message: "Could not copy product facts to the new revision." };
    }
  }

  const { error: changeError } = await supabase.from("engineering_changes").insert({
    failure_case_id: params.failureCaseId,
    from_product_revision_id: params.fromRevisionId,
    to_product_revision_id: newRevision.id,
    title: input.title,
    description: input.description,
    affected_subsystem: input.affectedSubsystem ?? null,
    payload: {
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    },
  });
  if (changeError) {
    await supabase.from("product_revisions").delete().eq("id", newRevision.id);
    return { ok: false, message: "Could not record the engineering change." };
  }

  return { ok: true, newRevisionId: newRevision.id, newRevisionLabel: newRevision.label };
}
