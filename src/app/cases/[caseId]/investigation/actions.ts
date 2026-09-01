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
import { investigationObservationInputSchema, engineeringChangeInputSchema } from "@/lib/domain/schema";
import { insertInvestigationObservation } from "@/lib/investigation/record-observation";
import { createEngineeringChange } from "@/lib/engineering-changes/create-engineering-change";

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

// MVP-11's "RECORD ENGINEERING CHANGE" action — structured, never a chatbot
// textarea (see record-engineering-change-form.tsx). Recording the change
// is what creates REV17 -> REV18 (src/lib/engineering-changes/
// create-engineering-change.ts): REV17 is never overwritten, only ever
// superseded, so every prior measurement/hypothesis/observation on it stays
// exactly where it was. Revalidates both the investigation workspace (new
// timeline entries) and the case page (AddMeasurementForm now binds to the
// new latest revision via getLatestRevisionInLineage).
export interface RecordEngineeringChangeFormState {
  error?: string;
  success?: boolean;
  newRevisionLabel?: string;
}

export async function recordEngineeringChange(
  caseId: string,
  productId: string,
  fromRevisionId: string,
  _prevState: RecordEngineeringChangeFormState,
  formData: FormData,
): Promise<RecordEngineeringChangeFormState> {
  const parsed = engineeringChangeInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    affectedSubsystem: formData.get("affectedSubsystem") || undefined,
    previousValue: formData.get("previousValue") || undefined,
    newValue: formData.get("newValue") || undefined,
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
    newRevisionLabel: formData.get("newRevisionLabel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to record an engineering change." };
  }

  const result = await createEngineeringChange(
    supabase,
    { failureCaseId: caseId, productId, fromRevisionId },
    parsed.data,
  );
  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath(`/cases/${caseId}/investigation`);
  revalidatePath(`/cases/${caseId}`);
  return { success: true, newRevisionLabel: result.newRevisionLabel };
}
