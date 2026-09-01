// Zod contracts for the Investigation Agent (MVP-10B). Mirrors the
// load-bearing design choice in src/lib/hypotheses/schema.ts: the model can
// only supply an inference (reasoning), pointers to evidence it retrieved
// (evidenceRefs), and open questions (missingEvidence/clarificationQuestion)
// — never an OBSERVED or KNOWN item's actual text. Those are always
// assembled deterministically by src/lib/agents/validate-agent-output.ts
// from real tool-call results, keyed by IDs the model must have actually
// received this run. A citation the model invents, or one that points to an
// ID never returned by a tool call, is dropped before it ever reaches a
// user — see validate-agent-output.ts.
import { z } from "zod";
import { confidenceBandSchema, hypothesisUpdateStatusSchema } from "@/lib/domain/schema";

// ---- What a tool call can be cited back to ----

export const agentEvidenceRefSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("document_passage"),
    chunkId: z.string().trim().min(1),
    documentId: z.string().trim().min(1),
  }),
  z.object({
    sourceType: z.literal("product_fact"),
    productFactId: z.string().trim().min(1),
  }),
  z.object({
    sourceType: z.literal("previous_investigation"),
    investigationEventId: z.string().trim().min(1),
  }),
]);
export type AgentEvidenceRef = z.infer<typeof agentEvidenceRefSchema>;

// ---- What the agent must produce (Output.object schema) ----

export const agentHypothesisSchema = z.object({
  productFactId: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Must exactly match the productFactId of one candidate returned by getDeterministicCorrelations. Never invent one.",
    ),
  title: z.string().trim().min(1).max(140),
  confidenceBand: confidenceBandSchema,
  reasoning: z
    .string()
    .trim()
    .min(1)
    .max(1200)
    .describe(
      "A concise inference, never a certainty claim. Never state this is confirmed, proven, or the definitive root cause — you have no access to the physical device.",
    ),
  evidenceRefs: z
    .array(agentEvidenceRefSchema)
    .max(8)
    .describe(
      "Only cite an id you actually received back from a tool call this run (a document passage's chunkId, a product fact's id, or a previous investigation event's id). Never invent one.",
    ),
  missingEvidence: z
    .array(z.string().trim().min(1).max(200))
    .max(5)
    .describe(
      "What an engineer would need to check to support or rule this hypothesis out.",
    ),
  nextInvestigation: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "A suggestion for the next physical measurement or check a qualified engineer could perform — never an instruction to certify, ship, or declare compliance.",
    ),
  // MVP-11: only set when this hypothesis is a follow-up run's continuation
  // of one returned by getPreviousHypotheses this run. Both null (not both
  // set) if this is a fresh hypothesis with no earlier counterpart.
  previousHypothesisId: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .describe(
      "Set only if this hypothesis updates one returned by getPreviousHypotheses this run — its exact id. Never invent one; null if this is not a continuation of an earlier hypothesis.",
    ),
  hypothesisUpdateStatus: hypothesisUpdateStatusSchema
    .nullable()
    .describe(
      "Set together with previousHypothesisId only: whether the new evidence gathered this run supports, weakens, leaves unchanged, or still needs more evidence for that previous hypothesis. A qualitative judgment only — never a probability, confidence score, or certainty claim.",
    ),
});
export type AgentHypothesis = z.infer<typeof agentHypothesisSchema>;

export const investigationStatusSchema = z.enum([
  "hypotheses_ready",
  "clarification_needed",
  "insufficient_evidence",
]);
export type InvestigationStatus = z.infer<typeof investigationStatusSchema>;

export const agentOutputSchema = z.object({
  hypotheses: z.array(agentHypothesisSchema).max(5),
  clarificationQuestion: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .nullable()
    .describe(
      "Only non-null if one missing fact would materially change the ranking.",
    ),
  investigationStatus: investigationStatusSchema,
});
export type AgentOutput = z.infer<typeof agentOutputSchema>;
