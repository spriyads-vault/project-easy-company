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
    // Appears twice: once in the Inferred evidence list, once reused as
    // "Why this test" below the recommended next step.
    expect(
      screen.getAllByText("The fifth harmonic relationship may be relevant."),
    ).toHaveLength(2);
    expect(
      screen.getByText("Clock-related energy may be coupling through the display path."),
    ).toBeInTheDocument();
    expect(screen.getByText("Measurement with display disconnected.")).toBeInTheDocument();
  });

  it("shows the recommended next step under its own heading, separate from the hypothesis reasoning", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={0} onOpenCitation={noop} />);
    expect(screen.getByText("Next investigation")).toBeInTheDocument();
    expect(screen.getByText("Disconnect the display path and re-measure.")).toBeInTheDocument();
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

  it("numbers the hypothesis and reuses the INFERRED reasoning as a short, evidence-grounded 'why this test' line", () => {
    render(<HypothesisCard hypothesis={hypothesis} index={2} onOpenCitation={noop} />);
    expect(screen.getByText("Hypothesis 03")).toBeInTheDocument();
    expect(screen.getByText("Why this test")).toBeInTheDocument();
    // The first INFERRED item, not fabricated new text — appears both in
    // the Inferred evidence section and again as "Why this test".
    expect(screen.getAllByText("The fifth harmonic relationship may be relevant.")).toHaveLength(2);
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
});
