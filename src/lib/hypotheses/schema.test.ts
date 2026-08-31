import { describe, expect, it } from "vitest";
import {
  hypothesisGenerationOutputSchema,
  modelHypothesisSchema,
} from "./schema";

const validModelHypothesis = {
  productFactId: "fact-clock-40mhz",
  title: "40 MHz clock 5th harmonic",
  confidenceBand: "medium",
  reasoning:
    "The measured frequency lines up with a 5th-order harmonic of the system clock.",
  missingEvidence: ["Check emissions with the clock disabled or re-clocked."],
  recommendedNextStep:
    "An engineer could disable or re-route the system clock and re-measure.",
};

describe("modelHypothesisSchema", () => {
  it("accepts a valid hypothesis (positive case)", () => {
    expect(modelHypothesisSchema.safeParse(validModelHypothesis).success).toBe(
      true,
    );
  });

  it("rejects an invalid confidenceBand", () => {
    const result = modelHypothesisSchema.safeParse({
      ...validModelHypothesis,
      confidenceBand: "certain",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing productFactId", () => {
    const { productFactId: _omit, ...withoutId } = validModelHypothesis;
    expect(modelHypothesisSchema.safeParse(withoutId).success).toBe(false);
  });

  it("has no field a model could use to claim OBSERVED or KNOWN evidence", () => {
    // The schema simply doesn't declare an evidence/category field at all —
    // this test documents that invariant so a future edit can't
    // accidentally reintroduce one without this test catching it.
    expect(Object.keys(modelHypothesisSchema.shape)).toEqual([
      "productFactId",
      "title",
      "confidenceBand",
      "reasoning",
      "missingEvidence",
      "recommendedNextStep",
    ]);
  });

  it("strips an unrecognized field (e.g. a smuggled category) rather than trusting it", () => {
    const parsed = modelHypothesisSchema.parse({
      ...validModelHypothesis,
      category: "known", // not a real field; must not survive parsing
    });
    expect(parsed).not.toHaveProperty("category");
  });
});

describe("hypothesisGenerationOutputSchema", () => {
  it("accepts a valid output with a null clarificationQuestion (boundary)", () => {
    const result = hypothesisGenerationOutputSchema.safeParse({
      hypotheses: [validModelHypothesis],
      clarificationQuestion: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a non-null clarificationQuestion", () => {
    const result = hypothesisGenerationOutputSchema.safeParse({
      hypotheses: [validModelHypothesis],
      clarificationQuestion: "Was the WiFi radio active during the scan?",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string clarificationQuestion (boundary — must be null, not empty)", () => {
    const result = hypothesisGenerationOutputSchema.safeParse({
      hypotheses: [],
      clarificationQuestion: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty hypotheses array (missing-data case)", () => {
    const result = hypothesisGenerationOutputSchema.safeParse({
      hypotheses: [],
      clarificationQuestion: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 5 hypotheses (boundary)", () => {
    const result = hypothesisGenerationOutputSchema.safeParse({
      hypotheses: Array.from({ length: 6 }, (_, i) => ({
        ...validModelHypothesis,
        productFactId: `fact-${i}`,
      })),
      clarificationQuestion: null,
    });
    expect(result.success).toBe(false);
  });
});
