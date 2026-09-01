import { createClient } from "@/lib/supabase/server";

export interface FailureCaseSummary {
  id: string;
  productRevisionId: string;
  title: string;
  status: "open" | "resolved" | "archived";
  createdAt: string;
}

export interface MeasurementPeakRow {
  id: string;
  frequencyMhz: number;
  marginDb: number;
  detector: string | null;
  limitLine: string | null;
}

export interface MeasurementRow {
  id: string;
  label: string | null;
  operatingMode: string | null;
  notes: string | null;
  createdAt: string;
  peaks: MeasurementPeakRow[];
  /** MVP-11: a measurement can belong to a *newer* revision than the case
   * itself was opened against (a second measurement recorded for Rev18 on
   * a case still scoped to Rev17) — this is what makes the before/after
   * comparison and revision-scoped evidence ownership possible. */
  productRevisionId: string;
  revisionLabel: string;
}

export interface FailureCaseDetail extends FailureCaseSummary {
  productId: string;
  productName: string;
  revisionLabel: string;
  measurements: MeasurementRow[];
}

/** Failure cases opened against a given product revision, most recent first. */
export async function listFailureCases(
  productRevisionId: string,
): Promise<FailureCaseSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("failure_cases")
    .select("id, product_revision_id, title, status, created_at")
    .eq("product_revision_id", productRevisionId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    productRevisionId: row.product_revision_id,
    title: row.title,
    status: row.status as FailureCaseSummary["status"],
    createdAt: row.created_at,
  }));
}

/** A failure case with its product/revision context and all measurements. */
export async function getFailureCase(
  caseId: string,
): Promise<FailureCaseDetail | null> {
  const supabase = await createClient();

  const { data: failureCase, error } = await supabase
    .from("failure_cases")
    .select(
      "id, product_revision_id, title, status, created_at, product_revisions(label, product_id, products(id, name))",
    )
    .eq("id", caseId)
    .single();
  if (error || !failureCase) return null;

  const revision = failureCase.product_revisions;
  const product = revision?.products;
  if (!revision || !product) return null;

  const { data: measurements } = await supabase
    .from("measurements")
    .select(
      "id, label, operating_mode, notes, created_at, product_revision_id, product_revisions(label), measurement_peaks(id, frequency_mhz, margin_db, detector, limit_line)",
    )
    .eq("failure_case_id", caseId)
    .order("created_at", { ascending: true });

  return {
    id: failureCase.id,
    productRevisionId: failureCase.product_revision_id,
    title: failureCase.title,
    status: failureCase.status as FailureCaseSummary["status"],
    createdAt: failureCase.created_at,
    productId: product.id,
    productName: product.name,
    revisionLabel: revision.label,
    measurements: (measurements ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      operatingMode: row.operating_mode,
      notes: row.notes,
      createdAt: row.created_at,
      productRevisionId: row.product_revision_id,
      revisionLabel: row.product_revisions?.label ?? revision.label,
      peaks: (row.measurement_peaks ?? []).map((peak) => ({
        id: peak.id,
        frequencyMhz: Number(peak.frequency_mhz),
        marginDb: Number(peak.margin_db),
        detector: peak.detector,
        limitLine: peak.limit_line,
      })),
    })),
  };
}
