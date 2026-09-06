// Turns a sequence of typed MVP-08 analysis events into the investigation
// workspace's UI state. One pure reducer, two callers:
//   - the client streams live events into it as they arrive over SSE
//     (progressive updates, never a chat feed)
//   - the server feeds it every persisted analysis_events row for the
//     case's latest run on page load, so a refresh reconstructs the
//     workspace from Postgres and never re-triggers the model (see
//     reconstructFromPersistedEvents below)
// Same function, same shape either way — the UI can't tell live streaming
// and refresh-reconstruction apart, which is the point.
import type {
  AgentCompletedPayload,
  AgentToolCompletedPayload,
  AgentToolStartedPayload,
  AnalysisEvent,
  CorrelationFoundPayload,
  HypothesisCreatedPayload,
  RunCompletedPayload,
} from "@/lib/analysis/events";

export type RunStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface WorkspaceState {
  runId: string | null;
  status: RunStatus;
  /** Human-readable description of the most recent event — the "Analyzing
   * measurement..." / "200 MHz measurement loaded" progressive status
   * line. Never model reasoning, always derived from a typed event. */
  lastEventSummary: string | null;
  measurement: {
    measurementId: string;
    frequencyMhz: number;
    marginDb: number;
    operatingMode: string | null;
  } | null;
  correlations: CorrelationFoundPayload[];
  hypotheses: HypothesisCreatedPayload[];
  clarification: string | null;
  errorMessage: string | null;
  summary: RunCompletedPayload | null;
  /** Observable Investigation Agent activity (MVP-10B) — the tool-call log
   * the Investigation Trace UI renders as completed steps. Never model
   * reasoning; each entry is one completed tool call's safe display
   * fields. Empty when a run didn't use the agent (e.g. no correlation
   * candidates). */
  agentActivity: AgentToolCompletedPayload[];
  /** UX-05 Workstream C: tool calls genuinely started but not yet
   * completed — real, server-instrumented "in progress" steps (see
   * agent.tool.started in events.ts), not a client-inferred or timer-driven
   * guess. Normally holds at most one entry; more than one only when the
   * agent genuinely runs tools concurrently, which the Trace UI then shows
   * truthfully as concurrent active branches rather than forcing serial
   * drama. An entry is removed the instant its matching agent.tool.completed
   * (same toolCallId) arrives. */
  activeTools: AgentToolStartedPayload[];
  /** True from `agent.started` until `agent.completed`/a terminal event —
   * lets the UI distinguish "the agent is working" from "no agent phase for
   * this run" without inferring it from array length. */
  agentActive: boolean;
  /** Truthful, actually-computed metrics from `agent.completed`, or null if
   * the run never reached that event. */
  agentMetrics: AgentCompletedPayload | null;
}

export const initialWorkspaceState: WorkspaceState = {
  runId: null,
  status: "idle",
  lastEventSummary: null,
  measurement: null,
  correlations: [],
  hypotheses: [],
  clarification: null,
  errorMessage: null,
  summary: null,
  agentActivity: [],
  activeTools: [],
  agentActive: false,
  agentMetrics: null,
};

/** True while a run is in flight — the one condition that must block a new
 * submission (see the RUN INVESTIGATION button's duplicate-run guard). */
export function isRunActive(status: RunStatus): boolean {
  return status === "running";
}

/**
 * Folds one typed event into the workspace state. A `run.started` resets
 * the panels — this is what makes RUN AGAIN safe to reuse the same reducer
 * instance instead of needing a full remount.
 */
export function applyAnalysisEvent(
  state: WorkspaceState,
  event: AnalysisEvent,
): WorkspaceState {
  switch (event.type) {
    case "run.started":
      return {
        ...initialWorkspaceState,
        runId: event.runId,
        status: "running",
        lastEventSummary: "Analyzing measurement…",
      };
    case "measurement.loaded":
      return {
        ...state,
        measurement: {
          measurementId: event.payload.measurementId,
          frequencyMhz: event.payload.frequencyMhz,
          marginDb: event.payload.marginDb,
          operatingMode: event.payload.operatingMode,
        },
        lastEventSummary: `${event.payload.frequencyMhz} MHz measurement loaded`,
      };
    case "correlation.found":
      return {
        ...state,
        correlations: [...state.correlations, event.payload],
        lastEventSummary: `${event.payload.sourceFrequencyMhz} MHz × ${event.payload.harmonicNumber} relationship detected`,
      };
    case "hypothesis.created":
      return {
        ...state,
        hypotheses: [...state.hypotheses, event.payload],
        lastEventSummary: "Investigation hypothesis appears",
      };
    case "clarification.required":
      return {
        ...state,
        clarification: event.payload.question,
        lastEventSummary: "Next evidence required appears",
      };
    case "hypothesis.retried":
      // FIX-01: the model's first attempt returned nothing usable despite a
      // real correlation to ground on — surfaced as a status line so the
      // retry is visible, not silently doubling the model call.
      return {
        ...state,
        lastEventSummary: "No hypothesis produced yet — retrying once",
      };
    case "agent.started":
      return {
        ...state,
        agentActive: true,
        lastEventSummary: "Investigation agent started",
      };
    case "agent.tool.started":
      return {
        ...state,
        activeTools: [...state.activeTools, event.payload],
        lastEventSummary: event.payload.label,
      };
    case "agent.tool.completed":
      return {
        ...state,
        // The matching started entry (same toolCallId, when the started
        // event was actually persisted for this run) moves from "active"
        // to "completed" — an older, pre-UX-05 persisted run with no
        // started events for its completions simply never had a matching
        // entry to remove, which is a no-op here, not an error.
        activeTools: state.activeTools.filter((tool) => tool.toolCallId !== event.payload.toolCallId),
        agentActivity: [...state.agentActivity, event.payload],
        lastEventSummary: event.payload.label,
      };
    case "agent.completed":
      return {
        ...state,
        // Defensive cleanup, not the normal path: every real tool call's
        // completed/failed pair already clears itself above. This only
        // matters if a run legitimately ended (agent.completed) while a
        // started entry never got a matching completion persisted.
        activeTools: [],
        agentActive: false,
        agentMetrics: event.payload,
        lastEventSummary: "Investigation agent finished",
      };
    case "run.completed":
      return {
        ...state,
        status: "completed",
        summary: event.payload,
        lastEventSummary: "Investigation complete",
      };
    case "run.failed":
      return {
        ...state,
        status: "failed",
        errorMessage: event.payload.message,
        lastEventSummary: "Analysis failed",
      };
    default:
      return state;
  }
}

/**
 * Reconstructs workspace state from every persisted event of a case's most
 * recent run. If the reduced state is still "running" — a `run.started`
 * with no terminal event after it — the browser closed or lost connection
 * before the run finished. That's shown as a recoverable state, not left
 * looking like a live run is still in progress (nothing is actually
 * running server-side; nothing here ever re-triggers the model).
 */
export function reconstructFromPersistedEvents(
  events: readonly AnalysisEvent[],
): WorkspaceState {
  const state = events.reduce(applyAnalysisEvent, initialWorkspaceState);
  if (state.status === "running") {
    return {
      ...state,
      status: "interrupted",
      errorMessage:
        "This analysis didn't finish — the connection was lost before it completed. Run again to retry.",
      lastEventSummary: "Analysis interrupted",
    };
  }
  return state;
}
