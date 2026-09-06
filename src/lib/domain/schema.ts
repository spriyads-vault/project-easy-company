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

// Qualitative-only, deliberately (MVP-11): whether a follow-up investigation
// run's evidence supports, weakens, leaves unchanged, or still needs more
// evidence for a hypothesis proposed in an earlier run. No Bayesian/
// probability claim is implemented, so none is exposed here — see
// docs/PROGRESS.md's MVP-11 entry.
export const hypothesisUpdateStatusSchema = z.enum([
  "supported_by_new_evidence",
  "weakened_by_new_evidence",
  "unchanged",
  "needs_more_evidence",
]);
export type HypothesisUpdateStatus = z.infer<typeof hypothesisUpdateStatusSchema>;

// Matches the typed event list in docs/ARCHITECTURE.md and CLAUDE.md, and
// the analysis_events.event_type check constraint (see
// supabase/migrations/20260831035611_core_domain.sql and
// .../*_analysis_events_measurement_loaded.sql). "measurement.parsed" is
// reserved for a future document-extraction ticket (MVP-13); MVP-08's
// analysis run reads an already-persisted measurement, hence
// "measurement.loaded".
export const analysisEventTypeSchema = z.enum([
  "run.started",
  "product.fact_detected",
  "measurement.parsed",
  "measurement.loaded",
  "correlation.found",
  "clarification.required",
  "hypothesis.retried",
  "hypothesis.created",
  "hypothesis.updated",
  "observation.recorded",
  "change.recorded",
  "measurement.compared",
  "regulatory_state.updated",
  "agent.started",
  "agent.tool.completed",
  "agent.completed",
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

// The "RECORD RESULT" form (MVP-11): a structured engineer observation
// following up on a hypothesis's recommended next investigation — never a
// chatbot textarea. `observation` is the required "what was done/seen"
// line; the rest are optional structured detail. Persisted to
// investigation_events (event_type: "observation") and, on the next agent
// run, surfaced back as new OBSERVED evidence (see
// src/lib/agents/validate-agent-output.ts) — never silently promoted into a
// KNOWN product fact or any other claim beyond what was literally entered.
export const investigationObservationInputSchema = z.object({
  observation: z
    .string()
    .trim()
    .min(1, "Describe what was done or observed.")
    .max(500),
  measurementChange: z.string().trim().min(1).max(300).optional(),
  operatingMode: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
});
export type InvestigationObservationInput = z.infer<
  typeof investigationObservationInputSchema
>;

// The "RECORD ENGINEERING CHANGE" form (MVP-11, "Engineering change and
// second measurement"): structured input, never a chatbot textarea.
// Recording a change is what creates the new revision (see
// src/lib/engineering-changes/create-engineering-change.ts) — `newRevisionLabel`
// is the one field that isn't part of the change record itself but is
// required to do that. Only `title`/`description`/`newRevisionLabel` are
// required; the rest describe the change without inventing a value the
// engineer didn't actually supply.
export const engineeringChangeInputSchema = z.object({
  title: z.string().trim().min(1, "Give this change a title.").max(200),
  description: z
    .string()
    .trim()
    .min(1, "Describe the change.")
    .max(2000),
  affectedSubsystem: z.string().trim().min(1).max(200).optional(),
  previousValue: z.string().trim().min(1).max(300).optional(),
  newValue: z.string().trim().min(1).max(300).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
  newRevisionLabel: z
    .string()
    .trim()
    .min(1, "Give the new revision a label.")
    .max(100),
});
export type EngineeringChangeInput = z.infer<typeof engineeringChangeInputSchema>;

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

// ---- Engineering Knowledge Base (MVP-10A) ----

export const documentTypeSchema = z.enum([
  "schematic",
  "pcb",
  "test_report",
  "datasheet",
  "regulatory",
  "mechanical",
  "engineering_note",
  "other",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const documentSourceSchema = z.enum(["user_upload", "external_reference"]);
export type DocumentSource = z.infer<typeof documentSourceSchema>;

export const documentStatusSchema = z.enum([
  "uploading",
  "processing",
  "indexed",
  "failed",
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

// Narrow on purpose: extraction only, no OCR/CAD parsing (see
// src/lib/documents/extract-text.ts).
export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;
export const documentMimeTypeSchema = z.enum(SUPPORTED_DOCUMENT_MIME_TYPES);
export type SupportedDocumentMimeType = z.infer<typeof documentMimeTypeSchema>;

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB — well under the
// bucket's 50MiB config limit; keeps synchronous ingestion (no queue for
// MVP) responsive.

export const uploadDocumentInputSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: documentMimeTypeSchema,
  byteSize: z
    .number()
    .int()
    .positive()
    .max(MAX_DOCUMENT_BYTES, "File is larger than the 20MB limit."),
  documentType: documentTypeSchema,
  productId: z.string().trim().min(1).optional(),
  productRevisionId: z.string().trim().min(1).optional(),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentInputSchema>;

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
