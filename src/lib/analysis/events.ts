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

// The Investigation Agent's observable activity (MVP-10B) — never the
// model's raw reasoning tokens. "agent.started" fires once the deterministic
// correlations are in hand and the agent begins gathering additional
// context; correlationCount lets the UI show what it's investigating
// against without repeating the correlation.found events.
const agentStartedPayloadSchema = z.object({
  correlationCount: z.number().int().nonnegative(),
});

// One per tool call the agent actually made. resultCount/query are omitted
// (null) where not meaningful for a given tool (e.g. getMeasurementContext
// has no query and returns a single object, not a list) — never fabricated
// to fill the field. label is a safe, pre-written display string, never
// model-generated text.
const agentToolCompletedPayloadSchema = z.object({
  toolName: z.string(),
  label: z.string(),
  resultCount: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  query: z.string().nullable(),
});

// Truthful, actually-computed UX metrics for MVP-10C — every number here is
// counted from real execution of this run, never a placeholder. See
// src/lib/agents/validate-agent-output.ts.
const agentCompletedPayloadSchema = z.object({
  documentsAvailable: z.number().int().nonnegative(),
  documentSearches: z.number().int().nonnegative(),
  passagesRetrieved: z.number().int().nonnegative(),
  passagesUsedAsEvidence: z.number().int().nonnegative(),
  deterministicRelationshipsChecked: z.number().int().nonnegative(),
  nextInvestigationCount: z.number().int().nonnegative(),
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
  eventVariant("agent.started", agentStartedPayloadSchema),
  eventVariant("agent.tool.completed", agentToolCompletedPayloadSchema),
  eventVariant("agent.completed", agentCompletedPayloadSchema),
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
export type AgentStartedPayload = z.infer<typeof agentStartedPayloadSchema>;
export type AgentToolCompletedPayload = z.infer<
  typeof agentToolCompletedPayloadSchema
>;
export type AgentCompletedPayload = z.infer<typeof agentCompletedPayloadSchema>;
