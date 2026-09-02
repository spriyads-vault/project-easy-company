import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { EvidenceView } from "./evidence-view";

function hypothesis(overrides: Partial<HypothesisCreatedPayload> = {}): HypothesisCreatedPayload {
  return {
    productFactId: "fact-1",
    title: "5th harmonic of 40 MHz system clock",
    confidenceBand: "medium",
    recommendedNextStep: "Disconnect the display path and re-measure.",
    evidence: [
      { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
      {
        category: "known",
        description: "40 MHz system clock documented.",
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
      { category: "inferred", description: "The fifth harmonic relationship may be relevant." },
      { category: "missing", description: "Measurement with display disconnected." },
    ],
    ...overrides,
  };
}

describe("EvidenceView", () => {
  it("shows an honest empty state when no hypotheses exist yet (empty state)", () => {
    render(<EvidenceView hypotheses={[]} onOpenCitation={vi.fn()} />);
    expect(screen.getByText(/No evidence yet/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders one table row per evidence item, labeled by its OBSERVED/KNOWN/INFERRED/MISSING category (populated state)", () => {
    render(<EvidenceView hypotheses={[hypothesis()]} onOpenCitation={vi.fn()} revisionLabel="Rev17" />);

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // 1 header row + 4 evidence rows.
    expect(rows).toHaveLength(5);
    expect(within(table).getByText("Observed")).toBeInTheDocument();
    expect(within(table).getByText("Known")).toBeInTheDocument();
    expect(within(table).getByText("Inferred")).toBeInTheDocument();
    expect(within(table).getByText("Missing")).toBeInTheDocument();
    // Never silently promoted — an inferred reading stays visually and
    // textually distinct from a known fact.
    expect(within(table).getByText("The fifth harmonic relationship may be relevant.")).toBeInTheDocument();
  });

  it("shows the real revision the run pertains to in every row, and an em dash for evidence with no document source (missing optional values)", () => {
    render(<EvidenceView hypotheses={[hypothesis()]} onOpenCitation={vi.fn()} revisionLabel="Rev17" />);
    const cells = screen.getAllByText("Rev17");
    expect(cells.length).toBe(4);
    // The observed/inferred/missing rows have no citation.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("opens the source drawer with the right citation and category when a sourced row's badge is clicked (source and citation links)", () => {
    const onOpenCitation = vi.fn();
    render(<EvidenceView hypotheses={[hypothesis()]} onOpenCitation={onOpenCitation} />);
    fireEvent.click(screen.getByRole("button", { name: /Gateway-X-Schematic-Rev17\.pdf/ }));
    expect(onOpenCitation).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "Gateway-X-Schematic-Rev17.pdf" }),
      "known",
      0,
      "5th harmonic of 40 MHz system clock",
    );
  });

  it("selects the owning hypothesis when its title is clicked in the Used by column (click-through to context rail)", () => {
    const onSelectHypothesis = vi.fn();
    const h = hypothesis();
    render(<EvidenceView hypotheses={[h]} onOpenCitation={vi.fn()} onSelectHypothesis={onSelectHypothesis} />);
    fireEvent.click(screen.getAllByRole("button", { name: h.title })[0]);
    expect(onSelectHypothesis).toHaveBeenCalledWith(h, 0);
  });

  it("renders long evidence descriptions in full, wrapped rather than truncated (long content)", () => {
    const longDescription =
      "A very long observed-evidence description describing the cumulative, monotonic response of the 200 MHz peak to a sequence of physical interventions on the display cable path across several re-measurements.";
    render(
      <EvidenceView
        hypotheses={[hypothesis({ evidence: [{ category: "observed", description: longDescription }] })]}
        onOpenCitation={vi.fn()}
      />,
    );
    expect(screen.getByText(longDescription)).toBeInTheDocument();
  });

  it("keeps every row's category/evidence/source/revision/used-by columns scrollable inside the table container on narrow viewports (horizontal overflow)", () => {
    render(<EvidenceView hypotheses={[hypothesis()]} onOpenCitation={vi.fn()} />);
    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
  });
});
