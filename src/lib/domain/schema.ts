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
  frequencyMhz: z.number().positive("Frequency must be greater than 0 MHz."),
  marginDb: z.number(),
  detector: z.string().trim().min(1).optional(),
  limitLine: z.string().trim().min(1).optional(),
});
export type MeasurementPeakInput = z.infer<typeof measurementPeakInputSchema>;

export const measurementInputSchema = z.object({
  operatingMode: z
    .string()
    .trim()
    .min(1, "Describe what the product was doing during this measurement."),
  label: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  peak: measurementPeakInputSchema,
});
export type MeasurementInput = z.infer<typeof measurementInputSchema>;

// Per-category fact shapes. `fact` is stored as jsonb (see
// supabase/migrations/20260831035611_core_domain.sql) so new categories or
// fields don't need a migration, but every category the app actually
// supports gets a real, validated shape here rather than an open bag of
// properties.
export const clockFactSchema = z.object({
  label: z.string().trim().min(1, "Give this clock a label."),
  frequencyMhz: z.number().positive("Frequency must be greater than 0."),
});
export type ClockFact = z.infer<typeof clockFactSchema>;

export const radioFactSchema = z.object({
  label: z.string().trim().min(1, "Give this radio a label."),
  technology: z
    .string()
    .trim()
    .min(1, "e.g. WiFi 2.4GHz, BLE, LoRa."),
  frequencyMhz: z.number().positive().optional(),
});
export type RadioFact = z.infer<typeof radioFactSchema>;

export const powerFactSchema = z.object({
  label: z.string().trim().min(1, "Give this power rail a label."),
  topology: z
    .string()
    .trim()
    .min(1, "e.g. switching regulator, linear regulator."),
  switchingFrequencyMhz: z.number().positive().optional(),
});
export type PowerFact = z.infer<typeof powerFactSchema>;

export const cableFactSchema = z.object({
  label: z.string().trim().min(1, "Give this cable/connector a label."),
  shielded: z.boolean(),
});
export type CableFact = z.infer<typeof cableFactSchema>;

export const otherFactSchema = z.object({
  label: z.string().trim().min(1, "Give this fact a label."),
  notes: z.string().trim().min(1).optional(),
});
export type OtherFact = z.infer<typeof otherFactSchema>;

export const factSourceSchema = z.enum(["user_entered", "extracted"]);
export type FactSource = z.infer<typeof factSourceSchema>;

// Discriminated on `category` so a clock fact can never be missing
// frequencyMhz, a cable fact can never be missing shielded, etc.
export const productFactInputSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal("clock"),
    fact: clockFactSchema,
    source: factSourceSchema.default("user_entered"),
  }),
  z.object({
    category: z.literal("radio"),
    fact: radioFactSchema,
    source: factSourceSchema.default("user_entered"),
  }),
  z.object({
    category: z.literal("power"),
    fact: powerFactSchema,
    source: factSourceSchema.default("user_entered"),
  }),
  z.object({
    category: z.literal("cable"),
    fact: cableFactSchema,
    source: factSourceSchema.default("user_entered"),
  }),
  z.object({
    category: z.literal("other"),
    fact: otherFactSchema,
    source: factSourceSchema.default("user_entered"),
  }),
]);
export type ProductFactInput = z.infer<typeof productFactInputSchema>;
