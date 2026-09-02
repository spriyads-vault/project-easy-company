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
