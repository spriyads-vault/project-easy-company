// AGENT ACTIVITY: a plain rendering of the persisted agent.tool.completed
// events (src/lib/analysis/events.ts) — observable work only, never chain-
// of-thought (there is none to show: the underlying event payload has no
// field for it, see src/lib/agents/investigation-agent.ts). Same component
// for a live run and a refreshed/reconstructed one — reconstructFromPersistedEvents
// produces the identical agentActivity/agentActive shape either way.
import { useState } from "react";
import type { AgentToolCompletedPayload } from "@/lib/analysis/events";
import { focusRing, surface, text } from "./theme";

interface AgentActivityPanelProps {
  activity: AgentToolCompletedPayload[];
  active: boolean;
  /** UX-01 (section 5): "collapse the detailed activity by default if the
   * primary investigation result needs more space." A lazy useState seed —
   * so a fresh page load of an already-completed run starts collapsed,
   * giving the hypothesis the space — but every later *start* of a run
   * force-expands regardless (see the render-time "adjusting state on prop
   * change" below), because a run the user is actually watching must show
   * its live progress; it never force-collapses again when that run
   * finishes, so a panel the user is watching isn't yanked shut out from
   * under them. Defaults to false (expanded) so every pre-UX-01 call site —
   * including this component's own tests — is unaffected. */
  defaultCollapsed?: boolean;
}

/** Splits "Searched engineering documents / 3 passages retrieved" into a
 * primary line and a detail line — the label is already a safe, pre-built
 * display string (never model text), this only changes how it wraps. */
function splitLabel(label: string): { primary: string; detail: string | null } {
  const separatorIndex = label.indexOf(" / ");
  if (separatorIndex === -1) return { primary: label, detail: null };
  return { primary: label.slice(0, separatorIndex), detail: label.slice(separatorIndex + 3) };
}

export function AgentActivityPanel({ activity, active, defaultCollapsed = false }: AgentActivityPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Adjusting state during render in response to a prop change (React's own
  // recommended pattern for this — see "Adjusting some state when a prop
  // changes" in the React docs), not an effect: a run starting (`active`
  // flips to true) always force-expands, because the whole point of "keep
  // it visible" is showing live progress while it happens. Deliberately
  // one-directional via the `prevActive` comparison — completion never
  // force-collapses back, so a user mid-way through reading the activity
  // list isn't interrupted.
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setCollapsed(false);
  }

  if (activity.length === 0 && !active) return null;

  return (
    <section
      aria-labelledby="agent-activity-heading"
      className={`flex flex-col gap-3 p-5 ${surface.panel}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="agent-activity-heading" className={text.kicker}>
          Agent activity
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className={`text-xs ${text.muted} hover:text-[#f3f1e8] ${focusRing}`}
        >
          {collapsed ? `Show (${activity.length})` : "Hide"}
        </button>
      </div>
      {/* CSS-hidden, not unmounted, when collapsed — the detail stays
          reachable (e.g. to a page-find or a test's getByText) and the
          toggle is instant, no re-fetch or re-render of list content. */}
      <ul className={`flex flex-col gap-2.5 ${collapsed ? "hidden" : ""}`}>
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
