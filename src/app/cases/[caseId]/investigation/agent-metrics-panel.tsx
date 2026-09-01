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

const METRIC_LABELS: { key: keyof AgentCompletedPayload; label: string }[] = [
  { key: "documentsAvailable", label: "Documents available" },
  { key: "documentSearches", label: "Document searches" },
  { key: "passagesRetrieved", label: "Passages retrieved" },
  { key: "passagesUsedAsEvidence", label: "Passages used" },
  { key: "deterministicRelationshipsChecked", label: "Deterministic relationships" },
  { key: "nextInvestigationCount", label: "Next investigation" },
];

export function AgentMetricsPanel({ metrics }: AgentMetricsPanelProps) {
  return (
    <section
      aria-labelledby="agent-metrics-heading"
      className={`flex flex-col gap-3 p-5 ${surface.panel}`}
    >
      <h2 id="agent-metrics-heading" className={text.kicker}>
        What Crado handled
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_LABELS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <dt className={`${text.kicker} text-[10px]`}>{label}</dt>
            <dd className={`text-2xl font-semibold ${text.mono}`}>{metrics[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
