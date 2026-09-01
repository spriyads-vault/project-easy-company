import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows the compact primary row of truthful work-saved metrics without opening any detail (UX-01)", () => {
    render(<AgentMetricsPanel metrics={metrics} toolCallCount={3} sourcesUsedCount={7} />);

    expect(screen.getByText("What Crado handled")).toBeInTheDocument();
    expect(screen.getByText("Tools used")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Sources cited")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Next test")).toBeInTheDocument();
    // metrics carries no stepCount here, so "Model steps" is truthfully
    // omitted rather than showing a fabricated 0 (see the next test).
    expect(screen.queryByText("Model steps")).not.toBeInTheDocument();
  });

  it("shows Model steps in the primary row once stepCount is present (PERF-01 instrumentation)", () => {
    render(
      <AgentMetricsPanel
        metrics={{ ...metrics, stepCount: 2 }}
        toolCallCount={3}
        sourcesUsedCount={7}
      />,
    );
    expect(screen.getByText("Model steps")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("keeps document/passage/timing counts out of the primary row, visible only once the technical detail is expanded", () => {
    render(<AgentMetricsPanel metrics={metrics} toolCallCount={3} sourcesUsedCount={2} />);

    // <details> content is present in the DOM either way (getByText/
    // queryByText never check CSS visibility) — toBeVisible is jest-dom's
    // actual closed-<details> check, which is what a real viewer sees.
    expect(screen.getByText("Documents available")).not.toBeVisible();
    expect(screen.getByText("Passages used")).not.toBeVisible();

    fireEvent.click(screen.getByText("Show technical detail"));

    expect(screen.getByText("Documents available")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText("Passages used")).toBeVisible();
    expect(screen.getByText("6")).toBeVisible();
  });

  it("shows a truthful small number honestly, e.g. only 4 documents available (never inflated)", () => {
    render(
      <AgentMetricsPanel
        metrics={{ ...metrics, documentsAvailable: 4, documentSearches: 0, passagesRetrieved: 0, passagesUsedAsEvidence: 0 }}
        toolCallCount={1}
        sourcesUsedCount={0}
      />,
    );
    fireEvent.click(screen.getByText("Show technical detail"));
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });
});
