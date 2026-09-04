// App Redesign, Workstream C correction: DecisionView is now a flat
// workbench (failure strip + master investigation item table + real
// outcome), not a stack of cards. These tests focus on what changed:
// the strip's real measurement fields, table row presence/ordering
// tracking real data (never a fabricated row), and row-click selection
// — the pinned "Recommended next test" bar and "Record result" action
// moved to next-action-bar.tsx (see that file's own test) since they
// must stay visible outside this component's own scroll region.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeasurementRow } from "@/lib/cases/queries";
import { initialWorkspaceState, type WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { DecisionView } from "./decision-view";

const measurement: MeasurementRow = {
  id: "measurement-1",
  label: null,
  operatingMode: "WiFi TX + display active",
  notes: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  productRevisionId: "revision-1",
  revisionLabel: "Rev17",
  peaks: [{ id: "peak-1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
};

function renderView(state: WorkspaceState, timeline: TimelineEntry[] = []) {
  return render(
    <DecisionView
      caseId="case-1"
      measurement={measurement}
      state={state}
      timeline={timeline}
      selection={null}
      onSelectMeasurement={vi.fn()}
      onSelectCorrelation={vi.fn()}
      onSelectHypothesis={vi.fn()}
    />,
  );
}

describe("DecisionView — flat workbench tracks real data (App Redesign)", () => {
  it("always shows the failure strip's real measurement fields, even with no correlations or hypotheses yet", () => {
    renderView(initialWorkspaceState);
    // "200 MHz" appears twice — the failure strip's stat cell and the
    // spectrum plot's own peak label — so this asserts presence, not
    // uniqueness.
    expect(screen.getAllByText("200 MHz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+7.4 dB").length).toBeGreaterThan(0);
    expect(screen.getByText("No deterministic correlations or hypotheses yet for this measurement.")).toBeInTheDocument();
  });

  it("shows a Known deterministic row only once a real correlation exists", () => {
    const state: WorkspaceState = {
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
    };
    renderView(state);
    expect(screen.getByText("Known")).toBeInTheDocument();
    expect(screen.getByText(/40 MHz × 5 = 200 MHz/)).toBeInTheDocument();
  });

  it("orders leading hypotheses before weaker ones and labels each row honestly, as Inferred", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [
        {
          productFactId: "fact-low",
          title: "Low-confidence lead",
          confidenceBand: "low",
          recommendedNextStep: "Check the low-confidence lead.",
          evidence: [],
        },
        {
          productFactId: "fact-high",
          title: "High-confidence lead",
          confidenceBand: "high",
          recommendedNextStep: "Disconnect the display path and re-measure.",
          evidence: [{ category: "missing", description: "Measurement with display disconnected." }],
        },
      ],
    };
    renderView(state);

    const rowTitles = screen.getAllByRole("button").map((el) => el.textContent).filter((text) => text?.includes("confidence lead"));
    const highIndex = rowTitles.findIndex((text) => text?.includes("High-confidence lead"));
    const lowIndex = rowTitles.findIndex((text) => text?.includes("Low-confidence lead"));
    expect(highIndex).toBeLessThan(lowIndex);
    expect(screen.getAllByText("Inferred").length).toBe(2);
    expect(screen.getByText("Leading")).toBeInTheDocument();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
  });

  it("clicking a hypothesis row calls onSelectHypothesis with the real hypothesis and its original index", () => {
    const onSelectHypothesis = vi.fn();
    const hypothesis = {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "high" as const,
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [],
    };
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis] };
    render(
      <DecisionView
        caseId="case-1"
        measurement={measurement}
        state={state}
        timeline={[]}
        selection={null}
        onSelectMeasurement={vi.fn()}
        onSelectCorrelation={vi.fn()}
        onSelectHypothesis={onSelectHypothesis}
      />,
    );
    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));
    expect(onSelectHypothesis).toHaveBeenCalledWith(hypothesis, 0);
  });

  it("clicking a deterministic row calls onSelectCorrelation with the real correlation", () => {
    const onSelectCorrelation = vi.fn();
    const correlation = {
      productFactId: "fact-clock-40mhz",
      productFactCategory: "clock" as const,
      productFactLabel: "system clock",
      sourceFrequencyMhz: 40,
      harmonicNumber: 5,
      expectedFrequencyMhz: 200,
      measuredFrequencyMhz: 200,
      deviationMhz: 0,
      deviationRatio: 0,
      description: "200 MHz is consistent with the 5th harmonic.",
    };
    const state: WorkspaceState = { ...initialWorkspaceState, correlations: [correlation] };
    render(
      <DecisionView
        caseId="case-1"
        measurement={measurement}
        state={state}
        timeline={[]}
        selection={null}
        onSelectMeasurement={vi.fn()}
        onSelectCorrelation={onSelectCorrelation}
        onSelectHypothesis={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/40 MHz × 5 = 200 MHz/));
    expect(onSelectCorrelation).toHaveBeenCalledWith(correlation);
  });

  it("shows the before/after outcome only once a real result exists on the timeline, using the most recent one", () => {
    const state: WorkspaceState = { ...initialWorkspaceState };
    const timeline: TimelineEntry[] = [
      {
        type: "result",
        id: "result-1",
        createdAt: "2026-08-30T00:00:00.000Z",
        comparison: {
          before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
          after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 2.0 },
          deltaDb: 5.4,
          improved: true,
          sameFrequency: true,
        },
      },
      {
        type: "result",
        id: "result-2",
        createdAt: "2026-08-31T00:00:00.000Z",
        comparison: {
          before: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 2.0 },
          after: { revisionLabel: "Rev19", frequencyMhz: 200, marginDb: -1.0 },
          deltaDb: 3.0,
          improved: true,
          sameFrequency: true,
        },
      },
    ];
    renderView(state, timeline);

    expect(screen.getByText("Before / after comparison")).toBeInTheDocument();
    // The most recent result (Rev18 → Rev19), not the earlier one.
    expect(screen.getByText("Before · Rev18")).toBeInTheDocument();
    expect(screen.getByText("After · Rev19")).toBeInTheDocument();
  });

  it("shows no outcome section when the timeline has no result entry", () => {
    renderView(initialWorkspaceState, []);
    expect(screen.queryByText("Before / after comparison")).not.toBeInTheDocument();
  });
});
