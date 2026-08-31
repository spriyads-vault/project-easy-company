// Zod contracts for the AI structured hypothesis service (MVP-07). These
// govern exactly what crosses the model boundary in both directions — see
// src/lib/ai/provider.ts (the adapter that calls a real model) and
// src/lib/hypotheses/generate-hypotheses.ts (the orchestration that merges
// the model's output with deterministic evidence).
//
// Load-bearing design choice: the model's output schema has no field for
// OBSERVED or KNOWN evidence at all. It can only supply "reasoning" (an
// inference) and "missingEvidence" (open questions). OBSERVED and KNOWN
// evidence are populated exclusively by the deterministic pipeline from
// real measurement/fact rows. This makes "the model converts an inference
// into a fact" structurally impossible, not just discouraged by a prompt.
import { z } from "zod";
import { confidenceBandSchema, productFactCategorySchema } from "@/lib/domain/schema";

// ---- What the deterministic pipeline hands to the model ----

export const correlationCandidateContextSchema = z.object({
  productFactId: z.string(),
  productFactCategory: productFactCategorySchema,
  productFactLabel: z.string(),
  sourceFrequencyMhz: z.number(),
  harmonicNumber: z.number().int(),
  expectedFrequencyMhz: z.number(),
  deviationRatio: z.number(),
  description: z.string(),
});
export type CorrelationCandidateContext = z.infer<
  typeof correlationCandidateContextSchema
>;

export const productFactContextSchema = z.object({
  id: z.string(),
  category: productFactCategorySchema,
  label: z.string(),
  /** Human-readable one-liner, precomputed by the app — never raw jsonb. */
  summary: z.string(),
});
export type ProductFactContext = z.infer<typeof productFactContextSchema>;

export const measurementContextSchema = z.object({
  frequencyMhz: z.number(),
  marginDb: z.number(),
  operatingMode: z.string().nullable(),
});
export type MeasurementContext = z.infer<typeof measurementContextSchema>;

export const hypothesisGenerationInputSchema = z.object({
  measurement: measurementContextSchema,
  correlationCandidates: z.array(correlationCandidateContextSchema),
  productFacts: z.array(productFactContextSchema),
});
export type HypothesisGenerationInput = z.infer<
  typeof hypothesisGenerationInputSchema
>;

// ---- What the model must produce ----

export const modelHypothesisSchema = z.object({
  productFactId: z
    .string()
    .describe(
      "Must exactly match the productFactId of one of the correlationCandidates given in the input. Never invent one.",
    ),
  title: z.string().trim().min(1).max(140),
  confidenceBand: confidenceBandSchema,
  reasoning: z
    .string()
    .trim()
    .min(1)
    .max(600)
    .describe(
      "A concise inference, never a certainty claim. Never state this is confirmed, proven, or the definitive root cause — you have no access to the physical device.",
    ),
  missingEvidence: z
    .array(z.string().trim().min(1).max(200))
    .max(5)
    .describe(
      "What an engineer would need to check to support or rule this hypothesis out.",
    ),
  recommendedNextStep: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe(
      "A suggestion for a qualified engineer to investigate further — never an instruction to certify, ship, or declare compliance.",
    ),
});
export type ModelHypothesis = z.infer<typeof modelHypothesisSchema>;

export const hypothesisGenerationOutputSchema = z.object({
  hypotheses: z.array(modelHypothesisSchema).max(5),
  clarificationQuestion: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .nullable()
    .describe(
      "Only non-null if one missing fact would materially change the ranking.",
    ),
});
export type HypothesisGenerationOutput = z.infer<
  typeof hypothesisGenerationOutputSchema
>;

// ---- The assembled result the rest of the app consumes ----

export const finalEvidenceItemSchema = z.object({
  category: z.enum(["observed", "known", "inferred", "missing"]),
  description: z.string(),
});
export type FinalEvidenceItem = z.infer<typeof finalEvidenceItemSchema>;

export const finalHypothesisSchema = z.object({
  productFactId: z.string(),
  title: z.string(),
  confidenceBand: confidenceBandSchema,
  recommendedNextStep: z.string(),
  evidence: z.array(finalEvidenceItemSchema),
});
export type FinalHypothesis = z.infer<typeof finalHypothesisSchema>;
