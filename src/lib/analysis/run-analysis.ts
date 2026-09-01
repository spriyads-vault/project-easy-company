// The analysis pipeline itself: ingest -> deterministic correlation
// (MVP-06) -> AI hypothesis generation (MVP-07) -> typed events, exactly the
// pipeline docs/ARCHITECTURE.md describes. Pure orchestration — no
// database, no HTTP, no knowledge of Next.js. Persisting each event and
// streaming it to the browser are the caller's job (see
// src/lib/analysis/persist-and-stream.ts and src/app/api/analysis-runs/
// route.ts), which is what makes this fully testable with a fake adapter
// and no network/DB at all.
import {
  correlateMeasurementWithProductFacts,
  type HarmonicCorrelationCandidate,
  type ProductFactRecord,
} from "@/lib/correlation/harmonic-correlation";
import {
  generateHypothesesForMeasurement,
  type ProductFactForHypotheses,
} from "@/lib/hypotheses/generate-hypotheses";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import type { FinalHypothesis } from "@/lib/hypotheses/schema";
import type { RunInvestigationAgentResult } from "@/lib/agents/investigation-agent";
import type { AnalysisEvent, AnalysisEventType } from "./events";

/**
 * The DB-touching half of MVP-10B's agent integration. run-analysis.ts stays
 * pure/DB-free by only depending on this narrow interface — the real
 * implementation (a closure over an authenticated Supabase client, a
 * resolved model, and the case's context) is built by
 * create-analysis-run.ts, exactly the same shape as HypothesisModelAdapter
 * above. When omitted, runAnalysis falls back to the plain adapter path
 * unchanged — every existing test exercises that path with no agent
 * involved at all.
 */
export interface InvestigationAgentRunner {
  investigate(
    correlationCandidates: HarmonicCorrelationCandidate[],
  ): Promise<RunInvestigationAgentResult>;
}

export interface AnalysisMeasurementInput {
  id: string;
  frequencyMhz: number;
  marginDb: number;
  operatingMode: string | null;
}

export interface RunAnalysisInput {
  runId: string;
  failureCaseId: string;
  measurement: AnalysisMeasurementInput;
  /** Facts in the discriminated-union shape the correlation engine needs. */
  productFacts: readonly ProductFactRecord[];
  /** The same facts, summarized, for the hypothesis service's context. */
  productFactSummaries: readonly ProductFactForHypotheses[];
}

/**
 * Turns any error into a short, safe, user-facing message. Never includes a
 * raw stack trace, a provider error body, or anything that could carry a
 * secret (an API key rejection message, for instance) — see CLAUDE.md
 * "Never log raw secrets ... unnecessarily."
 */
export function sanitizeAnalysisError(error: unknown): string {
  if (isMissingProviderApiKeyError(error)) {
    return error.message;
  }
  return "Analysis failed unexpectedly. Please try again or contact support.";
}

// Narrow, name-based check rather than an `instanceof` import from
// src/lib/ai/provider — this module has no reason to depend on that file at
// all beyond the HypothesisModelAdapter type, and a name check is enough to
// let this one specific, deliberately-safe message through.
function isMissingProviderApiKeyError(error: unknown): error is Error {
  return error instanceof Error && error.name === "MissingProviderApiKeyError";
}

/**
 * Runs one analysis pass and yields typed events as they're produced.
 * Never throws: a failure is reported as a `run.failed` event, the last
 * event the generator will ever yield.
 */
export async function* runAnalysis(
  input: RunAnalysisInput,
  adapter: HypothesisModelAdapter,
  agentRunner?: InvestigationAgentRunner,
): AsyncGenerator<AnalysisEvent, void, void> {
  let sequence = 0;
  function emit<T extends AnalysisEventType>(
    type: T,
    payload: Extract<AnalysisEvent, { type: T }>["payload"],
  ): AnalysisEvent {
    return {
      type,
      runId: input.runId,
      sequence: sequence++,
      createdAt: new Date().toISOString(),
      payload,
    } as AnalysisEvent;
  }

  try {
    yield emit("run.started", {
      failureCaseId: input.failureCaseId,
      measurementId: input.measurement.id,
    });

    yield emit("measurement.loaded", {
      measurementId: input.measurement.id,
      frequencyMhz: input.measurement.frequencyMhz,
      marginDb: input.measurement.marginDb,
      operatingMode: input.measurement.operatingMode,
    });

    const correlationCandidates = correlateMeasurementWithProductFacts(
      input.measurement.frequencyMhz,
      input.productFacts,
    );

    for (const candidate of correlationCandidates) {
      yield emit("correlation.found", {
        productFactId: candidate.productFactId,
        productFactCategory: candidate.productFactCategory,
        productFactLabel: candidate.productFactLabel,
        sourceFrequencyMhz: candidate.sourceFrequencyMhz,
        harmonicNumber: candidate.harmonicNumber,
        expectedFrequencyMhz: candidate.expectedFrequencyMhz,
        measuredFrequencyMhz: candidate.measuredFrequencyMhz,
        deviationMhz: candidate.deviationMhz,
        deviationRatio: candidate.deviationRatio,
        description: candidate.description,
      });
    }

    let hypothesisResult: {
      hypotheses: FinalHypothesis[];
      clarificationQuestion: string | null;
      rejectedCount: number;
    };

    if (correlationCandidates.length > 0 && agentRunner) {
      // The Investigation Agent phase (MVP-10B) — additional context
      // gathering the model itself decides it needs, layered on top of the
      // guaranteed deterministic correlations above. Never a substitute for
      // them: this branch only ever runs once real candidates already
      // exist.
      yield emit("agent.started", { correlationCount: correlationCandidates.length });
      const agentResult = await agentRunner.investigate(correlationCandidates);
      for (const activity of agentResult.activity) {
        yield emit("agent.tool.completed", activity);
      }
      yield emit("agent.completed", agentResult.metrics);
      hypothesisResult = {
        hypotheses: agentResult.hypotheses,
        clarificationQuestion: agentResult.clarificationQuestion,
        rejectedCount: 0, // already logged by runInvestigationAgent
      };
    } else {
      hypothesisResult = await generateHypothesesForMeasurement(
        {
          measurement: {
            frequencyMhz: input.measurement.frequencyMhz,
            marginDb: input.measurement.marginDb,
            operatingMode: input.measurement.operatingMode,
          },
          correlationCandidates,
          productFacts: [...input.productFactSummaries],
        },
        adapter,
      );
    }

    if (hypothesisResult.rejectedCount > 0) {
      // Never surfaced to the client — this is purely so an operator can
      // tell "the model complied and just had nothing to propose" apart
      // from "the model tried something invalid and was filtered" (a
      // hallucinated productFactId or certainty-claiming language; see
      // generateHypothesesForMeasurement).
      console.warn(
        `[analysis:${input.runId}] rejected ${hypothesisResult.rejectedCount} model-proposed hypothesis(es) (hallucinated productFactId or certainty-claiming language)`,
      );
    }

    for (const hypothesis of hypothesisResult.hypotheses) {
      yield emit("hypothesis.created", {
        productFactId: hypothesis.productFactId,
        title: hypothesis.title,
        confidenceBand: hypothesis.confidenceBand,
        recommendedNextStep: hypothesis.recommendedNextStep,
        evidence: hypothesis.evidence,
      });
    }

    if (hypothesisResult.clarificationQuestion) {
      yield emit("clarification.required", {
        question: hypothesisResult.clarificationQuestion,
      });
    }

    yield emit("run.completed", {
      correlationsFound: correlationCandidates.length,
      hypothesesCreated: hypothesisResult.hypotheses.length,
      clarificationRequired: hypothesisResult.clarificationQuestion !== null,
    });
  } catch (error) {
    // The client only ever sees the sanitized message (see
    // sanitizeAnalysisError) — this is for operators, server-side only,
    // and stdout/stderr here never crosses the network.
    console.error(`[analysis:${input.runId}] run failed`, error);
    yield emit("run.failed", { message: sanitizeAnalysisError(error) });
  }
}
