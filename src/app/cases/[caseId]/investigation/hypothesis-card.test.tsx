import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { HypothesisCard } from "./hypothesis-card";

const noop = () => {};

const hypothesis: HypothesisCreatedPayload = {
  productFactId: "fact-clock-40mhz",
  title: "5th harmonic of 40 MHz system clock aligning with 200 MHz emission",
  confidenceBand: "medium",
  recommendedNextStep: "Disconnect the display path and re-measure.",
  evidence: [
    { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
    { category: "known", description: "40 MHz system clock." },
    { category: "known", description: "Display active." },
    { category: "inferred", description: "The fifth harmonic relationship may be relevant." },
    {
      category: "inferred",
      description: "Clock-related energy may be coupling through the display path.",
    },
    { category: "missing", description: "Measurement with display disconnected." },
  ],
};

describe("HypothesisCard", () => {
  it("separates evidence into OBSERVED / KNOWN / INFERRED / MISSING sections (hypothesis evidence categories)", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);

    expect(screen.getByText(hypothesis.title)).toBeInTheDocument();
    expect(screen.getByText("Observed")).toBeInTheDocument();
    expect(screen.getByText("Known")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();

    expect(screen.getByText("200 MHz peak, 7.4 dB above the selected limit.")).toBeInTheDocument();
    expect(screen.getByText("40 MHz system clock.")).toBeInTheDocument();
    expect(screen.getByText("Display active.")).toBeInTheDocument();
    expect(screen.getByText("The fifth harmonic relationship may be relevant.")).toBeInTheDocument();
    expect(
      screen.getByText("Clock-related energy may be coupling through the display path."),
    ).toBeInTheDocument();
    expect(screen.getByText("Measurement with display disconnected.")).toBeInTheDocument();
  });

  it("never renders the recommended next step or a 'Why this test' restatement of the INFERRED reasoning inside the card (UX-07 correction bugs 1b/1c)", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);
    // Both used to render here — a duplicate of the pinned next-action
    // bar's own copy (1c), and a verbatim reprint of the INFERRED
    // paragraph already shown above it (1b). Neither has a home in this
    // component any more.
    expect(screen.queryByText("Next investigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Why this test")).not.toBeInTheDocument();
    expect(screen.queryByText("Disconnect the display path and re-measure.")).not.toBeInTheDocument();
    // The INFERRED paragraph itself still renders — exactly once, in its
    // own Inferred section, never printed a second time anywhere else in
    // this card.
    expect(
      screen.getAllByText("The fifth harmonic relationship may be relevant."),
    ).toHaveLength(1);
  });

  it("shows the confidence band and never presents inference as fact", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  it("omits an evidence section entirely when it has no items (boundary case)", () => {
    render(
      <HypothesisCard
        hypothesis={{
          ...hypothesis,
          evidence: [{ category: "inferred", description: "Only an inference, nothing else." }],
        }}
        index={0}
        onOpenCitation={noop}
      />,
    );
    expect(screen.queryByText("Observed")).not.toBeInTheDocument();
    expect(screen.queryByText("Known")).not.toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("numbers the hypothesis using its real position among this run's other hypotheses (one-based, zero-padded)", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={2} onOpenCitation={noop} />);
    expect(screen.getByText("Hypothesis 03")).toBeInTheDocument();
  });

  it("renders a clickable citation beside a document-sourced KNOWN item and opens it with the real chunk/document ids", () => {
    const onOpenCitation = vi.fn();
    const withCitation: HypothesisCreatedPayload = {
      ...hypothesis,
      evidence: [
        ...hypothesis.evidence,
        {
          category: "known",
          description: 'EMC-Test-04.md (Suspected Source): "The 40 MHz clock is a candidate."',
          citation: {
            documentId: "doc-1",
            chunkId: "chunk-1",
            filename: "EMC-Test-04.md",
            documentType: "test_report",
            pageNumber: null,
            section: "Suspected Source",
            passage: "The 40 MHz clock is a candidate.",
          },
        },
      ],
    };

    render(<HypothesisCard hypothesis={withCitation} index={0} onOpenCitation={onOpenCitation} />);
    const citationButton = screen.getByRole("button", { name: /EMC-Test-04\.md/ });
    fireEvent.click(citationButton);

    expect(onOpenCitation).toHaveBeenCalledWith(
      withCitation.evidence[withCitation.evidence.length - 1].citation,
      "known",
      0,
      hypothesis.title,
    );
  });

  it("renders KNOWN items without a citation with no clickable badge (not every KNOWN item is document-sourced)", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);
    expect(screen.queryByRole("button", { name: /\.md|\.pdf/ })).not.toBeInTheDocument();
  });

  it("shows a qualitative hypothesis-update badge when this hypothesis continues an earlier one (MVP-11)", () => {
    const updated: HypothesisCreatedPayload = {
      ...hypothesis,
      update: {
        status: "supported_by_new_evidence",
        previousHypothesisTitle: "An earlier hypothesis on this case",
      },
    };
    render(<HypothesisCard hypothesis={updated} index={0} onOpenCitation={noop} />);
    expect(screen.getByText("Supported by new evidence")).toBeInTheDocument();
  });

  it("renders no update badge for a fresh hypothesis with no earlier counterpart", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);
    expect(screen.queryByText(/supported by new evidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/weakened by new evidence/i)).not.toBeInTheDocument();
  });
});
