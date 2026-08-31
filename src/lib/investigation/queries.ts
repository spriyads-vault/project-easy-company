// Server-only read path for the investigation workspace (MVP-09). Loads a
// failure case's real product facts, measurements, and — critically — the
// persisted analysis_events for its most recent run, reduced through the
// same reconstructFromPersistedEvents used for refresh recovery. This
// function never calls a model adapter and never starts a run; it only
// ever reads what's already in Postgres, which is what makes "refresh
// reconstructs state without rerunning Anthropic" true by construction.
import { createClient } from "@/lib/supabase/server";
import { getFailureCase, type FailureCaseDetail } from "@/lib/cases/queries";
import { loadProductFactRecords } from "@/lib/products/load-fact-records";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import { analysisEventSchema, type AnalysisEvent } from "@/lib/analysis/events";
import {
  reconstructFromPersistedEvents,
  type WorkspaceState,
} from "./reconstruct";

export interface InvestigationWorkspaceData {
  failureCase: FailureCaseDetail;
  productFacts: ProductFactRecord[];
  /** The measurement the workspace investigates — the most recently
   * recorded one for this case. MVP-11 (second measurement, before/after)
   * is the ticket that has to decide how multiple measurements are
   * presented together; for MVP-09 there's exactly one under
   * investigation at a time. */
  measurement: FailureCaseDetail["measurements"][number] | null;
  workspaceState: WorkspaceState;
}

export async function getInvestigationWorkspaceData(
  caseId: string,
): Promise<InvestigationWorkspaceData | null> {
  const failureCase = await getFailureCase(caseId);
  if (!failureCase) return null;

  const supabase = await createClient();
  const productFacts = await loadProductFactRecords(
    supabase,
    failureCase.productRevisionId,
  );

  const measurement =
    failureCase.measurements[failureCase.measurements.length - 1] ?? null;

  const { data: latestRun } = await supabase
    .from("analysis_runs")
    .select("id")
    .eq("failure_case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let events: AnalysisEvent[] = [];
  if (latestRun) {
    const { data: rows } = await supabase
      .from("analysis_events")
      .select("event_type, sequence, created_at, payload")
      .eq("analysis_run_id", latestRun.id)
      .order("sequence", { ascending: true });

    events = (rows ?? []).flatMap((row) => {
      const parsed = analysisEventSchema.safeParse({
        type: row.event_type,
        runId: latestRun.id,
        sequence: row.sequence,
        createdAt: row.created_at,
        payload: row.payload,
      });
      // A row that doesn't parse (e.g. a reserved-but-unimplemented event
      // type like product.fact_detected) is skipped, not fatal — matches
      // loadProductFactRecords' "skip, don't trust" convention.
      return parsed.success ? [parsed.data] : [];
    });
  }

  return {
    failureCase,
    productFacts,
    measurement,
    workspaceState: reconstructFromPersistedEvents(events),
  };
}
