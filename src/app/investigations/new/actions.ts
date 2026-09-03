"use server";

// NEW INVESTIGATION INTAKE (UX-04 Agent-Native): the one action behind
// "Start investigation" on the confirmation surface. Composes the exact
// same inserts the old multi-page form journey made (createProduct /
// createRevision / createFailureCase / createMeasurement) into one call —
// no new tables, no schema change. Product/revision are matched-or-
// created explicitly (never silently duplicated): an existing revision
// label under the resolved product is reused, never re-created.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { measurementPeakInputSchema } from "@/lib/domain/schema";
import { buildDocumentStoragePath } from "@/lib/documents/storage-path";
import { ingestDocument } from "@/lib/documents/ingest-document";
import { documentMimeTypeSchema } from "@/lib/domain/schema";
import { listInvestigations, type InvestigationSummary } from "@/lib/investigations/queries";

/** UX-05 Workstream B: the New Investigation page's "Recent investigations"
 * section fetches through this Server Action (client-triggered, not
 * server-rendered directly into the page) specifically so a failure here
 * can show a local retry without taking the intake composer above it down
 * with it — the composer never depends on this call succeeding. */
export interface RecentInvestigationsResult {
  investigations: InvestigationSummary[];
  error: false;
}
export interface RecentInvestigationsError {
  investigations: never[];
  error: true;
}

export async function loadRecentInvestigations(): Promise<RecentInvestigationsResult | RecentInvestigationsError> {
  try {
    const investigations = await listInvestigations();
    return { investigations, error: false };
  } catch {
    return { investigations: [], error: true };
  }
}

function sniffMimeTypeFromFilename(filename: string): string {
  if (filename.endsWith(".md") || filename.endsWith(".markdown")) return "text/markdown";
  if (filename.endsWith(".txt")) return "text/plain";
  if (filename.endsWith(".pdf")) return "application/pdf";
  return "";
}

const STORAGE_BUCKET = "engineering-documents";

/** Best-effort: if an attached file fails to store/ingest, the
 * investigation itself still gets created — a failed attachment is never
 * worth discarding a real measurement over. The document (if it made it
 * into engineering_documents at all) still shows its honest failed status
 * on the Sources page, same as any other failed upload. */
async function attachIntakeFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  productId: string,
  productRevisionId: string,
): Promise<void> {
  try {
    const { data: workspaceId } = await supabase.rpc("current_workspace_id");
    if (!workspaceId) return;

    const mimeTypeParsed = documentMimeTypeSchema.safeParse(file.type || sniffMimeTypeFromFilename(file.name));
    if (!mimeTypeParsed.success) return;
    const mimeType = mimeTypeParsed.data;

    const documentId = crypto.randomUUID();
    const storagePath = buildDocumentStoragePath(workspaceId, documentId, file.name);

    const { error: insertError } = await supabase.from("engineering_documents").insert({
      id: documentId,
      filename: file.name,
      // Intake attachments are, by definition, the evidence for a
      // just-failed test — "test_report" is the one honest default
      // rather than making the engineer classify it during intake.
      document_type: "test_report",
      mime_type: mimeType,
      byte_size: file.size,
      product_id: productId,
      product_revision_id: productRevisionId,
      storage_path: storagePath,
      status: "uploading",
    });
    if (insertError) return;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      await supabase
        .from("engineering_documents")
        .update({ status: "failed", failure_reason: "Could not upload the file to storage." })
        .eq("id", documentId);
      return;
    }

    await supabase.from("engineering_documents").update({ status: "processing" }).eq("id", documentId);
    await ingestDocument(supabase, { documentId, buffer: bytes, mimeType });
  } catch {
    // Never let an attachment failure take down the whole intake.
  }
}

export interface IntakeFormState {
  error?: string;
}

const intakeSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  newProductName: z.string().trim().min(1).optional(),
  revisionLabel: z.string().trim().min(1, "Give this revision a label."),
  operatingMode: z.string().trim().min(1, "Describe what the product was doing during this measurement."),
  peak: measurementPeakInputSchema,
});

export async function createInvestigationIntake(
  _prevState: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const productId = formData.get("productId");
  const newProductName = formData.get("newProductName");

  const parsed = intakeSchema.safeParse({
    productId: typeof productId === "string" && productId ? productId : undefined,
    newProductName: typeof newProductName === "string" && newProductName ? newProductName : undefined,
    revisionLabel: formData.get("revisionLabel"),
    operatingMode: formData.get("operatingMode"),
    peak: {
      frequencyMhz: numberOrUndefined(formData.get("frequencyMhz")),
      marginDb: numberOrUndefined(formData.get("marginDb")),
    },
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (!parsed.data.productId && !parsed.data.newProductName) {
    return { error: "Choose an existing product or name a new one." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to start an investigation." };
  }

  // 1. Resolve or create the product.
  let productId_: string;
  if (parsed.data.productId) {
    productId_ = parsed.data.productId;
  } else {
    const { data: product, error } = await supabase
      .from("products")
      .insert({ name: parsed.data.newProductName! })
      .select("id")
      .single();
    if (error || !product) {
      return { error: "Could not create the product." };
    }
    productId_ = product.id;
  }

  // 2. Resolve or create the revision — reuse an existing label under this
  // product rather than creating a duplicate.
  const { data: existingRevision } = await supabase
    .from("product_revisions")
    .select("id")
    .eq("product_id", productId_)
    .eq("label", parsed.data.revisionLabel)
    .maybeSingle();

  let revisionId: string;
  if (existingRevision) {
    revisionId = existingRevision.id;
  } else {
    const { data: revision, error } = await supabase
      .from("product_revisions")
      .insert({ product_id: productId_, label: parsed.data.revisionLabel })
      .select("id")
      .single();
    if (error || !revision) {
      return { error: "Could not create the revision." };
    }
    revisionId = revision.id;
  }

  // 3. Open the failure case.
  const { data: failureCase, error: caseError } = await supabase
    .from("failure_cases")
    .insert({ product_revision_id: revisionId })
    .select("id")
    .single();
  if (caseError || !failureCase) {
    return { error: "Could not open a failure case." };
  }

  // 4. Record the first measurement.
  const { data: measurement, error: measurementError } = await supabase
    .from("measurements")
    .insert({
      failure_case_id: failureCase.id,
      product_revision_id: revisionId,
      operating_mode: parsed.data.operatingMode,
      measured_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (measurementError || !measurement) {
    return { error: "Could not save the measurement." };
  }

  const { error: peakError } = await supabase.from("measurement_peaks").insert({
    measurement_id: measurement.id,
    frequency_mhz: parsed.data.peak.frequencyMhz,
    margin_db: parsed.data.peak.marginDb,
  });
  if (peakError) {
    await supabase.from("measurements").delete().eq("id", measurement.id);
    return { error: "Could not save the measured peak." };
  }

  await supabase.from("investigation_events").insert({
    failure_case_id: failureCase.id,
    event_type: "case_opened",
    description: "Radiated emissions case opened.",
    created_by: user.id,
  });

  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    await attachIntakeFile(supabase, attachment, productId_, revisionId);
  }

  revalidatePath("/investigations");
  revalidatePath("/products");
  revalidatePath("/documents");
  // ?autorun=1: the investigation workspace starts the first analysis run
  // itself on mount rather than waiting for a separate RUN INVESTIGATION
  // click — see investigation-workspace.tsx.
  redirect(`/cases/${failureCase.id}/investigation?autorun=1`);
}

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
