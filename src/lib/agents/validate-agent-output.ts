// Independent post-hoc validation of the Investigation Agent's structured
// output (MVP-10B). "Zod validates shape, not truth" — agentOutputSchema
// only guarantees the model returned well-formed JSON; this module is the
// belt-and-suspenders layer that checks every claim against what actually
// happened during this run:
//   - a hypothesis's productFactId must match a real deterministic
//     correlation candidate (same rule as generate-hypotheses.ts)
//   - a citation's chunkId/productFactId/investigationEventId must be one
//     this exact run's tool calls actually returned — never trusted from
//     the model's own say-so
//   - a citation's display text is always the stored passage/fact text,
//     never the model's own restatement of it (CLAUDE.md: never let the
//     LLM rewrite a clause into new truth)
//   - certainty/root-cause language anywhere in a hypothesis rejects the
//     whole hypothesis, reusing the exact guard MVP-07 already relies on
import {
  buildObservedEvidence,
  buildKnownEvidence,
  containsProhibitedCertaintyLanguage,
  type MeasurementForHypotheses,
  type ProductFactForHypotheses,
} from "@/lib/hypotheses/generate-hypotheses";
import type {
  FinalEvidenceItem,
  FinalHypothesis,
  HypothesisUpdate,
} from "@/lib/hypotheses/schema";
import type { HarmonicCorrelationCandidate } from "@/lib/correlation/harmonic-correlation";
import type { AgentCompletedPayload } from "@/lib/analysis/events";
import type { AgentOutput } from "./schema";

export interface RetrievedDocumentPassage {
  chunkId: string;
  documentId: string;
  filename: string;
  documentType: string;
  pageNumber: number | null;
  section: string | null;
  passage: string;
}

export interface RetrievedInvestigationEvent {
  id: string;
  eventType: string;
  description: string;
}

export interface RetrievedPreviousHypothesis {
  id: string;
  title: string;
}

/**
 * Everything a tool call actually handed back during this one run, keyed
 * for O(1) lookup. Built by investigation-agent.ts from the same
 * onToolExecutionEnd callback used to produce the agent.tool.completed
 * activity events — the two are necessarily consistent because they come
 * from the same observed tool outputs, not a second, potentially-drifted
 * reconstruction.
 */
export interface RetrievedRegistry {
  productFactIds: Set<string>;
  documentPassagesByChunkId: Map<string, RetrievedDocumentPassage>;
  investigationEventsById: Map<string, RetrievedInvestigationEvent>;
  /** MVP-11: hypotheses from earlier completed runs the agent actually
   * received back from getPreviousHypotheses this run, keyed by that same
   * synthetic id (see src/lib/agents/tools.ts). */
  previousHypothesesById: Map<string, RetrievedPreviousHypothesis>;
  documentSearchCount: number;
  passagesRetrievedCount: number;
  documentsAvailable: number;
}

export function createEmptyRegistry(documentsAvailable: number): RetrievedRegistry {
  return {
    productFactIds: new Set(),
    documentPassagesByChunkId: new Map(),
    investigationEventsById: new Map(),
    previousHypothesesById: new Map(),
    documentSearchCount: 0,
    passagesRetrievedCount: 0,
    documentsAvailable,
  };
}

export interface ValidateAgentOutputInput {
  agentOutput: AgentOutput;
  registry: RetrievedRegistry;
  correlationCandidates: readonly HarmonicCorrelationCandidate[];
  productFacts: readonly ProductFactForHypotheses[];
  measurement: MeasurementForHypotheses;
}

export interface ValidateAgentOutputResult {
  hypotheses: FinalHypothesis[];
  clarificationQuestion: string | null;
  /** Whole hypotheses dropped: hallucinated productFactId or certainty
   * language. Never logged with content — count only, mirroring
   * generate-hypotheses.ts's existing rejectedCount convention. */
  rejectedHypothesisCount: number;
  /** Individual citations dropped without discarding an otherwise-sound
   * hypothesis: an id that was never actually retrieved this run, or a
   * chunkId/documentId pairing that doesn't match what was retrieved. */
  droppedCitationCount: number;
  /** Document-sourced KNOWN evidence items that survived validation and
   * made it into a hypothesis's evidence — the truthful "passages used as
   * evidence" metric. */
  passagesUsedAsEvidence: number;
}

function buildDocumentPassageEvidence(
  passage: RetrievedDocumentPassage,
): FinalEvidenceItem {
  const location = passage.pageNumber
    ? `p.${passage.pageNumber}`
    : passage.section
      ? passage.section
      : null;
  return {
    category: "known",
    description: `${passage.filename}${location ? ` (${location})` : ""}: "${passage.passage}"`,
    // Structured provenance for MVP-10C's clickable citation badge/drawer —
    // every field sourced from the stored chunk row, never the model.
    citation: {
      documentId: passage.documentId,
      chunkId: passage.chunkId,
      filename: passage.filename,
      documentType: passage.documentType,
      pageNumber: passage.pageNumber,
      section: passage.section,
      passage: passage.passage,
    },
  };
}

function buildInvestigationEventEvidence(
  event: RetrievedInvestigationEvent,
): FinalEvidenceItem {
  // An engineer-entered observation is a real measured/observed result
  // (MVP-11's "RECORD RESULT"), not background context — it belongs in
  // OBSERVED, distinguishable from KNOWN product context, exactly like the
  // run's own measurement. Every other investigation-event type (a note, an
  // engineering change) stays KNOWN: background the agent is aware of, not
  // itself a new physical observation.
  if (event.eventType === "observation") {
    return { category: "observed", description: `Engineer observation: ${event.description}` };
  }
  return {
    category: "known",
    description: `Previous investigation (${event.eventType}): ${event.description}`,
  };
}

/**
 * Assembles validated, evidence-labeled hypotheses from the agent's
 * structured output — the agent-run counterpart to
 * generateHypothesesForMeasurement in generate-hypotheses.ts, reusing that
 * module's OBSERVED-evidence builder and certainty-language guard rather
 * than reimplementing them.
 */
export function validateAgentOutput(
  input: ValidateAgentOutputInput,
): ValidateAgentOutputResult {
  const factById = new Map(input.productFacts.map((fact) => [fact.id, fact]));
  const candidateById = new Map(
    input.correlationCandidates.map((candidate) => [candidate.productFactId, candidate]),
  );

  const observedEvidence = buildObservedEvidence(input.measurement);
  const hypotheses: FinalHypothesis[] = [];
  let rejectedHypothesisCount = 0;
  let droppedCitationCount = 0;
  let passagesUsedAsEvidence = 0;

  for (const modelHypothesis of input.agentOutput.hypotheses) {
    const candidate = candidateById.get(modelHypothesis.productFactId);
    const overclaims =
      containsProhibitedCertaintyLanguage(modelHypothesis.title) ||
      containsProhibitedCertaintyLanguage(modelHypothesis.reasoning) ||
      containsProhibitedCertaintyLanguage(modelHypothesis.nextInvestigation);

    if (!candidate || overclaims) {
      rejectedHypothesisCount += 1;
      continue;
    }

    const evidence: FinalEvidenceItem[] = [observedEvidence];
    const fact = factById.get(candidate.productFactId);
    if (fact) {
      evidence.push(buildKnownEvidence(fact));
    }

    for (const ref of modelHypothesis.evidenceRefs) {
      if (ref.sourceType === "document_passage") {
        const passage = input.registry.documentPassagesByChunkId.get(ref.chunkId);
        if (!passage || passage.documentId !== ref.documentId) {
          droppedCitationCount += 1;
          continue;
        }
        evidence.push(buildDocumentPassageEvidence(passage));
        passagesUsedAsEvidence += 1;
      } else if (ref.sourceType === "product_fact") {
        if (!input.registry.productFactIds.has(ref.productFactId)) {
          droppedCitationCount += 1;
          continue;
        }
        const referencedFact = factById.get(ref.productFactId);
        if (referencedFact) {
          evidence.push(buildKnownEvidence(referencedFact));
        }
      } else {
        const event = input.registry.investigationEventsById.get(
          ref.investigationEventId,
        );
        if (!event) {
          droppedCitationCount += 1;
          continue;
        }
        evidence.push(buildInvestigationEventEvidence(event));
      }
    }

    evidence.push({ category: "inferred", description: modelHypothesis.reasoning });
    for (const missing of modelHypothesis.missingEvidence) {
      evidence.push({ category: "missing", description: missing });
    }

    // MVP-11: only trusted together, and only when previousHypothesisId is
    // one this exact run's getPreviousHypotheses call actually returned —
    // same "never trust the model's own say-so" rule as every other
    // citation above. An invalid/hallucinated id silently drops the update
    // (this hypothesis is kept as a fresh one) rather than rejecting the
    // whole hypothesis.
    let update: HypothesisUpdate | undefined;
    if (modelHypothesis.previousHypothesisId && modelHypothesis.hypothesisUpdateStatus) {
      const previous = input.registry.previousHypothesesById.get(
        modelHypothesis.previousHypothesisId,
      );
      if (previous) {
        update = {
          status: modelHypothesis.hypothesisUpdateStatus,
          previousHypothesisTitle: previous.title,
        };
      } else {
        droppedCitationCount += 1;
      }
    }

    hypotheses.push({
      productFactId: candidate.productFactId,
      title: modelHypothesis.title,
      confidenceBand: modelHypothesis.confidenceBand,
      recommendedNextStep: modelHypothesis.nextInvestigation,
      evidence,
      ...(update ? { update } : {}),
    });
  }

  const clarificationQuestion =
    input.agentOutput.clarificationQuestion &&
    !containsProhibitedCertaintyLanguage(input.agentOutput.clarificationQuestion)
      ? input.agentOutput.clarificationQuestion
      : null;

  return {
    hypotheses,
    clarificationQuestion,
    rejectedHypothesisCount,
    droppedCitationCount,
    passagesUsedAsEvidence,
  };
}

/** PERF-01 wall-clock instrumentation — computed by investigation-agent.ts
 * from its own onToolExecutionEnd activity and a Date.now() wrapper around
 * the whole agent.generate() call, never from token usage/provider timing
 * (comparable across providers, no dependency on usage data this codebase
 * doesn't otherwise track). */
export interface AgentTimings {
  stepCount: number;
  totalDurationMs: number;
  modelDurationMs: number;
  toolDurationMs: number;
  retrievalDurationMs: number;
}

export function buildAgentCompletedPayload(
  registry: RetrievedRegistry,
  correlationCandidates: readonly HarmonicCorrelationCandidate[],
  passagesUsedAsEvidence: number,
  nextInvestigationCount: number,
  timings: AgentTimings,
): AgentCompletedPayload {
  return {
    documentsAvailable: registry.documentsAvailable,
    documentSearches: registry.documentSearchCount,
    passagesRetrieved: registry.passagesRetrievedCount,
    passagesUsedAsEvidence,
    deterministicRelationshipsChecked: correlationCandidates.length,
    nextInvestigationCount,
    ...timings,
  };
}
