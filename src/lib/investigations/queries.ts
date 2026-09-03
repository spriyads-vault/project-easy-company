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
import { analysisEventSchema } from "@/lib/analysis/events";
import { deriveQueueWorkflowState, describeRequiredNextAction } from "./derive-queue-workflow-state";
import type { WorkflowState } from "@/lib/investigation/derive-workflow-state";

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
  /** UX-05 Workstream D: the same canonical WorkflowState vocabulary the
   * investigation workspace uses, computed at queue scale (see
   * derive-queue-workflow-state.ts for why this isn't deriveWorkflowState
   * itself) — real filter buckets and a truthful required-next-action
   * string, never a fabricated status label. */
  workflowState: WorkflowState;
  requiredNextAction: string;
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
  const [measurementsByCase, latestRunByCase, lastEngineeringChangeByCase] = await Promise.all([
    loadMeasurementsByCase(supabase, caseIds),
    loadLatestRunByCase(supabase, caseIds),
    loadLastEngineeringChangeByCase(supabase, caseIds),
  ]);
  const latestRunHypothesisStatsByCase = await loadLatestRunHypothesisStatsByCase(supabase, latestRunByCase);

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

      // Mirrors timeline.ts's own "result" rule: a real before/after
      // outcome exists only once a later measurement lands on a genuinely
      // different revision than the case's first one.
      const lastResultAt = firstMeasurement
        ? ([...measurements].reverse().find((m) => m.revisionId !== firstMeasurement.revisionId)?.createdAt ?? null)
        : null;

      const caseStatus = row.status as InvestigationSummary["status"];
      const runStatus = (latestRun?.status as "pending" | "running" | "completed" | "failed" | undefined) ?? null;
      const hypothesisStats = latestRun ? latestRunHypothesisStatsByCase.get(row.id) : undefined;
      const workflowState = deriveQueueWorkflowState({
        caseStatus,
        hasMeasurement: measurements.length > 0,
        latestRunStatus: runStatus,
        latestRunHypothesisCount: hypothesisStats?.count ?? 0,
        latestRunHasMissingEvidence: hypothesisStats?.hasMissingEvidence ?? false,
        lastEngineeringChangeAt: lastEngineeringChangeByCase.get(row.id) ?? null,
        lastResultAt,
      });

      return {
        id: row.id,
        title: row.title,
        status: caseStatus,
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
        workflowState,
        requiredNextAction: describeRequiredNextAction(workflowState),
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

interface MeasurementPoint {
  createdAt: string;
  frequencyMhz: number;
  marginDb: number;
  revisionId: string;
}

async function loadMeasurementsByCase(
  supabase: SupabaseClient<Database>,
  caseIds: string[],
): Promise<Map<string, MeasurementPoint[]>> {
  const { data } = await supabase
    .from("measurements")
    .select("failure_case_id, created_at, product_revision_id, measurement_peaks(frequency_mhz, margin_db)")
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
      revisionId: row.product_revision_id,
    });
    byCase.set(row.failure_case_id, existing);
  }
  return byCase;
}

/** Latest `engineering_changes.created_at` per case — one batched query,
 * mirrors timeline.ts's own "last change" concept without loading every
 * change's full detail (the queue only needs the timestamp). */
async function loadLastEngineeringChangeByCase(
  supabase: SupabaseClient<Database>,
  caseIds: string[],
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("engineering_changes")
    .select("failure_case_id, created_at")
    .in("failure_case_id", caseIds)
    .order("created_at", { ascending: true });

  const byCase = new Map<string, string>();
  for (const row of data ?? []) {
    // Ordered ascending — the last write for a case id wins, i.e. latest.
    byCase.set(row.failure_case_id, row.created_at);
  }
  return byCase;
}

/** For every case's latest run (completed or not), the real hypothesis
 * count and whether any hypothesis in that run carries a genuine
 * MISSING-evidence gap — read from the same persisted `hypothesis.created`
 * analysis_events rows the investigation workspace itself reconstructs
 * from, batched across every case's latest run id in one query. */
async function loadLatestRunHypothesisStatsByCase(
  supabase: SupabaseClient<Database>,
  latestRunByCase: Map<string, { status: string; createdAt: string; runId: string }>,
): Promise<Map<string, { count: number; hasMissingEvidence: boolean }>> {
  const runIdToCaseId = new Map<string, string>();
  for (const [caseId, run] of latestRunByCase) runIdToCaseId.set(run.runId, caseId);
  const runIds = [...runIdToCaseId.keys()];
  const byCase = new Map<string, { count: number; hasMissingEvidence: boolean }>();
  if (runIds.length === 0) return byCase;

  const { data } = await supabase
    .from("analysis_events")
    .select("analysis_run_id, sequence, created_at, payload")
    .in("analysis_run_id", runIds)
    .eq("event_type", "hypothesis.created");

  for (const row of data ?? []) {
    const caseId = runIdToCaseId.get(row.analysis_run_id);
    if (!caseId) continue;
    const parsed = analysisEventSchema.safeParse({
      type: "hypothesis.created",
      runId: row.analysis_run_id,
      sequence: row.sequence,
      createdAt: row.created_at,
      payload: row.payload,
    });
    if (!parsed.success || parsed.data.type !== "hypothesis.created") continue;
    const existing = byCase.get(caseId) ?? { count: 0, hasMissingEvidence: false };
    const hasMissingEvidence =
      existing.hasMissingEvidence || parsed.data.payload.evidence.some((item) => item.category === "missing");
    byCase.set(caseId, { count: existing.count + 1, hasMissingEvidence });
  }
  return byCase;
}

async function loadLatestRunByCase(
  supabase: SupabaseClient<Database>,
  caseIds: string[],
): Promise<Map<string, { status: string; createdAt: string; runId: string }>> {
  const { data } = await supabase
    .from("analysis_runs")
    .select("id, failure_case_id, status, created_at")
    .in("failure_case_id", caseIds)
    .order("created_at", { ascending: true });

  const byCase = new Map<string, { status: string; createdAt: string; runId: string }>();
  for (const row of data ?? []) {
    // Ordered ascending — the last write for a case id wins, i.e. latest.
    byCase.set(row.failure_case_id, { status: row.status, createdAt: row.created_at, runId: row.id });
  }
  return byCase;
}
