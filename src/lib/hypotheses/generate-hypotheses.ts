// Orchestrates the AI structured hypothesis service: merges deterministic
// OBSERVED/KNOWN evidence with the model's INFERRED reasoning and MISSING
// evidence into ranked, evidence-labeled hypotheses. See
// src/lib/hypotheses/schema.ts for why the model cannot itself emit an
// OBSERVED or KNOWN item, and src/lib/ai/provider.ts for the provider
// adapter this depends on rather than a concrete model SDK.
import type { HarmonicCorrelationCandidate } from "@/lib/correlation/harmonic-correlation";
import type { ProductFactCategory } from "@/lib/domain/schema";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import {
  hypothesisGenerationOutputSchema,
  type FinalEvidenceItem,
  type FinalHypothesis,
  type HypothesisGenerationInput,
} from "./schema";

export interface MeasurementForHypotheses {
  frequencyMhz: number;
  marginDb: number;
  operatingMode: string | null;
}

export interface ProductFactForHypotheses {
  id: string;
  category: ProductFactCategory;
  label: string;
  /** Human-readable one-liner, e.g. "40 MHz system clock". */
  summary: string;
}

export interface GenerateHypothesesInput {
  measurement: MeasurementForHypotheses;
  correlationCandidates: HarmonicCorrelationCandidate[];
  productFacts: ProductFactForHypotheses[];
}

export interface GenerateHypothesesResult {
  hypotheses: FinalHypothesis[];
  clarificationQuestion: string | null;
  /**
   * Model-proposed hypotheses that were dropped — a hallucinated
   * productFactId, or language that overclaims certainty. Never shown to
   * the user as hypotheses; exposed here only for observability/logging.
   */
  rejectedCount: number;
}

// Overclaim = a grammatical certainty CLAIM about the hypothesis itself
// ("is confirmed", "confirmed as the cause"), not the bare word. Live-testing
// found the original bare-word version rejecting well-hedged, correct model
// output: "not a confirmed cause" (a negation) and "to confirm signal
// presence" (confirm used as a legitimate verification-action verb, exactly
// the hedged recommendedNextStep behavior this exists to encourage) were
// both getting discarded purely because they contained "confirm". "root
// cause", "definitely", "proven"/"guarantee[sd]" have no comparable benign
// usage in this context, so those stay as unconditional blocks.
// Belt-and-suspenders on top of the system prompt and the schema's
// field-level constraints — none of these are trusted alone.
const PROHIBITED_CERTAINTY_PATTERNS: readonly RegExp[] = [
  /\broot[\s-]?cause\b/i,
  /\bdefinitely\b/i,
  /\bguarantee[sd]?\b/i,
  /\b(?:is|are|was|were)\s+(?:confirmed|verified|proven)\b/i,
  /\b(?:confirmed|verified|proven)\s+(?:as|to\s+be)\b/i,
];

export function containsProhibitedCertaintyLanguage(text: string): boolean {
  return PROHIBITED_CERTAINTY_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildObservedEvidence(
  measurement: MeasurementForHypotheses,
): FinalEvidenceItem {
  const marginDescription =
    measurement.marginDb > 0
      ? `${measurement.marginDb} dB over the applicable limit`
      : `${Math.abs(measurement.marginDb)} dB under the applicable limit`;
  return {
    category: "observed",
    description:
      `Measured ${measurement.frequencyMhz} MHz at ${marginDescription}` +
      (measurement.operatingMode
        ? ` during "${measurement.operatingMode}".`
        : "."),
  };
}

export function buildKnownEvidence(
  fact: ProductFactForHypotheses,
): FinalEvidenceItem {
  return { category: "known", description: `Product context: ${fact.summary}` };
}

// UX-07 correction: the same product fact can legitimately enter a single
// hypothesis's evidence twice — once as the deterministic correlation's own
// grounding fact, once again if the model separately cites it as an
// evidenceRef (src/lib/agents/validate-agent-output.ts does both). That
// produced an exact duplicate line ("Product context: 40 MHz system clock"
// twice) on screen — a content-assembly bug, not a model or evidence-model
// issue. Dedupes by (category, description) — the same fact cited via two
// different, differently-worded routes would NOT collide here, which is
// correct: only byte-identical restatements are the bug.
export function dedupeEvidence(evidence: FinalEvidenceItem[]): FinalEvidenceItem[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.category}:${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Generates ranked, evidence-labeled investigation hypotheses for a
 * measurement. Does not touch the database or any model SDK directly —
 * callers supply already-loaded data and a HypothesisModelAdapter, which
 * keeps this function deterministic-shaped and unit-testable with a fake
 * adapter.
 */
export async function generateHypothesesForMeasurement(
  input: GenerateHypothesesInput,
  adapter: HypothesisModelAdapter,
): Promise<GenerateHypothesesResult> {
  if (input.correlationCandidates.length === 0) {
    // Nothing to ground a hypothesis on — don't call the model with an
    // empty candidate set; it would have nothing legitimate to reference.
    return { hypotheses: [], clarificationQuestion: null, rejectedCount: 0 };
  }

  const factById = new Map(input.productFacts.map((fact) => [fact.id, fact]));
  const candidateById = new Map(
    input.correlationCandidates.map((candidate) => [
      candidate.productFactId,
      candidate,
    ]),
  );

  const modelInput: HypothesisGenerationInput = {
    measurement: input.measurement,
    correlationCandidates: input.correlationCandidates.map((candidate) => ({
      productFactId: candidate.productFactId,
      productFactCategory: candidate.productFactCategory,
      productFactLabel: candidate.productFactLabel,
      sourceFrequencyMhz: candidate.sourceFrequencyMhz,
      harmonicNumber: candidate.harmonicNumber,
      expectedFrequencyMhz: candidate.expectedFrequencyMhz,
      deviationRatio: candidate.deviationRatio,
      description: candidate.description,
    })),
    productFacts: input.productFacts,
  };

  const rawOutput = await adapter.generateHypotheses(modelInput);
  // The adapter is expected to hand back schema-valid output, but a model
  // vendor's SDK response is a trust boundary regardless of which adapter
  // implementation produced it — validate again here rather than assume.
  const output = hypothesisGenerationOutputSchema.parse(rawOutput);

  const observedEvidence = buildObservedEvidence(input.measurement);
  const hypotheses: FinalHypothesis[] = [];
  let rejectedCount = 0;

  for (const modelHypothesis of output.hypotheses) {
    const candidate = candidateById.get(modelHypothesis.productFactId);
    const overclaims =
      containsProhibitedCertaintyLanguage(modelHypothesis.title) ||
      containsProhibitedCertaintyLanguage(modelHypothesis.reasoning) ||
      containsProhibitedCertaintyLanguage(modelHypothesis.recommendedNextStep);

    if (!candidate || overclaims) {
      // Content is deliberately not logged here — hypothesis text can
      // reference confidential product facts. run-analysis.ts logs a
      // count-only warning per run for operator observability instead.
      rejectedCount += 1;
      continue;
    }

    const fact = factById.get(candidate.productFactId);
    const evidence: FinalEvidenceItem[] = [observedEvidence];
    if (fact) {
      evidence.push(buildKnownEvidence(fact));
    }
    evidence.push({ category: "inferred", description: modelHypothesis.reasoning });
    for (const missing of modelHypothesis.missingEvidence) {
      evidence.push({ category: "missing", description: missing });
    }

    hypotheses.push({
      productFactId: candidate.productFactId,
      title: modelHypothesis.title,
      confidenceBand: modelHypothesis.confidenceBand,
      recommendedNextStep: modelHypothesis.recommendedNextStep,
      evidence: dedupeEvidence(evidence),
    });
  }

  const clarificationQuestion =
    output.clarificationQuestion &&
    !containsProhibitedCertaintyLanguage(output.clarificationQuestion)
      ? output.clarificationQuestion
      : null;

  return { hypotheses, clarificationQuestion, rejectedCount };
}
