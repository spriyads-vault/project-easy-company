import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentCompletedPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import { SourcesPanel } from "./sources-panel";

const baseMetrics: AgentCompletedPayload = {
  documentsAvailable: 4,
  documentSearches: 5,
  passagesRetrieved: 23,
  passagesUsedAsEvidence: 3,
  deterministicRelationshipsChecked: 1,
  nextInvestigationCount: 1,
};

function hypothesisWithCitations(): HypothesisCreatedPayload {
  return {
    productFactId: "fact-1",
    title: "Test hypothesis",
    confidenceBand: "medium",
    recommendedNextStep: "Re-measure.",
    evidence: [
      { category: "observed", description: "Measured 200 MHz." },
      {
        category: "known",
        description: "Schematic passage",
        citation: {
          documentId: "doc-1",
          chunkId: "chunk-1",
          filename: "Gateway-X-Schematic-Rev17.pdf",
          documentType: "schematic",
          pageNumber: 8,
          section: null,
          passage: "Display interface driven from the 40 MHz subsystem.",
        },
      },
      {
        category: "known",
        description: "Second passage, same document",
        citation: {
          documentId: "doc-1",
          chunkId: "chunk-2",
          filename: "Gateway-X-Schematic-Rev17.pdf",
          documentType: "schematic",
          pageNumber: 9,
          section: null,
          passage: "Second passage text.",
        },
      },
      {
        category: "known",
        description: "Test report passage",
        citation: {
          documentId: "doc-2",
          chunkId: "chunk-3",
          filename: "EMC-Test-04.pdf",
          documentType: "test_report",
          pageNumber: null,
          section: "Suspected Source",
          passage: "40 MHz clock is a candidate.",
        },
      },
    ],
  };
}

describe("SourcesPanel", () => {
  it("renders nothing when the agent phase never ran (metrics null)", () => {
    const { container } = render(<SourcesPanel hypotheses={[]} metrics={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each distinct document actually used, deduped, with a real per-document passage count (multiple sources)", () => {
    render(<SourcesPanel hypotheses={[hypothesisWithCitations()]} metrics={baseMetrics} />);

    expect(screen.getByText("Gateway-X-Schematic-Rev17.pdf")).toBeInTheDocument();
    expect(screen.getByText("EMC-Test-04.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 passages used")).toBeInTheDocument();
    expect(screen.getByText("1 passage used")).toBeInTheDocument();
    expect(screen.getByText("View all sources →")).toHaveAttribute("href", "/documents");
  });

  it("shows the honest empty state when no passages were retrieved at all (no retrieved documents)", () => {
    render(
      <SourcesPanel
        hypotheses={[]}
        metrics={{ ...baseMetrics, documentSearches: 2, passagesRetrieved: 0, passagesUsedAsEvidence: 0 }}
      />,
    );
    expect(
      screen.getByText("No relevant passages were retrieved for this investigation."),
    ).toBeInTheDocument();
  });

  it("shows a distinct empty state when passages were retrieved but none were used as evidence", () => {
    render(
      <SourcesPanel
        hypotheses={[]}
        metrics={{ ...baseMetrics, passagesRetrieved: 10, passagesUsedAsEvidence: 0 }}
      />,
    );
    expect(
      screen.getByText("No document passages were used as evidence in this investigation."),
    ).toBeInTheDocument();
  });
});
