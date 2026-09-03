// UX-05 (Decision-centred investigation workspace): DecisionView composes
// four already-tested UX-03 artifact components verbatim
// (MeasurementPanel, CorrelationCard, HypothesisCard,
// RevisionComparisonCard) — these tests focus on what's actually new here:
// section presence/absence tracking real data (never a fabricated
// section), hypothesis ranking/strength labeling, and the
// Recommended-next-test card being sourced from the real leading
// hypothesis with no invented fields.
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
      onSelectMeasurement={vi.fn()}
      onSelectHypothesis={vi.fn()}
      onOpenCitation={vi.fn()}
      onRecordResult={vi.fn()}
    />,
  );
}

describe("DecisionView — section presence tracks real data (UX-05)", () => {
  it("always shows the Measurement panel, even with no correlations or hypotheses yet", () => {
    renderView(initialWorkspaceState);
    expect(screen.getByText("Measurement")).toBeInTheDocument();
    expect(screen.queryByText("What Crado knows")).not.toBeInTheDocument();
    expect(screen.queryByText("Leading hypotheses")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommended next test")).not.toBeInTheDocument();
  });

  it("shows 'What Crado knows' only once a real correlation exists", () => {
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
    expect(screen.getByText("What Crado knows")).toBeInTheDocument();
  });

  it("orders leading hypotheses before weaker ones and labels each honestly", () => {
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

    const headings = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    expect(headings.indexOf("High-confidence lead")).toBeLessThan(headings.indexOf("Low-confidence lead"));
    expect(screen.getByText("Leading")).toBeInTheDocument();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
  });

  it("Recommended next test is sourced from the leading hypothesis's real recommendedNextStep — no fabricated fields", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "5th harmonic of 40 MHz system clock",
          confidenceBand: "high",
          recommendedNextStep: "Disconnect the display path and re-measure.",
          evidence: [{ category: "missing", description: "Measurement with display disconnected." }],
        },
      ],
    };
    renderView(state);

    const section = screen.getByText("Recommended next test").closest("section")!;
    expect(section).toHaveTextContent("Disconnect the display path and re-measure.");
    expect(section).toHaveTextContent("5th harmonic of 40 MHz system clock");
  });

  it("clicking Record result calls onRecordResult", () => {
    const onRecordResult = vi.fn();
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "5th harmonic of 40 MHz system clock",
          confidenceBand: "high",
          recommendedNextStep: "Disconnect the display path and re-measure.",
          evidence: [],
        },
      ],
    };
    render(
      <DecisionView
        caseId="case-1"
        measurement={measurement}
        state={state}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onOpenCitation={vi.fn()}
        onRecordResult={onRecordResult}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    expect(onRecordResult).toHaveBeenCalledTimes(1);
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
