// UX-04 reopened (real-time agentic flow): the empty-state placeholder and
// Follow-agent controls this file tests were both direct fixes for the
// live-reproduced defect (see docs/PROGRESS.md) — a completed run whose
// canvas rendered nothing until the browser was refreshed. React Flow
// itself doesn't lay out real pixels in jsdom (no ResizeObserver-driven
// measurement, no real getBoundingClientRect), so these assertions stay at
// the DOM-presence/attribute level — node/edge count, placeholder text,
// control button state — rather than pixel positions or actual pan/zoom,
// which the previous ticket's live browser QA already covers and this
// ticket's live QA (docs/PROGRESS.md) re-verifies.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeasurementRow } from "@/lib/cases/queries";
import { initialWorkspaceState, type WorkspaceState } from "@/lib/investigation/reconstruct";
import { InvestigationCanvas } from "./investigation-canvas";

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

const runningNoNodesYet: WorkspaceState = {
  ...initialWorkspaceState,
  status: "running",
  lastEventSummary: "Analyzing measurement…",
};

const completedState: WorkspaceState = {
  ...initialWorkspaceState,
  status: "completed",
  lastEventSummary: "Investigation complete",
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
  summary: { correlationsFound: 1, hypothesesCreated: 1, clarificationRequired: false },
};

function renderCanvas(props: { measurement: MeasurementRow | null; state: WorkspaceState }) {
  return render(
    <InvestigationCanvas
      measurement={props.measurement}
      state={props.state}
      timeline={[]}
      onSelectMeasurement={vi.fn()}
      onSelectHypothesis={vi.fn()}
      onRecordResult={vi.fn()}
    />,
  );
}

describe("InvestigationCanvas — empty state (UX-04 reopened)", () => {
  it("renders nothing at all for a genuinely idle case (no measurement, no run ever started)", () => {
    const { container } = renderCanvas({ measurement: null, state: initialWorkspaceState });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the real, typed lastEventSummary as a status placeholder — never an unexplained empty canvas — while a run is active but no node exists yet", () => {
    renderCanvas({ measurement: null, state: runningNoNodesYet });
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing measurement…");
    expect(document.querySelectorAll(".react-flow__node")).toHaveLength(0);
  });

  it("replaces the placeholder with the first real node the instant one exists — no refresh required", () => {
    const { rerender } = renderCanvas({ measurement: null, state: runningNoNodesYet });
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing measurement…");

    rerender(
      <InvestigationCanvas
        measurement={measurement}
        state={runningNoNodesYet}
        timeline={[]}
        onSelectMeasurement={vi.fn()}
        onSelectHypothesis={vi.fn()}
        onRecordResult={vi.fn()}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".react-flow__node").length).toBeGreaterThan(0);
  });

  it("never shows the empty-canvas placeholder once the run is complete and the canonical graph is non-empty — the reported defect", () => {
    renderCanvas({ measurement, state: completedState });
    expect(screen.queryByRole("status", { name: "" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".react-flow__node").length).toBeGreaterThan(0);
  });
});

describe("InvestigationCanvas — Follow agent control (UX-04 reopened)", () => {
  it("is on by default once the canvas has rendered", () => {
    renderCanvas({ measurement, state: completedState });
    const button = screen.getByRole("button", { name: /following agent/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles off when clicked, and back on when clicked again", () => {
    renderCanvas({ measurement, state: completedState });
    const button = screen.getByRole("button", { name: /following agent/i });

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Follow agent" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Follow agent" }));
    expect(screen.getByRole("button", { name: /following agent/i })).toHaveAttribute("aria-pressed", "true");
  });
});
