// The database-touching core of the "RECORD RESULT" action (MVP-11) — split
// out from src/app/cases/[caseId]/investigation/actions.ts the same way
// MVP-08 split create-analysis-run.ts from route.ts: a plain function that
// takes an already-authenticated Supabase client is directly integration-
// testable against real Postgres/RLS, without fighting next/cache's
// revalidatePath (which only works inside a real Next.js request).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { InvestigationObservationInput } from "@/lib/domain/schema";

export type RecordObservationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * The deterministic, non-model-generated description stored alongside the
 * structured payload — this exact string is what a follow-up investigation
 * run's getPreviousInvestigations tool (and the investigation timeline)
 * reads back. Never rewritten by a model.
 */
export function buildObservationDescription(input: {
  observation: string;
  measurementChange?: string;
}): string {
  return [input.observation, input.measurementChange].filter(Boolean).join(" ");
}

export async function insertInvestigationObservation(
  supabase: SupabaseClient<Database>,
  userId: string,
  caseId: string,
  input: InvestigationObservationInput,
): Promise<RecordObservationResult> {
  // RLS-scoped: a caseId belonging to another workspace fails this insert
  // (the composite FK requires a matching workspace_id, which the
  // workspace_id-forcing trigger sets from the caller's own session) rather
  // than silently succeeding against someone else's case.
  const { error } = await supabase.from("investigation_events").insert({
    failure_case_id: caseId,
    event_type: "observation",
    description: buildObservationDescription(input),
    created_by: userId,
    payload: {
      observation: input.observation,
      measurementChange: input.measurementChange ?? null,
      operatingMode: input.operatingMode ?? null,
      notes: input.notes ?? null,
    },
  });
  if (error) {
    return { ok: false, message: "Could not save the observation." };
  }
  return { ok: true };
}
