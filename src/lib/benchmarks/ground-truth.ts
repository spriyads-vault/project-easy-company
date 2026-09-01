// VALIDATION-01: the ONLY module in this codebase that reads or writes
// benchmark_ground_truth. No file under src/lib/agents, src/lib/analysis,
// or src/lib/investigation imports this module or queries this table —
// that is what makes "hidden ground truth can never enter agent context"
// true by construction rather than by policy. See
// src/lib/benchmarks/leakage.integration.test.ts, which asserts this
// directly against a running investigation.
//
// Every function here requires an explicit, separate call from a
// deliberate "reveal" action (see src/app/benchmarks/[benchmarkCaseId]/
// actions.ts) — nothing in the ordinary case/investigation read paths ever
// reaches this file.
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { GroundTruthInput } from "./schema";

export interface GroundTruth {
  benchmarkCaseId: string;
  rootCause: string;
  diagnosticActionsTaken: string;
  successfulEngineeringChange: string;
  finalFrequencyMhz: number | null;
  finalMarginDb: number | null;
  finalOutcomeNotes: string | null;
}

/** Recorded once, immediately after the benchmark case itself is created
 * (see create-benchmark-case.ts) — by whoever built the benchmark and
 * already knows the answer. Takes a caller-supplied client so it can be
 * called from the same server action, in the same request, right after the
 * benchmark_cases insert. */
export async function recordGroundTruth(
  supabase: SupabaseClient<Database>,
  benchmarkCaseId: string,
  input: GroundTruthInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("benchmark_ground_truth").insert({
    benchmark_case_id: benchmarkCaseId,
    root_cause: input.rootCause,
    diagnostic_actions_taken: input.diagnosticActionsTaken,
    successful_engineering_change: input.successfulEngineeringChange,
    final_frequency_mhz: input.finalFrequencyMhz ?? null,
    final_margin_db: input.finalMarginDb ?? null,
    final_outcome_notes: input.finalOutcomeNotes ?? null,
  });
  if (error) {
    return { ok: false, message: "Could not save the ground truth record." };
  }
  return { ok: true };
}

/** Only ever called from the explicit "reveal ground truth" action, which
 * itself requires an expert score to already exist first — see
 * src/app/benchmarks/[benchmarkCaseId]/actions.ts's revealGroundTruth. Takes
 * an optional client for the same integration-testability reason as
 * recordGroundTruth above. */
export async function getGroundTruth(
  benchmarkCaseId: string,
  suppliedClient?: SupabaseClient<Database>,
): Promise<GroundTruth | null> {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase
    .from("benchmark_ground_truth")
    .select(
      "benchmark_case_id, root_cause, diagnostic_actions_taken, successful_engineering_change, final_frequency_mhz, final_margin_db, final_outcome_notes",
    )
    .eq("benchmark_case_id", benchmarkCaseId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    benchmarkCaseId: data.benchmark_case_id,
    rootCause: data.root_cause,
    diagnosticActionsTaken: data.diagnostic_actions_taken,
    successfulEngineeringChange: data.successful_engineering_change,
    finalFrequencyMhz: data.final_frequency_mhz === null ? null : Number(data.final_frequency_mhz),
    finalMarginDb: data.final_margin_db === null ? null : Number(data.final_margin_db),
    finalOutcomeNotes: data.final_outcome_notes,
  };
}
