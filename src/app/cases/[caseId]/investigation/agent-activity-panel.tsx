// AGENT ACTIVITY: a plain rendering of the persisted agent.tool.completed
// events (src/lib/analysis/events.ts) — observable work only, never chain-
// of-thought (there is none to show: the underlying event payload has no
// field for it, see src/lib/agents/investigation-agent.ts). Same component
// for a live run and a refreshed/reconstructed one — reconstructFromPersistedEvents
// produces the identical agentActivity/agentActive shape either way.
import type { AgentToolCompletedPayload } from "@/lib/analysis/events";
import { surface, text } from "./theme";

interface AgentActivityPanelProps {
  activity: AgentToolCompletedPayload[];
  active: boolean;
}

/** Splits "Searched engineering documents / 3 passages retrieved" into a
 * primary line and a detail line — the label is already a safe, pre-built
 * display string (never model text), this only changes how it wraps. */
function splitLabel(label: string): { primary: string; detail: string | null } {
  const separatorIndex = label.indexOf(" / ");
  if (separatorIndex === -1) return { primary: label, detail: null };
  return { primary: label.slice(0, separatorIndex), detail: label.slice(separatorIndex + 3) };
}

export function AgentActivityPanel({ activity, active }: AgentActivityPanelProps) {
  if (activity.length === 0 && !active) return null;

  return (
    <section
      aria-labelledby="agent-activity-heading"
      className={`flex flex-col gap-3 p-5 ${surface.panel}`}
    >
      <h2 id="agent-activity-heading" className={text.kicker}>
        Agent activity
      </h2>
      <ul className="flex flex-col gap-2.5">
        {activity.map((item, index) => {
          const { primary, detail } = splitLabel(item.label);
          return (
            <li key={index} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-sm text-[#5fdb87]">
                ✓
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{primary}</span>
                {detail ? <span className={`text-xs ${text.mono} ${text.muted}`}>{detail}</span> : null}
                {item.query ? (
                  <span className={`text-xs ${text.muted}`}>Query: &ldquo;{item.query}&rdquo;</span>
                ) : null}
              </div>
            </li>
          );
        })}
        {active ? (
          <li className="flex items-start gap-2.5" role="status" aria-live="polite">
            <span
              aria-hidden="true"
              className="mt-0.5 shrink-0 animate-pulse text-sm text-[#8f8d84]"
            >
              ◌
            </span>
            <span className={`text-sm ${text.muted}`}>Working…</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
