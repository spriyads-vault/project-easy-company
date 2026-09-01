// The investigation timeline (MVP-11): a chronological, auditable merge of
// every measurement, hypothesis (across *all* runs, not just the latest),
// and engineer observation recorded for a failure case. This is what makes
// "the previous state must remain auditable" true in the UI, not just in
// Postgres — old analysis_runs/analysis_events/investigation_events rows
// are never rewritten or deleted (see record-observation.ts and
// run-analysis.ts), so this query only ever reads; it never mutates
// anything.
//
// Takes an already-authenticated Supabase client as a parameter — like
// MVP-10A's listEngineeringDocuments/searchEngineeringDocuments, not the
// older cookie-based cases/queries.ts convention — specifically so this is
// directly integration-testable (see timeline.integration.test.ts), which
// "old hypothesis remains historical" needs to prove against real Postgres,
// not a hand-built fixture.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ConfidenceBand } from "@/lib/domain/schema";
import type { HypothesisUpdate } from "@/lib/hypotheses/schema";
import { analysisEventSchema } from "@/lib/analysis/events";

export type TimelineEntry =
  | {
      type: "measurement";
      id: string;
      createdAt: string;
      label: string | null;
      frequencyMhz: number;
      marginDb: number;
    }
  | {
      type: "hypothesis";
      id: string;
      createdAt: string;
      title: string;
      confidenceBand: ConfidenceBand;
      recommendedNextStep: string;
      update: HypothesisUpdate | null;
    }
  | {
      type: "observation";
      id: string;
      createdAt: string;
      observation: string;
      measurementChange: string | null;
    };

const MAX_TIMELINE_ENTRIES_PER_SOURCE = 50;

export async function getInvestigationTimeline(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  const { data: measurements } = await supabase
    .from("measurements")
    .select("id, label, created_at, measurement_peaks(frequency_mhz, margin_db)")
    .eq("failure_case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  for (const row of measurements ?? []) {
    const peak = row.measurement_peaks[0];
    if (!peak) continue;
    entries.push({
      type: "measurement",
      id: row.id,
      createdAt: row.created_at,
      label: row.label,
      frequencyMhz: Number(peak.frequency_mhz),
      marginDb: Number(peak.margin_db),
    });
  }

  // Hypotheses across every run for this case — deliberately not scoped to
  // "latest run only" (that's what the main Investigation panel shows).
  // History here is what proves an earlier hypothesis was never rewritten,
  // only ever followed by a new one.
  const { data: runs } = await supabase
    .from("analysis_runs")
    .select("id")
    .eq("failure_case_id", caseId)
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  const runIds = (runs ?? []).map((run) => run.id);
  if (runIds.length > 0) {
    const { data: events } = await supabase
      .from("analysis_events")
      .select("analysis_run_id, sequence, created_at, payload")
      .in("analysis_run_id", runIds)
      .eq("event_type", "hypothesis.created")
      .order("created_at", { ascending: true })
      .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
    for (const row of events ?? []) {
      const parsed = analysisEventSchema.safeParse({
        type: "hypothesis.created",
        runId: row.analysis_run_id,
        sequence: row.sequence,
        createdAt: row.created_at,
        payload: row.payload,
      });
      if (!parsed.success || parsed.data.type !== "hypothesis.created") continue;
      entries.push({
        type: "hypothesis",
        id: `${row.analysis_run_id}:${row.sequence}`,
        createdAt: row.created_at,
        title: parsed.data.payload.title,
        confidenceBand: parsed.data.payload.confidenceBand,
        recommendedNextStep: parsed.data.payload.recommendedNextStep,
        update: parsed.data.payload.update ?? null,
      });
    }
  }

  const { data: observations } = await supabase
    .from("investigation_events")
    .select("id, created_at, payload, description")
    .eq("failure_case_id", caseId)
    .eq("event_type", "observation")
    .order("created_at", { ascending: true })
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  for (const row of observations ?? []) {
    const payload = row.payload as { observation?: string; measurementChange?: string | null };
    entries.push({
      type: "observation",
      id: row.id,
      createdAt: row.created_at,
      // Falls back to the stored description for a row whose payload
      // predates this structured shape — never blank.
      observation: payload.observation ?? row.description,
      measurementChange: payload.measurementChange ?? null,
    });
  }

  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return entries;
}
