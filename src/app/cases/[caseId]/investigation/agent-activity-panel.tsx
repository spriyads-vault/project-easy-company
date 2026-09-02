// LIVE AGENT WORK (UX-03): a plain rendering of the persisted
// agent.tool.completed events (src/lib/analysis/events.ts) — observable
// work only, never chain-of-thought (there is none to show: the underlying
// event payload has no field for it, see
// src/lib/agents/investigation-agent.ts). Same component for a live run
// and a refreshed/reconstructed one — reconstructFromPersistedEvents
// produces the identical agentActivity/agentActive shape either way.
//
// UX-03: "do not use a permanent Agent Activity dashboard card." While the
// agent is working this renders unboxed, directly in the canvas flow — a
// "Crado is investigating" headline over the progressive checklist, so
// there's something to actually watch during the 15-40s model run without
// it looking like its own dashboard panel. Once the run completes, it
// compresses to a small chip ("N actions completed · Xs") sized to its
// content, not a full-width card — the full checklist stays one click away
// behind [View activity], never deleted.
import { useState } from "react";
import type { AgentToolCompletedPayload } from "@/lib/analysis/events";
import { focusRing, text } from "./theme";

interface AgentActivityPanelProps {
  activity: AgentToolCompletedPayload[];
  active: boolean;
  /** Real wall-clock duration for this run, when known (PERF-01
   * instrumentation — agentMetrics?.totalDurationMs at the call site).
   * Undefined/null for a pre-PERF-01 run: the compressed summary then
   * omits the time instead of fabricating one. */
  durationMs?: number | null;
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

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function AgentActivityPanel({
  activity,
  active,
  durationMs,
  defaultCollapsed = false,
}: AgentActivityPanelProps) {
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

  // Once a run has finished with at least one completed action, a
  // collapsed panel shows the compressed one-line summary instead of a
  // bare "Show (N)" toggle — the exact "N actions completed · Xs" shape
  // this ticket asks for.
  const showCompressedSummary = collapsed && !active && activity.length > 0;

  if (showCompressedSummary) {
    return (
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1f9d52]/40 bg-[#1f9d52]/10 text-[10px] font-semibold text-[#15803d]">
          C
        </span>
        <p className="text-sm">
          <span className="sr-only">Agent activity</span>
          <span className="font-medium">
            {activity.length} {activity.length === 1 ? "action" : "actions"} completed
          </span>
          {durationMs != null ? <span className={text.muted}> · {formatDuration(durationMs)}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          className={`rounded-[7px] border border-[#e4e4e7] px-2 py-0.5 text-xs ${text.muted} hover:text-[#18181b] ${focusRing}`}
        >
          View activity
        </button>
      </div>
    );
  }

  return (
    <section aria-label={active ? "Crado is investigating" : "Agent activity"} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
              active
                ? "border-[#1f9d52]/50 bg-[#1f9d52]/15 text-[#15803d]"
                : "border-[#1f9d52]/40 bg-[#1f9d52]/10 text-[#15803d]"
            }`}
          >
            C
          </span>
          <span className="text-sm font-medium">
            {active ? "Crado is investigating" : "Agent activity"}
          </span>
          {active ? <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1f9d52]" /> : null}
        </div>
        {!active ? (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className={`text-xs ${text.muted} hover:text-[#18181b] ${focusRing}`}
          >
            {collapsed ? "View activity" : "Hide activity"}
          </button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2.5 pl-8">
        {activity.map((item, index) => {
          const { primary, detail } = splitLabel(item.label);
          return (
            <li key={index} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-sm text-[#15803d]">
                ✓
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">
                  {primary}
                  {detail ? <span className={text.muted}> — {detail}</span> : null}
                </span>
                {item.query ? (
                  <span className={`text-xs ${text.muted}`}>Query: &ldquo;{item.query}&rdquo;</span>
                ) : null}
              </div>
            </li>
          );
        })}
        {active ? (
          <li className="flex items-start gap-2.5" role="status" aria-live="polite">
            <span aria-hidden="true" className="mt-0.5 shrink-0 animate-pulse text-sm text-[#a1a1aa]">
              ◌
            </span>
            <span className={`text-sm ${text.muted}`}>Working…</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
