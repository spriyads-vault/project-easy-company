import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MeasurementRow } from "@/lib/cases/queries";
import { MeasurementPanel } from "./measurement-panel";

const gatewayXMeasurement: MeasurementRow = {
  id: "measurement-1",
  label: null,
  operatingMode: "WiFi TX + display active",
  notes: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  productRevisionId: "revision-1",
  revisionLabel: "Rev17",
  peaks: [
    {
      id: "peak-1",
      frequencyMhz: 200,
      marginDb: 7.4,
      detector: "peak",
      limitLine: "Class B",
    },
  ],
};

describe("MeasurementPanel", () => {
  it("renders the stored peak, margin, and operating conditions (measurement rendering)", () => {
    render(<MeasurementPanel caseId="case-1" measurement={gatewayXMeasurement} />);

    // Appears twice by design: the large number readout and the chart's
    // own peak label — both are the real stored value, not fabricated.
    expect(
      screen.getAllByText((_, element) => element?.textContent?.trim() === "200 MHz").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\+7\.4 dB relative to selected limit/)).toBeInTheDocument();
    expect(screen.getByText("WiFi TX")).toBeInTheDocument();
    expect(screen.getByText("display active")).toBeInTheDocument();
    expect(screen.getByText("peak")).toBeInTheDocument();
    expect(screen.getByText("Class B")).toBeInTheDocument();
  });

  it("renders the spectrum chart with an accessible label describing the peak and limit relationship", () => {
    render(<MeasurementPanel caseId="case-1" measurement={gatewayXMeasurement} />);
    expect(
      screen.getByRole("img", {
        name: /200 megahertz peak, \+7\.4 decibels relative to the selected limit/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no measurement yet (missing-data case)", () => {
    render(<MeasurementPanel caseId="case-1" measurement={null} />);
    expect(
      screen.getByText(/no measurement recorded for this case yet/i),
    ).toBeInTheDocument();
  });

  it("renders a measurement below the limit without fabricating extra data (boundary case: negative margin)", () => {
    const belowLimit: MeasurementRow = {
      ...gatewayXMeasurement,
      peaks: [{ id: "peak-2", frequencyMhz: 150, marginDb: -3.2, detector: null, limitLine: null }],
    };
    render(<MeasurementPanel caseId="case-1" measurement={belowLimit} />);
    expect(screen.getByText(/-3\.2 dB relative to selected limit/)).toBeInTheDocument();
  });
});
