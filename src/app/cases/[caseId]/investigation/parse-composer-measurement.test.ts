import { describe, expect, it } from "vitest";
import { parseComposerMeasurement } from "./parse-composer-measurement";

describe("parseComposerMeasurement", () => {
  it("extracts frequency and an above/below-the-limit margin (positive case, the ticket's worked example)", () => {
    expect(parseComposerMeasurement("Retested Rev18. 200 MHz is now 3.6 dB below the limit.")).toEqual({
      frequencyMhz: 200,
      marginDb: -3.6,
      operatingMode: null,
    });
  });

  it("extracts an above-the-limit margin as a positive number (positive case)", () => {
    expect(parseComposerMeasurement("200 MHz, 7.4 dB above the limit.")).toEqual({
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: null,
    });
  });

  it("extracts operating mode when a recognized activity word is present (positive case)", () => {
    const result = parseComposerMeasurement(
      "Retested. 200 MHz is 1.2 dB below the limit. WiFi TX and display were active.",
    );
    expect(result.frequencyMhz).toBe(200);
    expect(result.marginDb).toBe(-1.2);
    expect(result.operatingMode).toBe("WiFi TX and display were active");
  });

  it("falls back to a bare signed dB figure when no above/below-the-limit phrase is present (positive case)", () => {
    expect(parseComposerMeasurement("200 MHz, -3.6 dB.")).toEqual({
      frequencyMhz: 200,
      marginDb: -3.6,
      operatingMode: null,
    });
  });

  it("leaves every field null for text with no recognizable measurement shape (missing-data case)", () => {
    expect(parseComposerMeasurement("Not sure what happened.")).toEqual({
      frequencyMhz: null,
      marginDb: null,
      operatingMode: null,
    });
  });

  it("extracts frequency alone when no margin figure is present (boundary case)", () => {
    expect(parseComposerMeasurement("Peak now at 200 MHz.")).toEqual({
      frequencyMhz: 200,
      marginDb: null,
      operatingMode: null,
    });
  });
});
