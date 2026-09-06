// The database-touching half of MVP-08: loads a measurement/failure case's
// real data (RLS-scoped to whichever Supabase client is passed in),
// creates the analysis_runs row, then runs the pure pipeline
// (run-analysis.ts) and persists each event to analysis_events as it's
// produced — before the caller (the API route) ever gets to stream it.
// Takes the Supabase client and model adapter as parameters rather than
// constructing either itself, which is what makes this directly
// integration-testable against a real local Supabase with a fake adapter,
// no live model key required.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LanguageModel } from "ai";
import type { Database } from "@/lib/supabase/database.types";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import { loadProductFactRecords } from "@/lib/products/load-fact-records";
import { describeProductFact } from "@/lib/products/describe-fact";
import type { ProductFactForHypotheses } from "@/lib/hypotheses/generate-hypotheses";
import { investigateStreaming } from "@/lib/agents/investigation-agent";
import {
  runAnalysis,
  type AnalysisMeasurementInput,
  type InvestigationAgentRunner,
} from "./run-analysis";
import { analysisEventSchema, type AnalysisEvent } from "./events";

export interface CreateAnalysisRunParams {
  failureCaseId: string;
  measurementId: string;
}

export interface CreateAnalysisRunOptions {
  /**
   * When provided, MVP-10B's Investigation Agent produces the run's
   * hypotheses (grounded with document citations and case history) instead
   * of the plain single-shot adapter call — this is the real production
   * behavior (see src/app/api/analysis-runs/route.ts). Omitted, every
   * existing test's event sequence is unchanged: no ANTHROPIC_API_KEY or
   * live model is required to exercise the plain path.
   */
  agentModel?: LanguageModel;
}

export type CreateAnalysisRunResult =
  | { ok: true; runId: string; events: AsyncGenerator<AnalysisEvent, void, void> }
  | { ok: false; status: 404 | 400; message: string };

function toFactSummaries(
  records: readonly Awaited<ReturnType<typeof loadProductFactRecords>>[number][],
): ProductFactForHypotheses[] {
  return records.map((record) => ({
    id: record.id,
    category: record.category,
    label: record.fact.label,
    summary: describeProductFact(record),
  }));
}

export async function createAnalysisRunForFailureCase(
  params: CreateAnalysisRunParams,
  adapter: HypothesisModelAdapter,
  supabase: SupabaseClient<Database>,
  options: CreateAnalysisRunOptions = {},
): Promise<CreateAnalysisRunResult> {
  const { data: failureCase } = await supabase
    .from("failure_cases")
    .select(
      "id, product_revision_id, title, status, product_revisions(id, label, product_id, products(id, name))",
    )
    .eq("id", params.failureCaseId)
    .maybeSingle();
  if (!failureCase) {
    // RLS makes "belongs to someone else" and "doesn't exist" look
    // identical from here, which is the point — never leak existence.
    return { ok: false, status: 404, message: "Failure case not found." };
  }

  const { data: measurement } = await supabase
    .from("measurements")
    .select(
      "id, failure_case_id, operating_mode, label, product_revision_id, product_revisions(id, label), measurement_peaks(id, frequency_mhz, margin_db, detector, limit_line)",
    )
    .eq("id", params.measurementId)
    .maybeSingle();
  if (!measurement || measurement.failure_case_id !== params.failureCaseId) {
    return {
      ok: false,
      status: 404,
      message: "Measurement not found for this failure case.",
    };
  }

  const peak = measurement.measurement_peaks[0];
  if (!peak) {
    return {
      ok: false,
      status: 400,
      message: "This measurement has no recorded peak to analyze.",
    };
  }

  const measurementInput: AnalysisMeasurementInput = {
    id: measurement.id,
    frequencyMhz: Number(peak.frequency_mhz),
    marginDb: Number(peak.margin_db),
    operatingMode: measurement.operating_mode,
  };

  // MVP-11: a measurement can belong to a *newer* revision than the case
  // itself was opened against (a second measurement recorded for Rev18 on
  // a case still scoped to Rev17) — facts must come from the measurement's
  // own revision, not the case's original one, or a RE-EVALUATE INVESTIGATION
  // after an engineering change would silently reason over stale Rev17 facts.
  const analyzedRevisionId = measurement.product_revision_id;
  const productFacts = await loadProductFactRecords(supabase, analyzedRevisionId);
  const productFactSummaries = toFactSummaries(productFacts);

  const product = failureCase.product_revisions?.products;
  const revision = measurement.product_revisions
    ? { id: measurement.product_revisions.id, label: measurement.product_revisions.label }
    : failureCase.product_revisions
      ? { id: failureCase.product_revisions.id, label: failureCase.product_revisions.label }
      : null;

  let agentRunner: InvestigationAgentRunner | undefined;
  if (options.agentModel && revision && product) {
    const agentModel = options.agentModel;
    // PERF-01: four independent counts, fetched together rather than
    // sequentially — this is what "give the agent enough initial metadata"
    // and "run independent tools in parallel" mean at the deterministic
    // pre-fetch layer, before the agent's own tool loop even starts. Each
    // becomes either a fact in the agent's task prompt or a reason to omit
    // a whole tool from its tool list (see selectActiveTools in
    // investigation-agent.ts) — never something the agent has to spend a
    // model round-trip discovering for itself.
    const [
      { count: documentsAvailable },
      { count: previousRevisionCount },
      { count: previousInvestigationCount },
      { count: previousCompletedRunCount },
    ] = await Promise.all([
      supabase
        .from("engineering_documents")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("status", "indexed"),
      supabase
        .from("product_revisions")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .neq("id", revision.id),
      supabase
        .from("investigation_events")
        .select("id", { count: "exact", head: true })
        .eq("failure_case_id", failureCase.id),
      supabase
        .from("analysis_runs")
        .select("id", { count: "exact", head: true })
        .eq("failure_case_id", failureCase.id)
        .eq("status", "completed"),
    ]);

    agentRunner = {
      // UX-04 real-time-flow fix: a generator, not an async function
      // returning a Promise — see InvestigationAgentRunner's own doc
      // comment in run-analysis.ts. investigateStreaming yields each tool
      // completion as it actually happens instead of collecting them into
      // an array only readable once the whole agent phase resolves.
      investigate: (correlationCandidates) =>
        investigateStreaming(
          {
            supabase,
            model: agentModel,
            caseContext: {
              supabase,
              product: { id: product.id, name: product.name },
              revision: { id: revision.id, label: revision.label },
              failureCase: {
                id: failureCase.id,
                title: failureCase.title,
                status: failureCase.status,
              },
              measurement: {
                id: measurement.id,
                label: measurement.label,
                operatingMode: measurement.operating_mode,
                peaks: measurement.measurement_peaks.map((row) => ({
                  id: row.id,
                  frequencyMhz: Number(row.frequency_mhz),
                  marginDb: Number(row.margin_db),
                  detector: row.detector,
                  limitLine: row.limit_line,
                })),
              },
              productFacts: productFactSummaries,
              correlationCandidates,
              priorContext: {
                previousRevisionCount: previousRevisionCount ?? 0,
                previousInvestigationCount: previousInvestigationCount ?? 0,
                previousCompletedRunCount: previousCompletedRunCount ?? 0,
              },
            },
          },
          documentsAvailable ?? 0,
          measurementInput,
        ),
    };
  }

  const { data: run, error: runError } = await supabase
    .from("analysis_runs")
    .insert({
      failure_case_id: params.failureCaseId,
      measurement_id: params.measurementId,
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) {
    return { ok: false, status: 400, message: "Could not start an analysis run." };
  }
  const runId = run.id;

  async function* persistAndYield(): AsyncGenerator<AnalysisEvent, void, void> {
    let finalStatus: "completed" | "failed" = "completed";

    for await (const event of runAnalysis(
      {
        runId,
        failureCaseId: params.failureCaseId,
        measurement: measurementInput,
        productFacts,
        productFactSummaries,
      },
      adapter,
      agentRunner,
    )) {
      // Re-validate before it's persisted or streamed — the last trust
      // boundary before this leaves the process either direction.
      const validated = analysisEventSchema.parse(event);

      if (validated.type === "run.failed") {
        finalStatus = "failed";
      }

      // FIX-03: this insert's result was previously discarded outright. A
      // failed insert left a gap in the row's own sequence numbering
      // (proven live: a hosted hypothesis.retried at sequence 15 was never
      // written while 14 and 16 either side of it were) while the event
      // still streamed to the client and reconstructFromPersistedEvents
      // rebuilds a refresh from analysis_events alone — so a client that
      // only ever saw this event live, then refreshed, silently lost it
      // with nothing in any log to explain why. Never stream what didn't
      // actually persist: skip yielding it, but keep the run itself going
      // (a single lost status event isn't fatal) and make sure an operator
      // can find out this happened.
      const { error: insertError } = await supabase.from("analysis_events").insert({
        analysis_run_id: runId,
        sequence: validated.sequence,
        event_type: validated.type,
        payload: validated.payload,
      });

      if (insertError) {
        console.error(
          `[analysis:${runId}] failed to persist ${validated.type} (sequence ${validated.sequence}): ${insertError.message}`,
        );
        continue;
      }

      yield validated;
    }

    await supabase
      .from("analysis_runs")
      .update({ status: finalStatus, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  return { ok: true, runId, events: persistAndYield() };
}
