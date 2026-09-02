import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeasurementRow } from "@/lib/cases/queries";
import { initialWorkspaceState, type WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { MobileInvestigationStack } from "./investigation-stack";

const measurement: MeasurementRow = {
  id: "measurement-1",
  label: null,
  operatingMode: "WiFi TX",
  notes: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  productRevisionId: "revision-1",
  revisionLabel: "Rev17",
  peaks: [{ id: "peak-1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
};

const stateWithHypothesis: WorkspaceState = {
  ...initialWorkspaceState,
  correlations: [
    {
      productFactId: "fact-clock-40mhz",
      productFactCategory: "clock",
      productFactLabel: "system clock",
      sourceFrequencyMhz: 40,
      harmonicNumber: 5,
      expectedFrequencyMhz: 200,
      measuredFrequencyMhz: 200,
      deviationMhz: 0,
      deviationRatio: 0,
      description: "200 MHz is consistent with the 5th harmonic.",
    },
  ],
  hypotheses: [
    {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "medium",
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [
        { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
        { category: "missing", description: "Measurement with display disconnected." },
      ],
    },
  ],
};

describe("MobileInvestigationStack", () => {
  it("shows an empty state with no fabricated artifacts when there is no measurement yet", () => {
    render(
      <MobileInvestigationStack
        measurement={null}
        state={initialWorkspaceState}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onRecordResult={vi.fn()}
      />,
    );
    expect(screen.getByText(/add a measurement to start the investigation/i)).toBeInTheDocument();
  });

  it("renders the same reading order as the canvas: measurement, then correlation, then each hypothesis's own branch", () => {
    render(
      <MobileInvestigationStack
        measurement={measurement}
        state={stateWithHypothesis}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onRecordResult={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const text = items.map((item) => item.textContent ?? "").join(" | ");
    const measurementIndex = text.indexOf("200");
    const correlationIndex = text.indexOf("40 × 5 = 200");
    const hypothesisIndex = text.indexOf("5th harmonic of 40 MHz system clock");
    const missingIndex = text.indexOf("Measurement with display disconnected.");
    const nextTestIndex = text.indexOf("Disconnect the display path and re-measure.");
    expect(measurementIndex).toBeGreaterThanOrEqual(0);
    expect(measurementIndex).toBeLessThan(correlationIndex);
    expect(correlationIndex).toBeLessThan(hypothesisIndex);
    expect(hypothesisIndex).toBeLessThan(missingIndex);
    expect(missingIndex).toBeLessThan(nextTestIndex);
  });

  it("calls onSelectMeasurement when the measurement artifact is tapped", () => {
    const onSelectMeasurement = vi.fn();
    render(
      <MobileInvestigationStack
        measurement={measurement}
        state={initialWorkspaceState}
        timeline={[]}
        onSelectMeasurement={onSelectMeasurement}
        onSelectHypothesis={vi.fn()}
        onRecordResult={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Measurement").closest("button")!);
    expect(onSelectMeasurement).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectHypothesis with the exact hypothesis and index when a hypothesis artifact is tapped", () => {
    const onSelectHypothesis = vi.fn();
    render(
      <MobileInvestigationStack
        measurement={measurement}
        state={stateWithHypothesis}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={onSelectHypothesis}
        onRecordResult={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock").closest("button")!);
    expect(onSelectHypothesis).toHaveBeenCalledWith(stateWithHypothesis.hypotheses[0], 0);
  });

  it("calls onRecordResult from the next-test artifact's Record result button", () => {
    const onRecordResult = vi.fn();
    render(
      <MobileInvestigationStack
        measurement={measurement}
        state={stateWithHypothesis}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onRecordResult={onRecordResult}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    expect(onRecordResult).toHaveBeenCalledTimes(1);
  });

  it("renders history entries (observation/change/result) after the trunk, non-interactively", () => {
    const timeline: TimelineEntry[] = [
      {
        type: "observation",
        id: "obs-1",
        createdAt: "2026-08-31T01:00:00.000Z",
        observation: "Reflowed the ferrite bead.",
        measurementChange: null,
      },
    ];
    render(
      <MobileInvestigationStack
        measurement={measurement}
        state={initialWorkspaceState}
        timeline={timeline}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onRecordResult={vi.fn()}
      />,
    );
    const observationText = screen.getByText("Reflowed the ferrite bead.");
    expect(observationText.closest("button")).toBeNull();
  });
});
