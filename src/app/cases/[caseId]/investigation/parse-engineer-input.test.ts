import { describe, expect, it } from "vitest";
import { parseEngineerInput } from "./parse-engineer-input";

describe("parseEngineerInput", () => {
  it("reads a 'dropped N dB' phrase as a negative measurement change (expected positive case)", () => {
    const result = parseEngineerInput(
      "I disconnected the display cable and the peak dropped 9 dB.",
    );
    expect(result.observation).toBe(
      "I disconnected the display cable and the peak dropped 9 dB.",
    );
    expect(result.measurementChange).toBe("-9 dB");
  });

  it("reads an 'increased by N dB' phrase as a positive measurement change", () => {
    const result = parseEngineerInput("After the change, the peak increased by 3 dB.");
    expect(result.measurementChange).toBe("+3 dB");
  });

  it("reads an explicit signed figure directly, regardless of wording", () => {
    const result = parseEngineerInput("Margin moved to -9dB after the fix.");
    expect(result.measurementChange).toBe("-9 dB");
  });

  it("leaves measurementChange null for plain text with no numbers (expected negative case)", () => {
    const result = parseEngineerInput("Re-ran the test with the enclosure lid on.");
    expect(result.measurementChange).toBeNull();
    expect(result.observation).toBe("Re-ran the test with the enclosure lid on.");
  });

  it("leaves measurementChange null for a bare dB figure with no direction word (missing-data case)", () => {
    const result = parseEngineerInput("Measured 9 dB on the bench today.");
    expect(result.measurementChange).toBeNull();
  });

  it("never rewrites the observation text itself — it is always the engineer's own words, trimmed (boundary case)", () => {
    const result = parseEngineerInput("   Display path disconnected, peak dropped 9 dB.   ");
    expect(result.observation).toBe("Display path disconnected, peak dropped 9 dB.");
  });
});
