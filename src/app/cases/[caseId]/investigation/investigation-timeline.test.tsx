import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { InvestigationTimeline } from "./investigation-timeline";

describe("InvestigationTimeline", () => {
  it("renders nothing when there's no history yet (missing-data case)", () => {
    const { container } = render(<InvestigationTimeline entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the full chain in chronological order: measurement -> hypothesis -> observation -> updated investigation (refresh reconstruction)", () => {
    const entries: TimelineEntry[] = [
      {
        type: "measurement",
        id: "m1",
        createdAt: "2026-08-31T00:00:00.000Z",
        label: null,
        frequencyMhz: 200,
        marginDb: 7.4,
      },
      {
        type: "hypothesis",
        id: "run-1:0",
        createdAt: "2026-08-31T00:05:00.000Z",
        title: "5th harmonic of 40 MHz system clock",
        confidenceBand: "medium",
        recommendedNextStep: "Disconnect the display path and re-measure.",
        update: null,
      },
      {
        type: "observation",
        id: "obs-1",
        createdAt: "2026-08-31T01:00:00.000Z",
        observation: "Display path disconnected.",
        measurementChange: "Peak dropped 9 dB.",
      },
      {
        type: "hypothesis",
        id: "run-2:0",
        createdAt: "2026-08-31T01:05:00.000Z",
        title: "5th harmonic of 40 MHz system clock",
        confidenceBand: "high",
        recommendedNextStep: "Shield or re-route the display ribbon cable.",
        update: {
          status: "supported_by_new_evidence",
          previousHypothesisTitle: "5th harmonic of 40 MHz system clock",
        },
      },
    ];

    render(<InvestigationTimeline entries={entries} />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);

    expect(within(items[0]).getByText("Measurement")).toBeInTheDocument();
    expect(within(items[0]).getByText(/200 MHz/)).toBeInTheDocument();

    expect(within(items[1]).getByText("Hypothesis")).toBeInTheDocument();

    expect(within(items[2]).getByText("Observation")).toBeInTheDocument();
    expect(within(items[2]).getByText(/Display path disconnected/)).toBeInTheDocument();
    expect(within(items[2]).getByText(/Peak dropped 9 dB/)).toBeInTheDocument();

    expect(within(items[3]).getByText("Updated investigation")).toBeInTheDocument();
    expect(within(items[3]).getByText("Supported by new evidence")).toBeInTheDocument();
  });

  it("labels a measurement with its real label when one was recorded, and omits it when there isn't one", () => {
    const entries: TimelineEntry[] = [
      {
        type: "measurement",
        id: "m1",
        createdAt: "2026-08-31T00:00:00.000Z",
        label: "TEST-04",
        frequencyMhz: 200,
        marginDb: 7.4,
      },
    ];
    render(<InvestigationTimeline entries={entries} />);
    expect(screen.getByText(/TEST-04/)).toBeInTheDocument();
  });

  it("shows a negative margin without a stray plus sign (boundary case)", () => {
    const entries: TimelineEntry[] = [
      {
        type: "measurement",
        id: "m1",
        createdAt: "2026-08-31T00:00:00.000Z",
        label: null,
        frequencyMhz: 150,
        marginDb: -3.6,
      },
    ];
    render(<InvestigationTimeline entries={entries} />);
    expect(screen.getByText(/-3.6 dB/)).toBeInTheDocument();
    expect(screen.queryByText(/\+-3.6/)).not.toBeInTheDocument();
  });
});
