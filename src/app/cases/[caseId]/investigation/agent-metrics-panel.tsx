// "WHAT CRADO HANDLED" — a compact grid of the actually-computed
// agent.completed metrics (src/lib/agents/validate-agent-output.ts:
// buildAgentCompletedPayload). Every number here is real: never a
// placeholder, never a marketing figure. Nothing renders until a run has
// actually gone through the Investigation Agent phase.
import type { AgentCompletedPayload } from "@/lib/analysis/events";
import { surface, text } from "./theme";

interface AgentMetricsPanelProps {
  metrics: AgentCompletedPayload;
}

const METRIC_LABELS: {
  key: keyof AgentCompletedPayload;
  label: string;
  format?: (value: number) => string;
}[] = [
  { key: "documentsAvailable", label: "Documents available" },
  { key: "documentSearches", label: "Document searches" },
  { key: "passagesRetrieved", label: "Passages retrieved" },
  { key: "passagesUsedAsEvidence", label: "Passages used" },
  { key: "deterministicRelationshipsChecked", label: "Deterministic relationships" },
  { key: "nextInvestigationCount", label: "Next investigation" },
  // PERF-01 instrumentation — undefined (filtered out below) for any run
  // persisted before this ticket, so an old case's timeline never shows a
  // fabricated "0". Real wall-clock counters only, never model reasoning.
  { key: "stepCount", label: "Agent steps" },
  { key: "totalDurationMs", label: "Total duration", format: formatDuration },
  { key: "modelDurationMs", label: "Model duration", format: formatDuration },
  { key: "toolDurationMs", label: "Tool duration", format: formatDuration },
  { key: "retrievalDurationMs", label: "Retrieval duration", format: formatDuration },
];

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function AgentMetricsPanel({ metrics }: AgentMetricsPanelProps) {
  const shown = METRIC_LABELS.filter(({ key }) => metrics[key] !== undefined);

  return (
    <section
      aria-labelledby="agent-metrics-heading"
      className={`flex flex-col gap-3 p-5 ${surface.panel}`}
    >
      <h2 id="agent-metrics-heading" className={text.kicker}>
        What Crado handled
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map(({ key, label, format }) => {
          const value = metrics[key] as number;
          return (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className={`${text.kicker} text-[10px]`}>{label}</dt>
              <dd className={`text-2xl font-semibold ${text.mono}`}>
                {format ? format(value) : value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
