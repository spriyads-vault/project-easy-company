import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { HypothesisCard } from "./hypothesis-card";

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
    render(<HypothesisCard hypothesis={hypothesis} />);

    expect(screen.getByText(hypothesis.title)).toBeInTheDocument();
    expect(screen.getByText("Observed")).toBeInTheDocument();
    expect(screen.getByText("Known")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();

    expect(screen.getByText("200 MHz peak, 7.4 dB above the selected limit.")).toBeInTheDocument();
    expect(screen.getByText("40 MHz system clock.")).toBeInTheDocument();
    expect(screen.getByText("Display active.")).toBeInTheDocument();
    expect(
      screen.getByText("The fifth harmonic relationship may be relevant."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Clock-related energy may be coupling through the display path."),
    ).toBeInTheDocument();
    expect(screen.getByText("Measurement with display disconnected.")).toBeInTheDocument();
  });

  it("shows the recommended next step under its own heading, separate from the hypothesis reasoning", () => {
    render(<HypothesisCard hypothesis={hypothesis} />);
    expect(screen.getByText("Next investigation")).toBeInTheDocument();
    expect(screen.getByText("Disconnect the display path and re-measure.")).toBeInTheDocument();
  });

  it("shows the confidence band and never presents inference as fact", () => {
    render(<HypothesisCard hypothesis={hypothesis} />);
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  it("omits an evidence section entirely when it has no items (boundary case)", () => {
    render(
      <HypothesisCard
        hypothesis={{
          ...hypothesis,
          evidence: [{ category: "inferred", description: "Only an inference, nothing else." }],
        }}
      />,
    );
    expect(screen.queryByText("Observed")).not.toBeInTheDocument();
    expect(screen.queryByText("Known")).not.toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });
});
