"use server";

// MVP-11's "RECORD RESULT" action: persists a structured engineer
// observation as real investigation evidence. Never rewrites or deletes
// anything — every prior investigation_events/analysis_events row stays
// exactly as it was, which is what makes the case's history auditable (see
// src/lib/investigation/timeline.ts). The observation becomes visible to
// the next Investigation Agent run purely because it's a new row the
// agent's existing getPreviousInvestigations tool already reads — no
// agent architecture change is needed to feed it in.
//
// The actual DB write lives in src/lib/investigation/record-observation.ts
// (a plain function taking an already-authenticated client) — this file is
// just the thin Next.js-bound wrapper (form parsing, auth, revalidatePath),
// the same split MVP-08 established for create-analysis-run.ts vs route.ts,
// which is what makes the DB-touching half directly integration-testable.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { investigationObservationInputSchema } from "@/lib/domain/schema";
import { insertInvestigationObservation } from "@/lib/investigation/record-observation";

export interface RecordObservationFormState {
  error?: string;
  success?: boolean;
}

export async function recordInvestigationObservation(
  caseId: string,
  _prevState: RecordObservationFormState,
  formData: FormData,
): Promise<RecordObservationFormState> {
  const parsed = investigationObservationInputSchema.safeParse({
    observation: formData.get("observation"),
    measurementChange: formData.get("measurementChange") || undefined,
    operatingMode: formData.get("operatingMode") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to record an observation." };
  }

  const result = await insertInvestigationObservation(supabase, user.id, caseId, parsed.data);
  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath(`/cases/${caseId}/investigation`);
  return { success: true };
}
