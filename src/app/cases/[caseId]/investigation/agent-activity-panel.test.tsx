import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentToolCompletedPayload } from "@/lib/analysis/events";
import { AgentActivityPanel } from "./agent-activity-panel";

const searchActivity: AgentToolCompletedPayload = {
  toolName: "searchEngineeringDocuments",
  label: "Searched engineering documents / 3 passages retrieved",
  resultCount: 3,
  durationMs: 15,
  query: "40 MHz display cable",
};

const correlationActivity: AgentToolCompletedPayload = {
  toolName: "getDeterministicCorrelations",
  label: "Checked deterministic relationships / 1 candidate found",
  resultCount: 1,
  durationMs: 2,
  query: null,
};

describe("AgentActivityPanel", () => {
  it("renders nothing when the agent never ran for this render (no run yet, no chatbot-style placeholder)", () => {
    const { container } = render(<AgentActivityPanel activity={[]} active={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each completed tool call as observable work, with the query surfaced separately", () => {
    render(<AgentActivityPanel activity={[correlationActivity, searchActivity]} active={false} />);

    expect(screen.getByText("Agent activity")).toBeInTheDocument();
    expect(screen.getByText(/Checked deterministic relationships/)).toBeInTheDocument();
    expect(screen.getByText(/1 candidate found/)).toBeInTheDocument();
    expect(screen.getByText(/Searched engineering documents/)).toBeInTheDocument();
    expect(screen.getByText(/3 passages retrieved/)).toBeInTheDocument();
    expect(screen.getByText(/Query:/)).toHaveTextContent("40 MHz display cable");
  });

  it("never renders chain-of-thought/reasoning text or a fake typing indicator", () => {
    render(<AgentActivityPanel activity={[searchActivity]} active={false} />);
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reasoning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chain of thought/i)).not.toBeInTheDocument();
  });

  it("shows a subtle 'working' indicator while the agent is still active, distinct from completed items", () => {
    render(<AgentActivityPanel activity={[correlationActivity]} active={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Working…");
  });

  it("shows nothing pending once the agent has finished (active=false, items present)", () => {
    render(<AgentActivityPanel activity={[correlationActivity]} active={false} />);
    expect(screen.queryByText("Working…")).not.toBeInTheDocument();
  });

  it("compresses a finished run into 'N actions completed · Xs' with a View activity toggle", () => {
    render(
      <AgentActivityPanel
        activity={[correlationActivity, searchActivity]}
        active={false}
        durationMs={18700}
        defaultCollapsed={true}
      />,
    );

    expect(screen.getByText("2 actions completed")).toBeInTheDocument();
    expect(screen.getByText("· 18.7s")).toBeInTheDocument();
    expect(screen.queryByText(/Checked deterministic relationships/)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "View activity" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("omits the duration from the compressed summary when it isn't known (pre-PERF-01 run)", () => {
    render(
      <AgentActivityPanel
        activity={[correlationActivity]}
        active={false}
        defaultCollapsed={true}
      />,
    );

    expect(screen.getByText("1 action completed")).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("expanding the compressed summary reveals the full checklist again", () => {
    render(
      <AgentActivityPanel
        activity={[correlationActivity]}
        active={false}
        defaultCollapsed={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View activity" }));

    expect(screen.getByText(/Checked deterministic relationships/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide activity" })).toBeInTheDocument();
  });
});
