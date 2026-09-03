import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentToolCompletedPayload, AgentToolStartedPayload } from "@/lib/analysis/events";
import { InvestigationTracePanel } from "./investigation-trace-panel";

const searchActivity: AgentToolCompletedPayload = {
  toolName: "searchEngineeringDocuments",
  label: "Searched engineering documents / 3 passages retrieved",
  resultCount: 3,
  durationMs: 15,
  query: "40 MHz display cable",
  toolCallId: "call-1",
};

const correlationActivity: AgentToolCompletedPayload = {
  toolName: "getDeterministicCorrelations",
  label: "Checked deterministic relationships / 1 candidate found",
  resultCount: 1,
  durationMs: 2,
  query: null,
  toolCallId: "call-2",
};

const failedActivity: AgentToolCompletedPayload = {
  toolName: "searchEngineeringDocuments",
  label: "Searched engineering documents — unavailable",
  resultCount: null,
  durationMs: 8,
  query: "40 MHz clock",
  toolCallId: "call-3",
  failed: true,
};

const activeStep: AgentToolStartedPayload = {
  toolName: "searchEngineeringDocuments",
  label: "Searching engineering documents…",
  query: "40 MHz display cable",
  toolCallId: "call-4",
};

describe("InvestigationTracePanel", () => {
  it("renders nothing when the agent never ran for this render (no run yet, no chatbot-style placeholder)", () => {
    const { container } = render(
      <InvestigationTracePanel activeTools={[]} completedActivity={[]} active={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each completed tool call as observable work, with the query surfaced separately", () => {
    render(
      <InvestigationTracePanel
        activeTools={[]}
        completedActivity={[correlationActivity, searchActivity]}
        active={false}
      />,
    );

    expect(screen.getByText("Investigation trace")).toBeInTheDocument();
    expect(screen.getByText(/Checked deterministic relationships/)).toBeInTheDocument();
    expect(screen.getByText(/1 candidate found/)).toBeInTheDocument();
    expect(screen.getByText(/Searched engineering documents/)).toBeInTheDocument();
    expect(screen.getByText(/3 passages retrieved/)).toBeInTheDocument();
    expect(screen.getByText(/Query:/)).toHaveTextContent("40 MHz display cable");
  });

  it("never renders the same tool call twice when a completed event's activeTools entry hasn't been cleared yet (defensive backstop for a stale/duplicate started event)", () => {
    // Regression for a real bug: a genuine live Anthropic run had every
    // concurrently-called tool in one model step share a single id, which
    // put the same toolCallId in both activeTools and completedActivity at
    // once and produced a React duplicate-key warning. The reducer is the
    // real fix (reconstruct.ts clears activeTools on the matching
    // completion), but this component must never render a duplicate row
    // even if a stale/duplicate started entry slips through.
    render(
      <InvestigationTracePanel
        activeTools={[{ ...activeStep, toolCallId: searchActivity.toolCallId ?? activeStep.toolCallId }]}
        completedActivity={[searchActivity]}
        active={true}
      />,
    );
    expect(screen.getAllByText(/Searched engineering documents|Searching engineering documents/)).toHaveLength(1);
  });

  it("shows a real genuinely-started step as active, with a present-continuous label distinct from completed phrasing", () => {
    render(
      <InvestigationTracePanel
        activeTools={[activeStep]}
        completedActivity={[]}
        active={true}
      />,
    );
    expect(screen.getByText(/Searching engineering documents/)).toBeInTheDocument();
  });

  it("keeps a completed step's active started entry out of the completed step count once it finishes", () => {
    render(
      <InvestigationTracePanel
        activeTools={[]}
        completedActivity={[searchActivity]}
        active={false}
        defaultCollapsed={true}
        durationMs={1000}
      />,
    );
    expect(screen.getByText("1 action completed")).toBeInTheDocument();
  });

  it("shows a real failure distinctly from a normal completion, with the truthful recoverable-error label", () => {
    render(
      <InvestigationTracePanel activeTools={[]} completedActivity={[failedActivity]} active={false} />,
    );
    expect(screen.getByText(/unavailable/)).toBeInTheDocument();
  });

  it("never renders chain-of-thought/reasoning text or a fake typing indicator", () => {
    render(<InvestigationTracePanel activeTools={[]} completedActivity={[searchActivity]} active={false} />);
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reasoning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chain of thought/i)).not.toBeInTheDocument();
  });

  it("shows a subtle 'working' indicator only when the agent is active with no step currently in flight", () => {
    render(<InvestigationTracePanel activeTools={[]} completedActivity={[correlationActivity]} active={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Working…");
  });

  it("does not show the generic 'Working…' filler once a real active step already explains what's happening", () => {
    render(
      <InvestigationTracePanel activeTools={[activeStep]} completedActivity={[correlationActivity]} active={true} />,
    );
    expect(screen.queryByText("Working…")).not.toBeInTheDocument();
  });

  it("shows nothing pending once the agent has finished (active=false, items present)", () => {
    render(<InvestigationTracePanel activeTools={[]} completedActivity={[correlationActivity]} active={false} />);
    expect(screen.queryByText("Working…")).not.toBeInTheDocument();
  });

  it("compresses a finished run into 'N actions completed · Xs' with a View trace toggle", () => {
    render(
      <InvestigationTracePanel
        activeTools={[]}
        completedActivity={[correlationActivity, searchActivity]}
        active={false}
        durationMs={18700}
        defaultCollapsed={true}
      />,
    );

    expect(screen.getByText("2 actions completed")).toBeInTheDocument();
    expect(screen.getByText("· 18.7s")).toBeInTheDocument();
    expect(screen.queryByText(/Checked deterministic relationships/)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "View trace" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("surfaces a real failure count in the compressed summary, never silently folded into a normal completion", () => {
    render(
      <InvestigationTracePanel
        activeTools={[]}
        completedActivity={[correlationActivity, failedActivity]}
        active={false}
        defaultCollapsed={true}
      />,
    );
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it("expanding the compressed summary reveals the full trace again", () => {
    render(
      <InvestigationTracePanel
        activeTools={[]}
        completedActivity={[correlationActivity]}
        active={false}
        defaultCollapsed={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View trace" }));

    expect(screen.getByText(/Checked deterministic relationships/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide trace" })).toBeInTheDocument();
  });

  it("renders only from the props it was given — no internal timer advances steps on its own (no synthetic streaming)", async () => {
    render(<InvestigationTracePanel activeTools={[activeStep]} completedActivity={[]} active={true} />);
    expect(screen.getByText(/Searching engineering documents/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Still exactly the one active step passed in — nothing self-advanced
    // to "completed" or invented a second step.
    expect(screen.queryByText(/Searched engineering documents/)).not.toBeInTheDocument();
  });
});
