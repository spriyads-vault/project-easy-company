import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MeasurementComparison } from "@/lib/measurements/compare-measurements";
import { RevisionComparisonCard } from "./revision-comparison-card";

const gatewayXComparison: MeasurementComparison = {
  before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
  after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -3.6 },
  deltaDb: 11,
  improved: true,
  sameFrequency: true,
};

describe("RevisionComparisonCard", () => {
  it("shows the real before/after values from each revision (Gateway X 11 dB improvement)", () => {
    render(<RevisionComparisonCard comparison={gatewayXComparison} />);

    expect(screen.getByText("Before · Rev17")).toBeInTheDocument();
    expect(screen.getByText("7.4 dB above selected limit")).toBeInTheDocument();
    expect(screen.getByText("After · Rev18")).toBeInTheDocument();
    expect(screen.getByText("3.6 dB below selected limit")).toBeInTheDocument();
    expect(screen.getByText("11.0 dB")).toBeInTheDocument();
    expect(screen.getByText(/Margin improved by 11.0 dB/)).toBeInTheDocument();
  });

  it("never uses PASS, FAIL, or CERTIFIED language (no pass/certification claim)", () => {
    render(<RevisionComparisonCard comparison={gatewayXComparison} />);
    expect(screen.queryByText(/PASS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FAIL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CERTIFIED/)).not.toBeInTheDocument();
  });

  it("shows a regression without hiding or reframing the delta (worsened case)", () => {
    const regression: MeasurementComparison = {
      before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: -1 },
      after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 2 },
      deltaDb: -3,
      improved: false,
      sameFrequency: true,
    };
    render(<RevisionComparisonCard comparison={regression} />);
    expect(screen.getByText("-3.0 dB")).toBeInTheDocument();
    expect(screen.getByText(/Margin worsened by 3.0 dB/)).toBeInTheDocument();
  });

  it("flags a different-frequency comparison instead of presenting it as a single result (boundary case)", () => {
    const differentFrequency: MeasurementComparison = {
      before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
      after: { revisionLabel: "Rev18", frequencyMhz: 150, marginDb: -1 },
      deltaDb: 8.4,
      improved: true,
      sameFrequency: false,
    };
    render(<RevisionComparisonCard comparison={differentFrequency} />);
    expect(screen.getByText(/different frequencies/)).toBeInTheDocument();
  });
});
