// "WHAT CRADO HANDLED" — a compact grid of the actually-computed
// agent.completed metrics (src/lib/agents/validate-agent-output.ts:
// buildAgentCompletedPayload). Every number here is real: never a
// placeholder, never a marketing figure. Nothing renders until a run has
// actually gone through the Investigation Agent phase.
//
// UX-01 (section 9): infrastructure metrics must never be the main product
// value on screen. Four numbers an engineer can read as "work saved" —
// tools used, model steps, sources used, next test — sit in the always-
// visible primary row; everything else (document search counts, passage
// counts, per-phase timing) moves into a collapsed-by-default <details>
// section, present for anyone who wants it but never competing with the
// investigation hypothesis for attention.
import type { AgentCompletedPayload } from "@/lib/analysis/events";
import { text } from "./theme";

interface AgentMetricsPanelProps {
  metrics: AgentCompletedPayload;
  /** Distinct tool calls actually made this run — state.agentActivity.length
   * at the call site, the same array Agent Activity renders, never a
   * separately-maintained count. */
  toolCallCount: number;
  /** Distinct documents actually cited as evidence this run —
   * deriveSourcesUsed(hypotheses).length at the call site, the same
   * derivation SourcesPanel uses, so the two numbers can never disagree. */
  sourcesUsedCount: number;
}

const PRIMARY_METRICS: {
  key: "toolCallCount" | "stepCount" | "sourcesUsedCount" | "nextInvestigationCount";
  label: string;
}[] = [
  { key: "toolCallCount", label: "Tools used" },
  { key: "stepCount", label: "Model steps" },
  { key: "sourcesUsedCount", label: "Sources cited" },
  { key: "nextInvestigationCount", label: "Next test" },
];

const DETAIL_METRICS: {
  key: keyof AgentCompletedPayload;
  label: string;
  format?: (value: number) => string;
}[] = [
  { key: "documentsAvailable", label: "Documents available" },
  { key: "documentSearches", label: "Document searches" },
  { key: "passagesRetrieved", label: "Passages retrieved" },
  { key: "passagesUsedAsEvidence", label: "Passages used" },
  { key: "deterministicRelationshipsChecked", label: "Deterministic relationships" },
  // PERF-01 instrumentation — undefined (filtered out below) for any run
  // persisted before that ticket, so an old case's timeline never shows a
  // fabricated "0". Real wall-clock counters only, never model reasoning.
  { key: "totalDurationMs", label: "Total duration", format: formatDuration },
  { key: "modelDurationMs", label: "Model duration", format: formatDuration },
  { key: "toolDurationMs", label: "Tool duration", format: formatDuration },
  { key: "retrievalDurationMs", label: "Retrieval duration", format: formatDuration },
];

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function AgentMetricsPanel({ metrics, toolCallCount, sourcesUsedCount }: AgentMetricsPanelProps) {
  const primaryValues: Record<(typeof PRIMARY_METRICS)[number]["key"], number | undefined> = {
    toolCallCount,
    stepCount: metrics.stepCount,
    sourcesUsedCount,
    nextInvestigationCount: metrics.nextInvestigationCount,
  };
  const shownPrimary = PRIMARY_METRICS.filter(({ key }) => primaryValues[key] !== undefined);
  const shownDetail = DETAIL_METRICS.filter(({ key }) => metrics[key] !== undefined);

  return (
    <section
      aria-labelledby="agent-metrics-heading"
      className="flex flex-col gap-3 border-t border-border px-4 py-3"
    >
      <h2 id="agent-metrics-heading" className={text.kicker}>
        What Crado handled
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {shownPrimary.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <dd className={`text-xl font-semibold ${text.mono}`}>{primaryValues[key]}</dd>
            <dt className={`${text.kicker} text-[10px]`}>{label}</dt>
          </div>
        ))}
      </dl>

      {shownDetail.length > 0 ? (
        <details className="group">
          <summary
            className={`cursor-pointer list-none text-xs ${text.muted} hover:text-foreground`}
          >
            <span className="group-open:hidden">Show technical detail</span>
            <span className="hidden group-open:inline">Hide technical detail</span>
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-4">
            {shownDetail.map(({ key, label, format }) => {
              const value = metrics[key] as number;
              return (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className={`${text.kicker} text-[10px]`}>{label}</dt>
                  <dd className={`text-base font-medium ${text.mono}`}>
                    {format ? format(value) : value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
