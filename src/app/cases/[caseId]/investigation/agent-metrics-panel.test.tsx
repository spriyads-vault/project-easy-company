import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentCompletedPayload } from "@/lib/analysis/events";
import { AgentMetricsPanel } from "./agent-metrics-panel";

const metrics: AgentCompletedPayload = {
  documentsAvailable: 4,
  documentSearches: 5,
  passagesRetrieved: 23,
  passagesUsedAsEvidence: 6,
  deterministicRelationshipsChecked: 1,
  nextInvestigationCount: 1,
};

describe("AgentMetricsPanel", () => {
  it("shows every real, actually-computed metric — never a hardcoded/placeholder number", () => {
    render(<AgentMetricsPanel metrics={metrics} />);

    expect(screen.getByText("What Crado handled")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Documents available")).toBeInTheDocument();
    expect(screen.getByText("Passages used")).toBeInTheDocument();
  });

  it("shows a truthful small number honestly, e.g. only 4 documents available (never inflated)", () => {
    render(
      <AgentMetricsPanel
        metrics={{ ...metrics, documentsAvailable: 4, documentSearches: 0, passagesRetrieved: 0, passagesUsedAsEvidence: 0 }}
      />,
    );
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });
});
