// Typed analysis events streamed to the browser and persisted to
// analysis_events (see docs/ARCHITECTURE.md's typed event list and
// supabase/migrations/*_core_domain.sql /
// *_analysis_events_measurement_loaded.sql for the DB-side contract this
// mirrors). Every event a client receives is one of these — never a raw
// text token, never model chain-of-thought.
import { z } from "zod";
import { confidenceBandSchema, productFactCategorySchema } from "@/lib/domain/schema";
import { finalEvidenceItemSchema, hypothesisUpdateSchema } from "@/lib/hypotheses/schema";

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
  // MVP-11, optional/additive: set only when this hypothesis is a follow-up
  // run's continuation of one proposed earlier for the same case.
  update: hypothesisUpdateSchema.optional(),
});

const clarificationRequiredPayloadSchema = z.object({
  question: z.string(),
});

// FIX-01: fired when a completed hypothesis-generation attempt returned zero
// hypotheses and no clarification question while correlation candidates
// existed — almost certainly a miss rather than a considered answer (see
// generate-hypotheses.ts), so run-analysis.ts retries exactly once. This
// event makes that retry observable rather than a silent doubled model call;
// it never fires when there are zero correlation candidates (the
// deterministic gate is untouched) or when the model instead returned a
// clarification question (a considered answer, not a miss).
const hypothesisRetriedPayloadSchema = z.object({
  correlationCount: z.number().int().positive(),
});

// The Investigation Agent's observable activity (MVP-10B) — never the
// model's raw reasoning tokens. "agent.started" fires once the deterministic
// correlations are in hand and the agent begins gathering additional
// context; correlationCount lets the UI show what it's investigating
// against without repeating the correlation.found events.
const agentStartedPayloadSchema = z.object({
  correlationCount: z.number().int().nonnegative(),
});

// UX-05 Workstream C: fired at the real server execution boundary,
// immediately before a tool's execute() begins (bridged from the AI SDK's
// own `onToolExecutionStart` callback — see investigateStreaming in
// investigation-agent.ts) — never a client-side timer or an inferred
// "must have started because nothing else is happening" guess. label is a
// safe, pre-written, present-tense display string, never model-generated
// text; toolCallId is the AI SDK's own per-call id, carried through to the
// matching agent.tool.completed/failed event so the client can pair
// start/end without inferring anything from ordering alone.
const agentToolStartedPayloadSchema = z.object({
  toolName: z.string(),
  label: z.string(),
  query: z.string().nullable(),
  toolCallId: z.string(),
});

// One per tool call the agent actually made. resultCount/query are omitted
// (null) where not meaningful for a given tool (e.g. getMeasurementContext
// has no query and returns a single object, not a list) — never fabricated
// to fill the field. label is a safe, pre-written display string, never
// model-generated text. toolCallId is optional only so an already-persisted
// pre-UX-05 row (with no started/paired id) still parses on refresh.
const agentToolCompletedPayloadSchema = z.object({
  toolName: z.string(),
  label: z.string(),
  resultCount: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  query: z.string().nullable(),
  toolCallId: z.string().optional(),
  /** True only when this tool call genuinely errored — a truthful failed
   * step in the Investigation Trace, never silently folded into a normal
   * completion. */
  failed: z.boolean().optional(),
});

// Truthful, actually-computed UX metrics for MVP-10C — every number here is
// counted from real execution of this run, never a placeholder. See
// src/lib/agents/validate-agent-output.ts.
//
// PERF-01: the five timing/step fields below are optional, not because
// they're ever conditionally computed by new code (runInvestigationAgent
// always fills them in) but so a pre-PERF-01 agent.completed row already
// persisted in analysis_events still parses on refresh — see
// getInvestigationWorkspaceData's "skip, don't trust" convention for old
// rows lacking a field a schema later added. Never expose model reasoning
// tokens or prompts here, only wall-clock counters.
const agentCompletedPayloadSchema = z.object({
  documentsAvailable: z.number().int().nonnegative(),
  documentSearches: z.number().int().nonnegative(),
  passagesRetrieved: z.number().int().nonnegative(),
  passagesUsedAsEvidence: z.number().int().nonnegative(),
  deterministicRelationshipsChecked: z.number().int().nonnegative(),
  nextInvestigationCount: z.number().int().nonnegative(),
  stepCount: z.number().int().nonnegative().optional(),
  totalDurationMs: z.number().int().nonnegative().optional(),
  modelDurationMs: z.number().int().nonnegative().optional(),
  toolDurationMs: z.number().int().nonnegative().optional(),
  retrievalDurationMs: z.number().int().nonnegative().optional(),
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
  eventVariant("hypothesis.retried", hypothesisRetriedPayloadSchema),
  eventVariant("agent.started", agentStartedPayloadSchema),
  eventVariant("agent.tool.started", agentToolStartedPayloadSchema),
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
export type HypothesisRetriedPayload = z.infer<
  typeof hypothesisRetriedPayloadSchema
>;
export type RunCompletedPayload = z.infer<typeof runCompletedPayloadSchema>;
export type RunFailedPayload = z.infer<typeof runFailedPayloadSchema>;
export type AgentStartedPayload = z.infer<typeof agentStartedPayloadSchema>;
export type AgentToolStartedPayload = z.infer<typeof agentToolStartedPayloadSchema>;
export type AgentToolCompletedPayload = z.infer<
  typeof agentToolCompletedPayloadSchema
>;
export type AgentCompletedPayload = z.infer<typeof agentCompletedPayloadSchema>;
