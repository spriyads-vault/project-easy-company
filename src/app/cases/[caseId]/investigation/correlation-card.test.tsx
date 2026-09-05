import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CorrelationFoundPayload } from "@/lib/analysis/events";
import { CorrelationCard } from "./correlation-card";

const gatewayXCorrelation: CorrelationFoundPayload = {
  productFactId: "fact-clock-40mhz",
  productFactCategory: "clock",
  productFactLabel: "system clock",
  sourceFrequencyMhz: 40,
  harmonicNumber: 5,
  expectedFrequencyMhz: 200,
  measuredFrequencyMhz: 200,
  deviationMhz: 0,
  deviationRatio: 0,
  description: "200 MHz is consistent with the 5th harmonic of \"system clock\".",
};

describe("CorrelationCard", () => {
  it("renders the deterministic 40 MHz x 5 = 200 MHz relationship with its provenance (deterministic correlation rendering)", () => {
    render(<CorrelationCard correlation={gatewayXCorrelation} />);

    expect(screen.getByText("40 MHz × 5 = 200 MHz")).toBeInTheDocument();
    expect(screen.getByText(/ProductFact · clock · system clock/)).toBeInTheDocument();
    expect(screen.getByText(/200 MHz peak/)).toBeInTheDocument();
    expect(screen.getByText("exact match")).toBeInTheDocument();
  });

  it("labels it a candidate relationship, never a root cause", () => {
    render(<CorrelationCard correlation={gatewayXCorrelation} />);
    expect(screen.getByText("Candidate relationship")).toBeInTheDocument();
    expect(screen.queryByText(/root cause/i)).not.toBeInTheDocument();
  });

  it("renders a non-exact deviation as a percentage (boundary case)", () => {
    render(
      <CorrelationCard
        correlation={{ ...gatewayXCorrelation, deviationRatio: 0.0125, measuredFrequencyMhz: 202.5 }}
      />,
    );
    expect(screen.getByText("1.250% deviation")).toBeInTheDocument();
  });

  it("carries no coloured accent border — a plain neutral border-border only (UX-08 correction)", () => {
    render(<CorrelationCard correlation={gatewayXCorrelation} />);
    const card = screen.getByText("40 MHz × 5 = 200 MHz").closest("div")!;
    expect(card.className).not.toMatch(/border-l-2|border-l-muted-foreground|border-l-\S/);
  });

  it("uses no amber/warning colour class, no hardcoded hex, and no glyph character, and 'Candidate relationship' is not a pill/badge element (UX-08 correction)", () => {
    const { container } = render(<CorrelationCard correlation={gatewayXCorrelation} />);
    expect(container.innerHTML).not.toMatch(/warning|amber/i);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(container.textContent).not.toMatch(/[●◆△○]/);
    const candidateLabel = screen.getByText("Candidate relationship");
    expect(candidateLabel.className).not.toMatch(/rounded-full/);
  });
});
