// VALIDATION-01: the one explicit, deliberate action that's allowed to read
// benchmark_ground_truth for display. Guarded server-side (not just in the
// UI) — reveal is refused unless at least one blind expert score already
// exists for this benchmark case, so the order "score first, then reveal"
// can't be skipped by calling this action directly.
//
// Takes an optional Supabase client (see create-benchmark-case.ts for why)
// so integration tests can exercise the "score first" guard directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getGroundTruth, type GroundTruth } from "./ground-truth";

export interface RevealGroundTruthResult {
  ok: boolean;
  groundTruth?: GroundTruth;
  message?: string;
}

export async function revealGroundTruth(
  benchmarkCaseId: string,
  suppliedClient?: SupabaseClient<Database>,
): Promise<RevealGroundTruthResult> {
  const supabase = suppliedClient ?? (await createClient());

  const { count } = await supabase
    .from("benchmark_expert_scores")
    .select("id", { count: "exact", head: true })
    .eq("benchmark_case_id", benchmarkCaseId);
  if (!count || count === 0) {
    return {
      ok: false,
      message: "Score at least one investigation run before revealing ground truth.",
    };
  }

  const groundTruth = await getGroundTruth(benchmarkCaseId, supabase);
  if (!groundTruth) {
    return { ok: false, message: "No ground truth is recorded for this benchmark case." };
  }

  await supabase
    .from("benchmark_cases")
    .update({ status: "revealed", revealed_at: new Date().toISOString() })
    .eq("id", benchmarkCaseId)
    .is("revealed_at", null);

  return { ok: true, groundTruth };
}
