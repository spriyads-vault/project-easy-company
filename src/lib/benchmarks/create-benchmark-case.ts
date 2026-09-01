// VALIDATION-01: registers an already-built failure case (product,
// revision, facts, first measurement — created through the ordinary
// product/case/measurement flow, never through benchmark-specific code) as
// a benchmark, and records its ground truth in the same request. The two
// writes are deliberately sequential and separately named so the
// visible/hidden boundary reads clearly at the call site, even though they
// happen together here — record-ground-truth.ts's own module boundary is
// what actually enforces the isolation, not this function's structure.
//
// Takes an optional Supabase client (defaulting to the request-scoped one)
// the same way src/lib/analysis/create-analysis-run.ts does — that's what
// lets an integration test call this directly with a signed-in test
// client, outside any Next.js request, instead of only being reachable
// through a server action.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { recordGroundTruth } from "./ground-truth";
import type { BenchmarkCaseInput, GroundTruthInput } from "./schema";

export interface CreateBenchmarkCaseResult {
  ok: boolean;
  benchmarkCaseId?: string;
  message?: string;
}

export async function createBenchmarkCase(
  visible: BenchmarkCaseInput,
  hidden: GroundTruthInput,
  suppliedClient?: SupabaseClient<Database>,
): Promise<CreateBenchmarkCaseResult> {
  const supabase = suppliedClient ?? (await createClient());

  // The composite FK on benchmark_cases(failure_case_id, workspace_id)
  // rejects this outright if failureCaseId isn't a real case in this
  // workspace — never trust the client-supplied id beyond that.
  const { data: benchmarkCase, error: caseError } = await supabase
    .from("benchmark_cases")
    .insert({
      failure_case_id: visible.failureCaseId,
      name: visible.name,
      source_description: visible.sourceDescription,
    })
    .select("id")
    .single();
  if (caseError || !benchmarkCase) {
    return { ok: false, message: "Could not register this benchmark case." };
  }

  const groundTruthResult = await recordGroundTruth(supabase, benchmarkCase.id, hidden);
  if (!groundTruthResult.ok) {
    // Compensate: never leave a benchmark case registered with no ground
    // truth behind it — the same "don't leave a half-written row" pattern
    // as add-measurement-form's action compensating for a failed peak
    // insert.
    await supabase.from("benchmark_cases").delete().eq("id", benchmarkCase.id);
    return { ok: false, message: groundTruthResult.message };
  }

  return { ok: true, benchmarkCaseId: benchmarkCase.id };
}
