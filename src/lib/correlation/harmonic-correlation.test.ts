import { describe, expect, it } from "vitest";
import {
  correlateMeasurementWithProductFacts,
  extractFrequencySources,
  findHarmonicCorrelations,
  type ProductFactRecord,
} from "./harmonic-correlation";

const gatewayXFacts: ProductFactRecord[] = [
  {
    id: "fact-clock-40mhz",
    category: "clock",
    fact: { label: "system clock", frequencyMhz: 40 },
    source: "user_entered",
  },
  {
    id: "fact-radio-wifi",
    category: "radio",
    fact: { label: "WiFi module", technology: "WiFi 2.4GHz", frequencyMhz: 2400 },
    source: "user_entered",
  },
  {
    id: "fact-cable-display",
    category: "cable",
    fact: { label: "display ribbon cable", shielded: true },
    source: "user_entered",
  },
  {
    id: "fact-power-5v",
    category: "power",
    fact: { label: "5V rail", topology: "switching regulator" },
    source: "user_entered",
  },
];

describe("extractFrequencySources", () => {
  it("includes clock facts (always have a frequency)", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    expect(sources).toContainEqual({
      productFactId: "fact-clock-40mhz",
      category: "clock",
      label: "system clock",
      frequencyMhz: 40,
    });
  });

  it("excludes cable and power facts with no frequency entered (missing data)", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    const ids = sources.map((s) => s.productFactId);
    expect(ids).not.toContain("fact-cable-display");
    expect(ids).not.toContain("fact-power-5v");
  });

  it("returns an empty list for an empty fact set", () => {
    expect(extractFrequencySources([])).toEqual([]);
  });
});

describe("findHarmonicCorrelations", () => {
  it("detects the Gateway X case: 40 MHz x 5 = 200 MHz (positive case)", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    const candidates = findHarmonicCorrelations(200, sources);

    const clockCandidate = candidates.find(
      (c) => c.productFactId === "fact-clock-40mhz",
    );
    expect(clockCandidate).toBeDefined();
    expect(clockCandidate?.harmonicNumber).toBe(5);
    expect(clockCandidate?.sourceFrequencyMhz).toBe(40);
    expect(clockCandidate?.expectedFrequencyMhz).toBeCloseTo(200);
  });

  it("carries provenance back to the exact ProductFact", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    const [candidate] = findHarmonicCorrelations(200, sources);
    expect(candidate.productFactId).toBe("fact-clock-40mhz");
    expect(candidate.productFactCategory).toBe("clock");
    expect(candidate.productFactLabel).toBe("system clock");
  });

  it("never claims certainty or root cause in its description", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    const [candidate] = findHarmonicCorrelations(200, sources);
    const description = candidate.description.toLowerCase();
    expect(description).toContain("consistent with");
    expect(description).not.toMatch(/root cause|caused by|confirmed|proves/);
  });

  it("finds no candidate when nothing lines up (negative case)", () => {
    const sources = extractFrequencySources(gatewayXFacts);
    // 137 MHz doesn't land near any integer multiple of 40 MHz or 2400 MHz
    // within the default tolerance.
    const candidates = findHarmonicCorrelations(137, sources);
    expect(candidates).toEqual([]);
  });

  it("returns no candidates when there are no frequency sources (missing-data case)", () => {
    const candidates = findHarmonicCorrelations(200, []);
    expect(candidates).toEqual([]);
  });

  it("matches the fundamental (harmonic number 1) when frequencies are equal (boundary)", () => {
    const candidates = findHarmonicCorrelations(2400, [
      {
        productFactId: "fact-radio-wifi",
        category: "radio",
        label: "WiFi module",
        frequencyMhz: 2400,
      },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].harmonicNumber).toBe(1);
  });

  it("rejects a match just outside the tolerance window (boundary)", () => {
    // 40 MHz x 5 = 200 MHz exactly; 210 MHz is 5% off — outside the 1% default.
    const candidates = findHarmonicCorrelations(210, [
      { productFactId: "clock", category: "clock", label: "clock", frequencyMhz: 40 },
    ]);
    expect(candidates).toEqual([]);
  });

  it("accepts a match just inside a widened tolerance window (boundary)", () => {
    const candidates = findHarmonicCorrelations(
      201, // 0.5% off 200 MHz
      [{ productFactId: "clock", category: "clock", label: "clock", frequencyMhz: 40 }],
      { toleranceRatio: 0.01 },
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].harmonicNumber).toBe(5);
  });

  it("does not return a harmonic number above maxHarmonicNumber (boundary)", () => {
    // 1 MHz x 200 = 200 MHz, but the default cap is 25.
    const candidates = findHarmonicCorrelations(200, [
      { productFactId: "slow-clock", category: "clock", label: "slow clock", frequencyMhz: 1 },
    ]);
    expect(candidates).toEqual([]);
  });

  it("returns one candidate per source, not one per matching harmonic", () => {
    const candidates = findHarmonicCorrelations(200, [
      { productFactId: "clock", category: "clock", label: "clock", frequencyMhz: 40 },
    ]);
    expect(candidates).toHaveLength(1);
  });

  it("rejects a non-positive measured frequency (boundary/invalid input)", () => {
    expect(() => findHarmonicCorrelations(0, [])).toThrow(RangeError);
    expect(() => findHarmonicCorrelations(-200, [])).toThrow(RangeError);
  });

  it("ignores a malformed source frequency rather than throwing", () => {
    const candidates = findHarmonicCorrelations(200, [
      { productFactId: "bad", category: "clock", label: "bad", frequencyMhz: 0 },
    ]);
    expect(candidates).toEqual([]);
  });

  it("sorts by harmonic number then by closeness of match", () => {
    const candidates = findHarmonicCorrelations(200, [
      { productFactId: "a", category: "clock", label: "40 MHz (5th)", frequencyMhz: 40 },
      { productFactId: "b", category: "clock", label: "20 MHz (10th)", frequencyMhz: 20 },
      { productFactId: "c", category: "clock", label: "100 MHz (2nd)", frequencyMhz: 100 },
    ]);
    expect(candidates.map((c) => c.harmonicNumber)).toEqual([2, 5, 10]);
  });
});

describe("correlateMeasurementWithProductFacts", () => {
  it("extracts and correlates in one call for the Gateway X seed case", () => {
    const candidates = correlateMeasurementWithProductFacts(200, gatewayXFacts);
    expect(candidates.some((c) => c.productFactId === "fact-clock-40mhz")).toBe(
      true,
    );
  });
});
