// VALIDATION-01: schemas for the benchmark harness. Two schemas that must
// never be merged into one form or one table — see
// supabase/migrations/20260901040000_benchmarks.sql's header comment for
// why the separation is structural, not just a UI convention.
import { z } from "zod";

// VISIBLE — registers an already-created failure case (built through the
// ordinary product/revision/fact/measurement flow, see
// src/lib/benchmarks/create-benchmark-case.ts) as a benchmark. Carries no
// answer of any kind.
export const benchmarkCaseInputSchema = z.object({
  failureCaseId: z.string().min(1, "Choose the failure case this benchmark investigates."),
  name: z.string().trim().min(1, "Give this benchmark case a name."),
  sourceDescription: z
    .string()
    .trim()
    .min(1, "Describe where this historical case came from."),
});
export type BenchmarkCaseInput = z.infer<typeof benchmarkCaseInputSchema>;

// HIDDEN — recorded once, at the same time as the benchmark-case
// registration above, by whoever already knows the answer. Never read by
// any investigation/agent code path (see
// src/lib/benchmarks/leakage.integration.test.ts).
export const groundTruthInputSchema = z.object({
  rootCause: z.string().trim().min(1, "State the actual root cause."),
  diagnosticActionsTaken: z
    .string()
    .trim()
    .min(1, "Describe the diagnostic actions actually taken."),
  successfulEngineeringChange: z
    .string()
    .trim()
    .min(1, "Describe the engineering change that resolved this failure."),
  finalFrequencyMhz: z.number().positive().optional(),
  finalMarginDb: z.number().optional(),
  finalOutcomeNotes: z.string().trim().optional(),
});
export type GroundTruthInput = z.infer<typeof groundTruthInputSchema>;

// The blind expert scoring form (ticket's exact five fields) — filled in
// after reading one analysis run's output, before ground truth is
// revealed.
export const expertScoreInputSchema = z.object({
  nextActionUseful: z.number().int().min(1).max(5),
  hypothesesUseful: z.number().int().min(1).max(5),
  misleading: z.boolean(),
  wouldChangeNextAction: z.boolean(),
  comments: z.string().trim().optional(),
});
export type ExpertScoreInput = z.infer<typeof expertScoreInputSchema>;
