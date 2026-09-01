import { describe, expect, it } from "vitest";
import { compareMeasurements } from "./compare-measurements";

describe("compareMeasurements", () => {
  it("computes the Gateway X 11 dB improvement (positive case)", () => {
    const result = compareMeasurements(
      { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
      { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -3.6 },
    );
    expect(result.deltaDb).toBe(11);
    expect(result.improved).toBe(true);
    expect(result.sameFrequency).toBe(true);
  });

  it("reports a regression when the margin got worse (negative case)", () => {
    const result = compareMeasurements(
      { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: -3.6 },
      { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 7.4 },
    );
    expect(result.deltaDb).toBe(-11);
    expect(result.improved).toBe(false);
  });

  it("reports no change when the margin is identical (boundary case)", () => {
    const result = compareMeasurements(
      { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
      { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 7.4 },
    );
    expect(result.deltaDb).toBe(0);
    expect(result.improved).toBe(false);
  });

  it("flags a comparison across different frequencies rather than silently treating it as the same failure (missing-data-shaped case)", () => {
    const result = compareMeasurements(
      { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
      { revisionLabel: "Rev18", frequencyMhz: 137, marginDb: -3.6 },
    );
    expect(result.sameFrequency).toBe(false);
  });

  it("rounds to one decimal place, avoiding float noise from repeated subtraction", () => {
    const result = compareMeasurements(
      { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 0.3 },
      { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: -0.1 },
    );
    expect(result.deltaDb).toBe(0.4);
  });
});
