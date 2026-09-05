import { describe, expect, it, vi } from "vitest";
import type { HarmonicCorrelationCandidate } from "@/lib/correlation/harmonic-correlation";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import type { HypothesisGenerationOutput } from "./schema";
import {
  buildKnownEvidence,
  buildObservedEvidence,
  containsProhibitedCertaintyLanguage,
  dedupeEvidence,
  generateHypothesesForMeasurement,
  type GenerateHypothesesInput,
} from "./generate-hypotheses";

const gatewayXCandidate: HarmonicCorrelationCandidate = {
  productFactId: "fact-clock-40mhz",
  productFactCategory: "clock",
  productFactLabel: "system clock",
  sourceFrequencyMhz: 40,
  harmonicNumber: 5,
  expectedFrequencyMhz: 200,
  measuredFrequencyMhz: 200,
  deviationMhz: 0,
  deviationRatio: 0,
  description: "200 MHz is consistent with the 5th harmonic of \"system clock\" (40 MHz x 5 = 200.000 MHz).",
};

function baseInput(
  overrides: Partial<GenerateHypothesesInput> = {},
): GenerateHypothesesInput {
  return {
    measurement: {
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: "WiFi TX + display active",
    },
    correlationCandidates: [gatewayXCandidate],
    productFacts: [
      {
        id: "fact-clock-40mhz",
        category: "clock",
        label: "system clock",
        summary: "40 MHz system clock",
      },
    ],
    ...overrides,
  };
}

function fakeAdapter(response: HypothesisGenerationOutput): HypothesisModelAdapter {
  return { generateHypotheses: vi.fn().mockResolvedValue(response) };
}

describe("containsProhibitedCertaintyLanguage", () => {
  it("flags definitive-certainty phrasing", () => {
    expect(containsProhibitedCertaintyLanguage("This is the root cause.")).toBe(
      true,
    );
    expect(
      containsProhibitedCertaintyLanguage("The clock is confirmed as the source."),
    ).toBe(true);
    expect(containsProhibitedCertaintyLanguage("This is definitely it.")).toBe(
      true,
    );
  });

  it("does not flag properly hedged language (negative case)", () => {
    expect(
      containsProhibitedCertaintyLanguage(
        "This is consistent with a candidate source worth investigating.",
      ),
    ).toBe(false);
  });

  it("does not flag confirm/verify used as a hedged verification action or negated claim (regression: found via live-testing rejecting well-hedged model output)", () => {
    expect(
      containsProhibitedCertaintyLanguage(
        "This is a frequency coincidence and coupling hypothesis, not a confirmed cause.",
      ),
    ).toBe(false);
    expect(
      containsProhibitedCertaintyLanguage(
        "Replicate the WiFi TX + display active mode to confirm signal presence at 200 MHz.",
      ),
    ).toBe(false);
    expect(
      containsProhibitedCertaintyLanguage(
        "An engineer should verify the trace layout before ruling this out.",
      ),
    ).toBe(false);
  });
});

describe("buildObservedEvidence / buildKnownEvidence", () => {
  it("labels a failing margin as over the limit", () => {
    const evidence = buildObservedEvidence({
      frequencyMhz: 200,
      marginDb: 7.4,
      operatingMode: "WiFi TX + display active",
    });
    expect(evidence.category).toBe("observed");
    expect(evidence.description).toContain("over the applicable limit");
  });

  it("labels a passing margin as under the limit (boundary sign flip)", () => {
    const evidence = buildObservedEvidence({
      frequencyMhz: 200,
      marginDb: -3.6,
      operatingMode: null,
    });
    expect(evidence.description).toContain("under the applicable limit");
  });

  it("tags product context as known, never observed", () => {
    const evidence = buildKnownEvidence({
      id: "fact-1",
      category: "clock",
      label: "system clock",
      summary: "40 MHz system clock",
    });
    expect(evidence.category).toBe("known");
  });
});

describe("dedupeEvidence (UX-07 correction: duplicate KNOWN evidence lines)", () => {
  it("collapses two identical evidence items into one", () => {
    const known = buildKnownEvidence({
      id: "fact-1",
      category: "clock",
      label: "system clock",
      summary: "40 MHz system clock",
    });
    const deduped = dedupeEvidence([known, known]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toEqual(known);
  });

  it("keeps items with the same category but different text (not a false-positive collapse)", () => {
    const deduped = dedupeEvidence([
      { category: "known", description: "Product context: 40 MHz system clock" },
      { category: "known", description: "Product context: display flex cable" },
    ]);
    expect(deduped).toHaveLength(2);
  });

  it("preserves original order", () => {
    const a = { category: "observed", description: "Measured 200 MHz." } as const;
    const b = { category: "known", description: "Product context: 40 MHz system clock" } as const;
    const deduped = dedupeEvidence([a, b, a]);
    expect(deduped).toEqual([a, b]);
  });
});

describe("generateHypothesesForMeasurement", () => {
  it("assembles a hypothesis with OBSERVED, KNOWN, INFERRED and MISSING evidence (positive case)", async () => {
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "40 MHz clock 5th harmonic",
          confidenceBand: "medium",
          reasoning:
            "The measured frequency lines up with a 5th-order harmonic of the system clock.",
          missingEvidence: ["Check emissions with the clock disabled."],
          recommendedNextStep:
            "An engineer could re-clock or shield the oscillator and re-measure.",
        },
      ],
      clarificationQuestion: null,
    });

    const result = await generateHypothesesForMeasurement(baseInput(), adapter);

    expect(result.rejectedCount).toBe(0);
    expect(result.hypotheses).toHaveLength(1);
    const categories = result.hypotheses[0].evidence.map((e) => e.category);
    expect(categories).toEqual(["observed", "known", "inferred", "missing"]);
  });

  it("rejects a hypothesis referencing a productFactId it wasn't given (hallucination guard)", async () => {
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: "fact-does-not-exist",
          title: "Fabricated hypothesis",
          confidenceBand: "low",
          reasoning: "Made up.",
          missingEvidence: [],
          recommendedNextStep: "N/A",
        },
      ],
      clarificationQuestion: null,
    });

    const result = await generateHypothesesForMeasurement(baseInput(), adapter);

    expect(result.hypotheses).toEqual([]);
    expect(result.rejectedCount).toBe(1);
  });

  it("rejects a hypothesis that claims certainty (unsupported certainty prevented)", async () => {
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "Confirmed root cause",
          confidenceBand: "high",
          reasoning: "This is definitely the root cause of the failure.",
          missingEvidence: [],
          recommendedNextStep: "Ship it.",
        },
      ],
      clarificationQuestion: null,
    });

    const result = await generateHypothesesForMeasurement(baseInput(), adapter);

    expect(result.hypotheses).toEqual([]);
    expect(result.rejectedCount).toBe(1);
  });

  it("nulls out a clarification question that overclaims certainty", async () => {
    const adapter = fakeAdapter({
      hypotheses: [],
      clarificationQuestion: "Is the 40 MHz clock confirmed as the root cause?",
    });

    const result = await generateHypothesesForMeasurement(baseInput(), adapter);

    expect(result.clarificationQuestion).toBeNull();
  });

  it("passes through a well-hedged clarification question", async () => {
    const adapter = fakeAdapter({
      hypotheses: [],
      clarificationQuestion: "Was the WiFi radio active during this scan?",
    });

    const result = await generateHypothesesForMeasurement(baseInput(), adapter);

    expect(result.clarificationQuestion).toBe(
      "Was the WiFi radio active during this scan?",
    );
  });

  it("does not call the model when there are no correlation candidates (missing-data case)", async () => {
    const adapter = fakeAdapter({ hypotheses: [], clarificationQuestion: null });

    const result = await generateHypothesesForMeasurement(
      baseInput({ correlationCandidates: [] }),
      adapter,
    );

    expect(result).toEqual({
      hypotheses: [],
      clarificationQuestion: null,
      rejectedCount: 0,
    });
    expect(adapter.generateHypotheses).not.toHaveBeenCalled();
  });

  it("still assembles a hypothesis when no matching product fact is loaded (boundary)", async () => {
    const adapter = fakeAdapter({
      hypotheses: [
        {
          productFactId: "fact-clock-40mhz",
          title: "40 MHz clock 5th harmonic",
          confidenceBand: "low",
          reasoning: "Frequency arithmetic lines up.",
          missingEvidence: [],
          recommendedNextStep: "Investigate further.",
        },
      ],
      clarificationQuestion: null,
    });

    const result = await generateHypothesesForMeasurement(
      baseInput({ productFacts: [] }),
      adapter,
    );

    expect(result.hypotheses).toHaveLength(1);
    const categories = result.hypotheses[0].evidence.map((e) => e.category);
    // No "known" entry since the fact lookup found nothing — observed and
    // inferred are still present.
    expect(categories).toEqual(["observed", "inferred"]);
  });
});
