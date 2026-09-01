// VALIDATION-01: loads one analysis run's persisted events for benchmark
// metrics/report purposes — the exact same read + "skip, don't trust"
// parse pattern src/lib/investigation/queries.ts already uses for the live
// workspace, just addressed by a specific analysis_run_id instead of "the
// latest run for this case."
import { createClient } from "@/lib/supabase/server";
import { analysisEventSchema, type AnalysisEvent } from "@/lib/analysis/events";

export async function loadRunEvents(analysisRunId: string): Promise<AnalysisEvent[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("analysis_events")
    .select("event_type, sequence, created_at, payload")
    .eq("analysis_run_id", analysisRunId)
    .order("sequence", { ascending: true });

  return (rows ?? []).flatMap((row) => {
    const parsed = analysisEventSchema.safeParse({
      type: row.event_type,
      runId: analysisRunId,
      sequence: row.sequence,
      createdAt: row.created_at,
      payload: row.payload,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
