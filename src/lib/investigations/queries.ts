// UX-04 (Agent-Native): the "Investigations" home needs one workspace-wide
// list of failure cases with enough real context to read as a work queue
// (product/revision/status/latest action/updated time) — no such
// aggregation existed before this ticket (failure cases previously only
// ever listed scoped to one revision, see src/lib/cases/queries.ts's
// listFailureCases). Every field here is either a stored column or a
// value computed from stored rows (a real before/after margin delta) —
// never a fabricated count or invented status label.
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type InvestigationRunState = "idle" | "running" | "completed" | "failed" | null;

export interface InvestigationSummary {
  id: string;
  title: string;
  status: "open" | "resolved" | "archived";
  productId: string;
  productName: string;
  revisionLabel: string;
  createdAt: string;
  updatedAt: string;
  /** The most recent measurement's peak, or null if none recorded yet. */
  latestMeasurement: { frequencyMhz: number; marginDb: number } | null;
  latestRunStatus: InvestigationRunState;
  /** Only populated when ≥2 real measurements exist for this case — a
   * genuine computed before/after margin delta, never estimated. Positive
   * = margin improved (dropped further below the limit). */
  marginDeltaDb: number | null;
}

interface FailureCaseRow {
  id: string;
  product_revision_id: string;
  title: string;
  status: string;
  created_at: string;
  product_revisions: { label: string; product_id: string; products: { id: string; name: string } | null } | null;
}

/** Every failure case in the signed-in user's workspace, most-recently-
 * touched first (touched = latest of: case opened, last analysis run,
 * last measurement — all real timestamps, never estimated). */
export async function listInvestigations(): Promise<InvestigationSummary[]> {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from("failure_cases")
    .select(
      "id, product_revision_id, title, status, created_at, product_revisions(label, product_id, products(id, name))",
    )
    .order("created_at", { ascending: false });

  const rows = (cases ?? []) as unknown as FailureCaseRow[];
  if (rows.length === 0) return [];

  const caseIds = rows.map((row) => row.id);
  const [measurementsByCase, latestRunByCase] = await Promise.all([
    loadMeasurementsByCase(supabase, caseIds),
    loadLatestRunByCase(supabase, caseIds),
  ]);

  return rows
    .filter((row): row is FailureCaseRow & { product_revisions: NonNullable<FailureCaseRow["product_revisions"]> } =>
      row.product_revisions !== null && row.product_revisions.products !== null,
    )
    .map((row) => {
      const measurements = measurementsByCase.get(row.id) ?? [];
      const latestMeasurement = measurements.at(-1) ?? null;
      const firstMeasurement = measurements.at(0) ?? null;
      const latestRun = latestRunByCase.get(row.id) ?? null;

      const marginDeltaDb =
        measurements.length >= 2 && firstMeasurement && latestMeasurement
          ? Number((firstMeasurement.marginDb - latestMeasurement.marginDb).toFixed(1))
          : null;

      const timestamps = [row.created_at, latestRun?.createdAt, latestMeasurement?.createdAt].filter(
        (value): value is string => Boolean(value),
      );
      const updatedAt = timestamps.reduce((latest, value) => (value > latest ? value : latest), row.created_at);

      return {
        id: row.id,
        title: row.title,
        status: row.status as InvestigationSummary["status"],
        productId: row.product_revisions.products!.id,
        productName: row.product_revisions.products!.name,
        revisionLabel: row.product_revisions.label,
        createdAt: row.created_at,
        updatedAt,
        latestMeasurement: latestMeasurement
          ? { frequencyMhz: latestMeasurement.frequencyMhz, marginDb: latestMeasurement.marginDb }
          : null,
        latestRunStatus: (latestRun?.status as InvestigationRunState) ?? null,
        marginDeltaDb,
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

interface MeasurementPoint {
  createdAt: string;
  frequencyMhz: number;
  marginDb: number;
}

async function loadMeasurementsByCase(
  supabase: SupabaseClient<Database>,
  caseIds: string[],
): Promise<Map<string, MeasurementPoint[]>> {
  const { data } = await supabase
    .from("measurements")
    .select("failure_case_id, created_at, measurement_peaks(frequency_mhz, margin_db)")
    .in("failure_case_id", caseIds)
    .order("created_at", { ascending: true });

  const byCase = new Map<string, MeasurementPoint[]>();
  for (const row of data ?? []) {
    const peak = row.measurement_peaks?.[0];
    if (!peak) continue;
    const existing = byCase.get(row.failure_case_id) ?? [];
    existing.push({
      createdAt: row.created_at,
      frequencyMhz: Number(peak.frequency_mhz),
      marginDb: Number(peak.margin_db),
    });
    byCase.set(row.failure_case_id, existing);
  }
  return byCase;
}

async function loadLatestRunByCase(
  supabase: SupabaseClient<Database>,
  caseIds: string[],
): Promise<Map<string, { status: string; createdAt: string }>> {
  const { data } = await supabase
    .from("analysis_runs")
    .select("failure_case_id, status, created_at")
    .in("failure_case_id", caseIds)
    .order("created_at", { ascending: true });

  const byCase = new Map<string, { status: string; createdAt: string }>();
  for (const row of data ?? []) {
    // Ordered ascending — the last write for a case id wins, i.e. latest.
    byCase.set(row.failure_case_id, { status: row.status, createdAt: row.created_at });
  }
  return byCase;
}
