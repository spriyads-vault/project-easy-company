// App Redesign: the pinned next-action bar, relocated out of
// decision-view.tsx's own scroll region — these tests carry forward the
// "sourced from the real leading hypothesis, no fabricated fields" and
// "Record result" assertions that used to live in decision-view.test.tsx.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RankedHypothesis } from "@/lib/investigation/rank-hypotheses";
import { NextActionBar } from "./next-action-bar";

const leading: RankedHypothesis = {
  hypothesis: {
    productFactId: "fact-clock-40mhz",
    title: "5th harmonic of 40 MHz system clock",
    confidenceBand: "high",
    recommendedNextStep: "Disconnect the display path and re-measure.",
    evidence: [{ category: "missing", description: "Measurement with display disconnected." }],
  },
  originalIndex: 0,
  strength: "leading",
};

const defaultProps = {
  caseId: "case-1",
  productId: "product-1",
  revisionId: "revision-1",
  currentRevisionLabel: "Rev17",
};

describe("NextActionBar", () => {
  it("is sourced from the leading hypothesis's real recommendedNextStep and title — no fabricated fields", () => {
    render(
      <NextActionBar {...defaultProps} leading={leading} showEngineeringChange={false} onRecordResult={vi.fn()} />,
    );
    expect(screen.getByText("Recommended next test")).toBeInTheDocument();
    expect(screen.getByText("Disconnect the display path and re-measure.")).toBeInTheDocument();
    expect(screen.getByText(/5th harmonic of 40 MHz system clock/)).toBeInTheDocument();
  });

  it("clicking Record result calls onRecordResult", () => {
    const onRecordResult = vi.fn();
    render(
      <NextActionBar {...defaultProps} leading={leading} showEngineeringChange={false} onRecordResult={onRecordResult} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    expect(onRecordResult).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is no leading hypothesis and no engineering change to offer", () => {
    const { container } = render(
      <NextActionBar {...defaultProps} leading={null} showEngineeringChange={false} onRecordResult={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers Record engineering change once there is real hypothesis history, even with no leading hypothesis", () => {
    render(
      <NextActionBar {...defaultProps} leading={null} showEngineeringChange={true} onRecordResult={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Record engineering change" })).toBeInTheDocument();
    expect(screen.queryByText("Recommended next test")).not.toBeInTheDocument();
  });
});
