// Typed analysis events streamed to the browser and persisted to
// analysis_events (see docs/ARCHITECTURE.md's typed event list and
// supabase/migrations/*_core_domain.sql /
// *_analysis_events_measurement_loaded.sql for the DB-side contract this
// mirrors). Every event a client receives is one of these — never a raw
// text token, never model chain-of-thought.
import { z } from "zod";
import { confidenceBandSchema, productFactCategorySchema } from "@/lib/domain/schema";
import { finalEvidenceItemSchema } from "@/lib/hypotheses/schema";

const runStartedPayloadSchema = z.object({
  failureCaseId: z.string(),
  measurementId: z.string(),
});

const measurementLoadedPayloadSchema = z.object({
  measurementId: z.string(),
  frequencyMhz: z.number(),
  marginDb: z.number(),
  operatingMode: z.string().nullable(),
});

// Mirrors HarmonicCorrelationCandidate (src/lib/correlation) field for
// field — this *is* the provenance requirement: every candidate names the
// exact ProductFact it came from.
const correlationFoundPayloadSchema = z.object({
  productFactId: z.string(),
  productFactCategory: productFactCategorySchema,
  productFactLabel: z.string(),
  sourceFrequencyMhz: z.number(),
  harmonicNumber: z.number().int(),
  expectedFrequencyMhz: z.number(),
  measuredFrequencyMhz: z.number(),
  deviationMhz: z.number(),
  deviationRatio: z.number(),
  description: z.string(),
});

// Mirrors FinalHypothesis (src/lib/hypotheses) — the OBSERVED/KNOWN/
// INFERRED/MISSING evidence array travels over the wire exactly as MVP-07
// assembled it. Nothing here lets a hypothesis appear without its evidence.
const hypothesisCreatedPayloadSchema = z.object({
  productFactId: z.string(),
  title: z.string(),
  confidenceBand: confidenceBandSchema,
  recommendedNextStep: z.string(),
  evidence: z.array(finalEvidenceItemSchema),
});

const clarificationRequiredPayloadSchema = z.object({
  question: z.string(),
});

const runCompletedPayloadSchema = z.object({
  correlationsFound: z.number().int().nonnegative(),
  hypothesesCreated: z.number().int().nonnegative(),
  clarificationRequired: z.boolean(),
});

// A safe, user-facing message only — never a raw stack trace or internal
// error detail. See sanitizeAnalysisError in run-analysis.ts.
const runFailedPayloadSchema = z.object({
  message: z.string(),
});

function eventVariant<Type extends string, Payload extends z.ZodTypeAny>(
  type: Type,
  payload: Payload,
) {
  return z.object({
    type: z.literal(type),
    runId: z.string(),
    sequence: z.number().int().nonnegative(),
    createdAt: z.string(),
    payload,
  });
}

export const analysisEventSchema = z.discriminatedUnion("type", [
  eventVariant("run.started", runStartedPayloadSchema),
  eventVariant("measurement.loaded", measurementLoadedPayloadSchema),
  eventVariant("correlation.found", correlationFoundPayloadSchema),
  eventVariant("hypothesis.created", hypothesisCreatedPayloadSchema),
  eventVariant("clarification.required", clarificationRequiredPayloadSchema),
  eventVariant("run.completed", runCompletedPayloadSchema),
  eventVariant("run.failed", runFailedPayloadSchema),
]);

export type AnalysisEvent = z.infer<typeof analysisEventSchema>;
export type AnalysisEventType = AnalysisEvent["type"];

export type RunStartedPayload = z.infer<typeof runStartedPayloadSchema>;
export type MeasurementLoadedPayload = z.infer<
  typeof measurementLoadedPayloadSchema
>;
export type CorrelationFoundPayload = z.infer<
  typeof correlationFoundPayloadSchema
>;
export type HypothesisCreatedPayload = z.infer<
  typeof hypothesisCreatedPayloadSchema
>;
export type ClarificationRequiredPayload = z.infer<
  typeof clarificationRequiredPayloadSchema
>;
export type RunCompletedPayload = z.infer<typeof runCompletedPayloadSchema>;
export type RunFailedPayload = z.infer<typeof runFailedPayloadSchema>;
