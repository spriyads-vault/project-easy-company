// INVESTIGATION TRACE (UX-05 Workstream C): an enterprise-grade, live
// trace of Crado's actual server-side work — adapted from the shadcn
// "Chain of Thought" interaction pattern (collapsible vertical structure,
// a connecting rail, one state per step) but populated only by genuine
// events this codebase already persists: agent.tool.started (this
// ticket's own new instrumentation, bridged from the AI SDK's real
// onToolExecutionStart callback — see investigateStreaming in
// investigation-agent.ts) and agent.tool.completed. Never labeled "Chain
// of Thought" in the product, never model reasoning tokens, never a raw
// prompt: every visible line here is a safe, pre-written display string
// (label/query/resultCount/durationMs), the same trust boundary
// agent-activity-panel.tsx already enforced — this component only adds
// genuine start-state visibility and failure-state clarity on top of it.
//
// Same component renders a live run and a refreshed/reconstructed one:
// reconstructFromPersistedEvents produces the identical
// activeTools/agentActivity/agentActive shape either way (see
// reconstruct.ts), so there is nothing here that depends on "did this
// page just stream or did it load from Postgres."
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { AgentToolCompletedPayload, AgentToolStartedPayload } from "@/lib/analysis/events";
import { focusRing, text } from "./theme";

interface InvestigationTracePanelProps {
  /** Tool calls genuinely started but with no matching completion yet —
   * real "active" steps, never a client-inferred or timer-driven guess
   * (see WorkspaceState.activeTools). Usually 0 or 1 entries; more than
   * one only when the agent genuinely ran tools concurrently, shown here
   * as concurrent active branches rather than forced into a fake serial
   * order. */
  activeTools: AgentToolStartedPayload[];
  completedActivity: AgentToolCompletedPayload[];
  /** Whether the agent phase itself is still in flight — distinct from
   * "does this particular step have an active entry", since a run can be
   * active between tool calls (the model "thinking") with no active step
   * at all; the trace then shows the header's live indicator without an
   * unexplained empty active row. */
  active: boolean;
  /** Real wall-clock duration for this run, when known (PERF-01
   * instrumentation). Undefined/null for a pre-PERF-01 run: the
   * compressed summary then omits the time instead of fabricating one. */
  durationMs?: number | null;
  /** UX-01 (section 5): a fresh page load of an already-completed run
   * starts collapsed if a result is already on screen, but every later
   * *start* of a run force-expands regardless — see the render-time
   * "adjusting state on prop change" below. Defaults to false so every
   * pre-existing call site is unaffected. */
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

type TraceStepView =
  | { status: "active"; key: string; label: string; query: string | null }
  | { status: "failed"; key: string; label: string; query: string | null; durationMs: number }
  | { status: "completed"; key: string; label: string; query: string | null; durationMs: number };

function buildSteps(
  activeTools: AgentToolStartedPayload[],
  completedActivity: AgentToolCompletedPayload[],
): TraceStepView[] {
  const completedSteps: TraceStepView[] = completedActivity.map((item, index) => ({
    status: item.failed ? "failed" : "completed",
    key: item.toolCallId ?? `completed-${index}`,
    label: item.label,
    query: item.query,
    durationMs: item.durationMs,
  }));
  const completedKeys = new Set(completedSteps.map((step) => step.key));
  const activeSteps: TraceStepView[] = activeTools
    // Defensive backstop, not the expected path (the reducer already
    // removes an activeTools entry the instant its matching
    // agent.tool.completed arrives — see reconstruct.ts): a step that has
    // genuinely already completed always wins over a same-keyed active
    // entry, so one bad/duplicate event can never render the same real
    // tool call twice or produce a React duplicate-key warning.
    .filter((item) => !completedKeys.has(item.toolCallId || ""))
    .map((item, index) => ({
      status: "active",
      key: item.toolCallId || `active-${index}`,
      label: item.label,
      query: item.query,
    }));
  // Completed-before-active in document order — a step that has already
  // finished always reads above one still in flight, matching the order
  // real work actually happened in.
  return [...completedSteps, ...activeSteps];
}

export function InvestigationTracePanel({
  activeTools,
  completedActivity,
  active,
  durationMs,
  defaultCollapsed = false,
}: InvestigationTracePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Adjusting state during render in response to a prop change (React's
  // own recommended pattern), not an effect: a run starting (`active`
  // flips to true) always force-expands, because the whole point of "keep
  // it visible" is showing live progress while it happens. Deliberately
  // one-directional via the `prevActive` comparison — completion never
  // force-collapses back, so a user mid-way through reading the trace
  // isn't interrupted.
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setCollapsed(false);
  }

  const elapsedMs = useElapsedTime(active);

  if (completedActivity.length === 0 && activeTools.length === 0 && !active) return null;

  const steps = buildSteps(activeTools, completedActivity);
  const failedCount = completedActivity.filter((item) => item.failed).length;

  // Once a run has finished with at least one completed action, a
  // collapsed panel shows the compressed one-line summary instead of a
  // bare "Show (N)" toggle — the exact "N actions completed · Xs" shape
  // this ticket asks for.
  const showCompressedSummary = collapsed && !active && steps.length > 0;

  if (showCompressedSummary) {
    return (
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary"
        >
          C
        </span>
        <p className="text-sm">
          <span className="sr-only">Investigation trace</span>
          <span className="font-medium">
            {completedActivity.length} {completedActivity.length === 1 ? "action" : "actions"} completed
          </span>
          {failedCount > 0 ? <span className="text-destructive"> · {failedCount} failed</span> : null}
          {durationMs != null ? <span className={text.muted}> · {formatDuration(durationMs)}</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          className={`rounded-[7px] border border-border px-2 py-0.5 text-xs ${text.muted} hover:text-foreground ${focusRing}`}
        >
          View trace
        </button>
      </div>
    );
  }

  return (
    <section aria-label={active ? "Crado is investigating" : "Investigation trace"} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
              active ? "border-primary/50 bg-primary/15 text-primary" : "border-primary/40 bg-primary/10 text-primary"
            }`}
          >
            C
          </span>
          <span className="text-sm font-medium">{active ? "Crado is investigating" : "Investigation trace"}</span>
          {active ? (
            <>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse"
              />
              {elapsedMs != null ? (
                <span className={`text-xs ${text.mono} ${text.muted}`}>{formatDuration(elapsedMs)}</span>
              ) : null}
            </>
          ) : null}
        </div>
        {!active ? (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
          >
            {collapsed ? "View trace" : "Hide trace"}
          </button>
        ) : null}
      </div>

      {/* The thin connecting rail: one continuous border on the list,
          each step's marker dot sitting on top of it. */}
      <ul className="relative flex flex-col gap-3 pl-8 before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-px before:bg-border">
        {steps.map((step) => {
          const { primary, detail } = splitLabel(step.label);
          return (
            <li key={step.key} className="relative flex items-start gap-2.5">
              <StepMarker status={step.status} />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">
                  {primary}
                  {detail ? <span className={text.muted}> — {detail}</span> : null}
                  {step.status === "active" ? <span className={text.muted}>…</span> : null}
                </span>
                {step.query ? (
                  <span className={`text-xs ${text.muted}`}>Query: &ldquo;{step.query}&rdquo;</span>
                ) : null}
                {step.status !== "active" ? (
                  <span className={`text-xs ${text.muted}`}>{formatDuration(step.durationMs)}</span>
                ) : null}
              </div>
            </li>
          );
        })}
        {active && steps.every((step) => step.status !== "active") ? (
          <li className="relative flex items-start gap-2.5" role="status" aria-live="polite">
            <span aria-hidden="true" className="z-10 mt-0.5 shrink-0 animate-pulse text-sm text-muted-foreground">
              ◌
            </span>
            <span className={`text-sm ${text.muted}`}>Working…</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function StepMarker({ status }: { status: TraceStepView["status"] }) {
  if (status === "active") {
    return (
      <span
        aria-hidden="true"
        className="z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background motion-safe:animate-pulse"
      />
    );
  }
  if (status === "failed") {
    return (
      <span aria-hidden="true" className="z-10 mt-0.5 shrink-0 text-sm text-destructive">
        ✕
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="z-10 mt-0.5 shrink-0 text-sm text-primary">
      ✓
    </span>
  );
}

/** A real, live-updating elapsed-time readout while the agent is active —
 * "compact header with current state and elapsed time when accurate". Same
 * useSyncExternalStore shape this file's sibling components already use for
 * matchMedia (an external, changing value read via getSnapshot, never a
 * setState-in-effect) — here the "external system" is a plain interval
 * clock. `elapsedRef` is the actual cached snapshot value, written once per
 * second inside `subscribe`'s interval tick (React calls `subscribe`
 * outside the render pass, so the Date.now() read never happens during
 * render). `getSnapshot` only ever reads that cached ref — it deliberately
 * never computes `Date.now() - startedAt` itself, which briefly shipped
 * here and produced a real, live-reproduced "Maximum update depth
 * exceeded" crash: useSyncExternalStore requires getSnapshot to return the
 * *same* value across repeated calls until the store genuinely changes
 * (and calls `onChange` to say so); a value that changes on literally every
 * invocation looks like permanent tearing to React, which keeps
 * re-rendering trying to reach a stable snapshot and never does. Resets
 * whenever a new run starts (active flips false->true, changing
 * `subscribe`'s identity) and returns null the instant the run stops, so a
 * completed/refreshed run never shows a stale timer. */
function useElapsedTime(active: boolean): number | null {
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef<number | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return () => {};
      startedAtRef.current = Date.now();
      elapsedRef.current = 0;
      const interval = setInterval(() => {
        elapsedRef.current = Date.now() - (startedAtRef.current ?? Date.now());
        onChange();
      }, 1000);
      return () => {
        clearInterval(interval);
        startedAtRef.current = null;
        elapsedRef.current = null;
      };
    },
    [active],
  );

  const getSnapshot = useCallback(() => {
    if (!active) return null;
    return elapsedRef.current;
  }, [active]);

  const getServerSnapshot = useCallback(() => null, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
