// Zod schemas for the core domain objects (see docs/ARCHITECTURE.md and
// CLAUDE.md "Core domain objects"). These are the model-facing and
// form-facing contracts; the database migration in
// supabase/migrations/20260831035611_core_domain.sql is the source of truth
// for persistence and enforces the same constraints server-side.
import { z } from "zod";

export const productFactCategorySchema = z.enum([
  "clock",
  "radio",
  "power",
  "cable",
  "other",
]);
export type ProductFactCategory = z.infer<typeof productFactCategorySchema>;

export const evidenceCategorySchema = z.enum([
  "observed",
  "known",
  "inferred",
  "missing",
]);
export type EvidenceCategory = z.infer<typeof evidenceCategorySchema>;

export const confidenceBandSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;

// Matches the typed event list in docs/ARCHITECTURE.md and CLAUDE.md, and
// the analysis_events.event_type check constraint.
export const analysisEventTypeSchema = z.enum([
  "run.started",
  "product.fact_detected",
  "measurement.parsed",
  "correlation.found",
  "clarification.required",
  "hypothesis.created",
  "hypothesis.updated",
  "observation.recorded",
  "change.recorded",
  "measurement.compared",
  "regulatory_state.updated",
  "run.completed",
  "run.failed",
]);
export type AnalysisEventType = z.infer<typeof analysisEventTypeSchema>;

export const investigationEventTypeSchema = z.enum([
  "case_opened",
  "observation",
  "engineering_change",
  "measurement_recorded",
  "note",
]);
export type InvestigationEventType = z.infer<
  typeof investigationEventTypeSchema
>;

export const measurementPeakInputSchema = z.object({
  frequencyMhz: z.number().positive(),
  marginDb: z.number(),
  detector: z.string().trim().min(1).optional(),
  limitLine: z.string().trim().min(1).optional(),
});
export type MeasurementPeakInput = z.infer<typeof measurementPeakInputSchema>;

export const productFactInputSchema = z.object({
  category: productFactCategorySchema,
  fact: z.record(z.string(), z.unknown()),
  source: z.enum(["user_entered", "extracted"]).default("user_entered"),
});
export type ProductFactInput = z.infer<typeof productFactInputSchema>;
