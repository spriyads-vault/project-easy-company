// UX-05: AgentStatusPill now derives its label from deriveWorkflowState —
// these tests focus on the truthful-state boundary that motivated the
// change: a completed run is never shown as bare "Complete", and
// "Resolved" only ever appears when the case record itself says so.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { AgentStatusPill } from "./agent-status-pill";

const hypothesisWithMissingEvidence: HypothesisCreatedPayload = {
  productFactId: "fact-1",
  title: "5th harmonic of 40 MHz system clock",
  confidenceBand: "medium",
  recommendedNextStep: "Disconnect the display path and re-measure.",
  evidence: [{ category: "missing", description: "Measurement with display disconnected." }],
};

describe("AgentStatusPill (UX-05 truthful workflow states)", () => {
  it("reads 'Waiting for a measurement' before any measurement is recorded", () => {
    render(<AgentStatusPill runStatus="idle" busy={false} hasMeasurement={false} hypotheses={[]} timeline={[]} />);
    expect(screen.getByText(/Crado · Waiting for a measurement/)).toBeInTheDocument();
  });

  it("reads 'Agent analysis in progress' while busy, even before runStatus flips to running", () => {
    render(<AgentStatusPill runStatus="idle" busy={true} hasMeasurement={true} hypotheses={[]} timeline={[]} />);
    expect(screen.getByText(/Crado · Agent analysis in progress/)).toBeInTheDocument();
  });

  it("never shows bare 'Complete' for a finished run with open evidence gaps — shows 'Ready for next test' instead", () => {
    render(
      <AgentStatusPill
        runStatus="completed"
        busy={false}
        hasMeasurement={true}
        hypotheses={[hypothesisWithMissingEvidence]}
        timeline={[]}
      />,
    );
    expect(screen.getByText(/Crado · Ready for next test/)).toBeInTheDocument();
    expect(screen.queryByText(/Crado · Complete$/)).not.toBeInTheDocument();
  });

  it("shows 'Resolved' only when the case record itself says resolved, not merely because a run finished", () => {
    const { rerender } = render(
      <AgentStatusPill
        runStatus="completed"
        busy={false}
        hasMeasurement={true}
        hypotheses={[hypothesisWithMissingEvidence]}
        timeline={[]}
      />,
    );
    expect(screen.queryByText(/Crado · Resolved/)).not.toBeInTheDocument();

    rerender(
      <AgentStatusPill
        runStatus="completed"
        busy={false}
        hasMeasurement={true}
        hypotheses={[hypothesisWithMissingEvidence]}
        timeline={[]}
        caseStatus="resolved"
      />,
    );
    expect(screen.getByText(/Crado · Resolved/)).toBeInTheDocument();
  });

  it("reads 'Analysis failed' for a failed run", () => {
    render(<AgentStatusPill runStatus="failed" busy={false} hasMeasurement={true} hypotheses={[]} timeline={[]} />);
    expect(screen.getByText(/Crado · Analysis failed/)).toBeInTheDocument();
  });
});
