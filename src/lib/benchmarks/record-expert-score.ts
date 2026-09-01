// VALIDATION-01: the blind scoring step — recorded from what an expert saw
// in the normal investigation workspace, before ground truth is ever
// revealed. Deliberately takes no ground-truth input of any kind; this
// module doesn't import src/lib/benchmarks/ground-truth.ts at all.
//
// Takes an optional Supabase client (see create-benchmark-case.ts for why)
// so integration tests can exercise the duplicate-score guard directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ExpertScoreInput } from "./schema";

export interface RecordExpertScoreResult {
  ok: boolean;
  message?: string;
}

export async function recordExpertScore(
  benchmarkCaseId: string,
  analysisRunId: string,
  input: ExpertScoreInput,
  suppliedClient?: SupabaseClient<Database>,
): Promise<RecordExpertScoreResult> {
  const supabase = suppliedClient ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to score an investigation." };
  }

  const { error } = await supabase.from("benchmark_expert_scores").insert({
    benchmark_case_id: benchmarkCaseId,
    analysis_run_id: analysisRunId,
    next_action_useful: input.nextActionUseful,
    hypotheses_useful: input.hypothesesUseful,
    misleading: input.misleading,
    would_change_next_action: input.wouldChangeNextAction,
    comments: input.comments ?? null,
    scored_by: user.id,
  });
  if (error) {
    // Unique (analysis_run_id, workspace_id) rejects a second score for the
    // same run — re-run the investigation to get a new run to score
    // instead of overwriting a blind score after the fact.
    return {
      ok: false,
      message: error.code === "23505"
        ? "This run has already been scored."
        : "Could not save the score.",
    };
  }

  // Best-effort status bump — never blocks the score itself on this
  // succeeding, and never regresses a case that's already further along
  // (e.g. already revealed) back to "scored".
  await supabase
    .from("benchmark_cases")
    .update({ status: "scored" })
    .eq("id", benchmarkCaseId)
    .eq("status", "created");

  return { ok: true };
}
