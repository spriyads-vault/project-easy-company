import { describe, expect, it } from "vitest";
import { parseInvestigationIntake, type ProductCandidate } from "./parse-investigation-intake";

const products: ProductCandidate[] = [
  { id: "product-1", name: "Gateway X" },
  { id: "product-2", name: "Gateway X Pro" },
];

describe("parseInvestigationIntake", () => {
  it("extracts every field from the ticket's own example sentence (positive case)", () => {
    const result = parseInvestigationIntake(
      "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above limit. WiFi TX and display were active.",
      products,
    );
    expect(result.productMatch).toEqual({ id: "product-1", name: "Gateway X" });
    expect(result.productNameGuess).toBeNull();
    expect(result.revisionLabel).toBe("Rev17");
    expect(result.frequencyMhz).toBe(200);
    expect(result.marginDb).toBe(7.4);
    expect(result.operatingMode).toBe("WiFi TX and display were active");
  });

  it("reads a below-limit margin as negative", () => {
    const result = parseInvestigationIntake(
      "Retested Rev18. 200 MHz is now 3.6 dB below the limit.",
      products,
    );
    expect(result.revisionLabel).toBe("Rev18");
    expect(result.frequencyMhz).toBe(200);
    expect(result.marginDb).toBe(-3.6);
  });

  it("reads an explicit signed dB figure without 'limit' phrasing", () => {
    const result = parseInvestigationIntake("Peak is now -9 dB relative to spec.", products);
    expect(result.marginDb).toBe(-9);
  });

  it("matches the longer of two overlapping real product names", () => {
    const result = parseInvestigationIntake("Gateway X Pro Rev1 failed at 100 MHz.", products);
    expect(result.productMatch).toEqual({ id: "product-2", name: "Gateway X Pro" });
  });

  it("falls back to a guessed product name when no real product matches (negative case)", () => {
    const result = parseInvestigationIntake("Falcon Y Rev3 failed at 150 MHz, 2 dB above limit.", products);
    expect(result.productMatch).toBeNull();
    expect(result.productNameGuess).toBe("Falcon Y");
  });

  it("never fabricates a product match when the text names nothing real", () => {
    const result = parseInvestigationIntake("Something broke.", products);
    expect(result.productMatch).toBeNull();
  });

  it("leaves every field null for text with no extractable structure (missing-data case)", () => {
    const result = parseInvestigationIntake("Not sure what happened yet.", []);
    expect(result.productMatch).toBeNull();
    expect(result.productNameGuess).toBeNull();
    expect(result.revisionLabel).toBeNull();
    expect(result.frequencyMhz).toBeNull();
    expect(result.marginDb).toBeNull();
    expect(result.operatingMode).toBeNull();
  });

  it("does not extract an operating mode when no activity/state word is present (boundary case)", () => {
    const result = parseInvestigationIntake("Gateway X Rev17 failed at 200 MHz, 7.4 dB above limit.", products);
    expect(result.operatingMode).toBeNull();
  });

  it("accepts a hyphenated revision token", () => {
    const result = parseInvestigationIntake("Gateway X Rev-22 failed at 300 MHz.", products);
    expect(result.revisionLabel).toBe("Rev22");
  });
});

describe("parseInvestigationIntake — operating mode (FIX-02 Defect 1)", () => {
  it("isolates the mode clause from a single-sentence input, not the whole raw text (the ticket's own defect example)", () => {
    const result = parseInvestigationIntake(
      "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above the limit, with Wi-Fi TX and the display active",
      products,
    );
    expect(result.operatingMode).toBe("Wi-Fi TX and display active");
  });

  it("leaves operatingMode empty, not a fallback string, when no mode clause can be isolated", () => {
    const result = parseInvestigationIntake(
      "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above the limit",
      products,
    );
    expect(result.operatingMode).toBeNull();
  });
});

describe("parseInvestigationIntake — product fact extraction (FIX-02 Defect 2)", () => {
  it('extracts one clock fact from "40 MHz system clock"', () => {
    const result = parseInvestigationIntake("40 MHz system clock", []);
    expect(result.productFacts).toEqual([
      { category: "clock", label: "System clock", frequencyMhz: 40 },
    ]);
  });

  it("extracts zero facts from a sentence with no frequency source", () => {
    const result = parseInvestigationIntake("Something broke and we're not sure why.", []);
    expect(result.productFacts).toEqual([]);
  });

  it("does not mistake the measurement's own failing frequency for a product fact", () => {
    const result = parseInvestigationIntake(
      "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above the limit, with Wi-Fi TX and the display active",
      products,
    );
    expect(result.productFacts).toEqual([]);
  });

  it("extracts a radio fact from a GHz figure next to a recognized radio word", () => {
    const result = parseInvestigationIntake("Board has a 2.4 GHz WiFi radio.", []);
    expect(result.productFacts).toEqual([
      { category: "radio", label: "WiFi radio", frequencyMhz: 2400 },
    ]);
  });

  it("extracts a power fact from a switching-rail figure", () => {
    const result = parseInvestigationIntake("There is a 500 kHz switching rail near the connector.", []);
    expect(result.productFacts).toEqual([
      { category: "power", label: "Switching rail", frequencyMhz: 0.5 },
    ]);
  });

  it("extracts more than one fact from the same sentence, in order", () => {
    const result = parseInvestigationIntake("40 MHz system clock and 2.4 GHz WiFi radio.", []);
    expect(result.productFacts).toEqual([
      { category: "clock", label: "System clock", frequencyMhz: 40 },
      { category: "radio", label: "WiFi radio", frequencyMhz: 2400 },
    ]);
  });
});
