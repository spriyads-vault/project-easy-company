// VALIDATION-01: deterministic benchmark metrics, computed purely from a
// run's already-persisted AnalysisEvent stream — the exact same events the
// investigation workspace itself renders (src/lib/analysis/events.ts). No
// database access, no model call, no new instrumentation: every number
// here was already true before this ticket, this just reads it back out
// for a benchmark report instead of a live workspace.
//
// Deliberately does NOT attempt to automatically judge whether a
// hypothesis "matches" the ground truth's root cause — that's a semantic
// judgment call the product truth rules reserve for a qualified reviewer
// (see CLAUDE.md: "never claim definitive automated root-cause
// diagnosis"). The one ground-truth-aware figure this computes
// (`keywordOverlapByHypothesis`) is a transparent, labeled, non-authoritative
// signal — shared significant words only, never a verdict.
import type { AnalysisEvent } from "@/lib/analysis/events";
import type { GroundTruth } from "./ground-truth";

export interface BenchmarkMetrics {
  // Straight from agent.completed (PERF-01 instrumentation) — undefined for
  // a run persisted before that ticket, never a fabricated 0.
  documentsAvailable?: number;
  documentSearches?: number;
  passagesRetrieved?: number;
  passagesUsedAsEvidence?: number;
  deterministicRelationshipsChecked?: number;
  nextInvestigationCount?: number;
  stepCount?: number;
  totalDurationMs?: number;
  modelDurationMs?: number;
  toolDurationMs?: number;
  retrievalDurationMs?: number;
  /** Zero-result searchEngineeringDocuments calls — the same "wasted
   * search" concept PERF-01 introduced a stop-nudge for, counted here
   * directly from the persisted agent.tool.completed events rather than
   * trusting the agent's own summary. */
  unnecessarySearchCount: number;
  /** Total tool calls this run actually made, from the same events. */
  toolCallCount: number;
  /** Wall-clock from run.started to the terminal event (run.completed or
   * run.failed) — always available, even for a pre-PERF-01 run with no
   * totalDurationMs. */
  totalRunTimeMs: number | null;
  /** Wall-clock from run.started to the *first* hypothesis.created event —
   * a transparent proxy for "time to a useful next action." Not the
   * authoritative figure: the expert's own 1-5 "next action useful?" score
   * is the record of whether it actually was useful, this is only when it
   * arrived. */
  timeToFirstHypothesisMs: number | null;
  hypothesesCount: number;
  correlationsCount: number;
  /** Evidence items across all hypotheses that carry a document citation —
   * the same "sources cited" concept UX-01's metrics panel shows. */
  citationsUsedCount: number;
  /** Present only when ground truth was passed in (i.e., already revealed
   * for this benchmark case) — never computed from a value the caller
   * didn't already have separately, so this function can never be the
   * accidental leak path. */
  groundTruthComparison?: {
    rootCause: string;
    keywordOverlapByHypothesis: { title: string; sharedTermCount: number }[];
  };
}

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "and", "or", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "this", "that", "it", "its", "as", "by", "be",
  "not", "no", "yet", "than", "then", "into", "from", "via", "may", "likely",
]);

function significantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
  );
}

function elapsedMs(fromIso: string, toIso: string): number {
  return new Date(toIso).getTime() - new Date(fromIso).getTime();
}

export function computeBenchmarkMetrics(
  events: readonly AnalysisEvent[],
  groundTruth?: GroundTruth,
): BenchmarkMetrics {
  const started = events.find((e) => e.type === "run.started");
  const terminal = events.find((e) => e.type === "run.completed" || e.type === "run.failed");
  const firstHypothesis = events.find((e) => e.type === "hypothesis.created");
  const agentCompleted = events.find((e) => e.type === "agent.completed");
  const toolEvents = events.filter((e) => e.type === "agent.tool.completed");
  const hypothesisEvents = events.filter((e) => e.type === "hypothesis.created");
  const correlationEvents = events.filter((e) => e.type === "correlation.found");

  const unnecessarySearchCount = toolEvents.filter(
    (e) => e.payload.toolName === "searchEngineeringDocuments" && e.payload.resultCount === 0,
  ).length;

  const citationsUsedCount = hypothesisEvents.reduce(
    (sum, e) => sum + e.payload.evidence.filter((item) => item.citation).length,
    0,
  );

  const metrics: BenchmarkMetrics = {
    unnecessarySearchCount,
    toolCallCount: toolEvents.length,
    totalRunTimeMs: started && terminal ? elapsedMs(started.createdAt, terminal.createdAt) : null,
    timeToFirstHypothesisMs:
      started && firstHypothesis ? elapsedMs(started.createdAt, firstHypothesis.createdAt) : null,
    hypothesesCount: hypothesisEvents.length,
    correlationsCount: correlationEvents.length,
    citationsUsedCount,
  };

  if (agentCompleted?.type === "agent.completed") {
    metrics.documentsAvailable = agentCompleted.payload.documentsAvailable;
    metrics.documentSearches = agentCompleted.payload.documentSearches;
    metrics.passagesRetrieved = agentCompleted.payload.passagesRetrieved;
    metrics.passagesUsedAsEvidence = agentCompleted.payload.passagesUsedAsEvidence;
    metrics.deterministicRelationshipsChecked =
      agentCompleted.payload.deterministicRelationshipsChecked;
    metrics.nextInvestigationCount = agentCompleted.payload.nextInvestigationCount;
    metrics.stepCount = agentCompleted.payload.stepCount;
    metrics.totalDurationMs = agentCompleted.payload.totalDurationMs;
    metrics.modelDurationMs = agentCompleted.payload.modelDurationMs;
    metrics.toolDurationMs = agentCompleted.payload.toolDurationMs;
    metrics.retrievalDurationMs = agentCompleted.payload.retrievalDurationMs;
  }

  if (groundTruth) {
    const rootCauseTerms = significantTerms(groundTruth.rootCause);
    metrics.groundTruthComparison = {
      rootCause: groundTruth.rootCause,
      keywordOverlapByHypothesis: hypothesisEvents.map((e) => {
        const hypothesisTerms = significantTerms(
          `${e.payload.title} ${e.payload.evidence.find((item) => item.category === "inferred")?.description ?? ""}`,
        );
        let sharedTermCount = 0;
        for (const term of hypothesisTerms) {
          if (rootCauseTerms.has(term)) sharedTermCount += 1;
        }
        return { title: e.payload.title, sharedTermCount };
      }),
    };
  }

  return metrics;
}
