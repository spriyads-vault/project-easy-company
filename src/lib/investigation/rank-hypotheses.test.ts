import { describe, expect, it } from "vitest";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { deriveHypothesisStrength, rankHypotheses } from "./rank-hypotheses";

function hypothesis(overrides: Partial<HypothesisCreatedPayload> = {}): HypothesisCreatedPayload {
  return {
    productFactId: "fact-1",
    title: "Test hypothesis",
    confidenceBand: "medium",
    recommendedNextStep: "Disconnect the display path and re-measure.",
    evidence: [],
    ...overrides,
  };
}

describe("deriveHypothesisStrength", () => {
  it("reads high confidence with no update as leading", () => {
    expect(deriveHypothesisStrength(hypothesis({ confidenceBand: "high" }))).toBe("leading");
  });

  it("reads medium confidence with no update as plausible", () => {
    expect(deriveHypothesisStrength(hypothesis({ confidenceBand: "medium" }))).toBe("plausible");
  });

  it("reads low confidence with no update as unresolved, not weakened — nothing weakened it", () => {
    expect(deriveHypothesisStrength(hypothesis({ confidenceBand: "low" }))).toBe("unresolved");
  });

  it("boundary: a high-confidence hypothesis explicitly weakened by new evidence still ranks weakened, overriding the raw confidence band", () => {
    expect(
      deriveHypothesisStrength(
        hypothesis({
          confidenceBand: "high",
          update: { status: "weakened_by_new_evidence", previousHypothesisTitle: "Earlier hypothesis" },
        }),
      ),
    ).toBe("weakened");
  });

  it("reads needs_more_evidence as unresolved regardless of confidence band", () => {
    expect(
      deriveHypothesisStrength(
        hypothesis({
          confidenceBand: "high",
          update: { status: "needs_more_evidence", previousHypothesisTitle: "Earlier hypothesis" },
        }),
      ),
    ).toBe("unresolved");
  });

  it("supported_by_new_evidence falls through to the confidence band, not a fabricated boost", () => {
    expect(
      deriveHypothesisStrength(
        hypothesis({
          confidenceBand: "medium",
          update: { status: "supported_by_new_evidence", previousHypothesisTitle: "Earlier hypothesis" },
        }),
      ),
    ).toBe("plausible");
  });
});

describe("rankHypotheses", () => {
  it("orders leading before plausible before weakened before unresolved", () => {
    const low = hypothesis({ title: "low", confidenceBand: "low" });
    const high = hypothesis({ title: "high", confidenceBand: "high" });
    const medium = hypothesis({ title: "medium", confidenceBand: "medium" });
    const weakened = hypothesis({
      title: "weakened",
      confidenceBand: "high",
      update: { status: "weakened_by_new_evidence", previousHypothesisTitle: "x" },
    });

    const ranked = rankHypotheses([low, high, medium, weakened]);
    expect(ranked.map((r) => r.strength)).toEqual(["leading", "plausible", "weakened", "unresolved"]);
    expect(ranked.map((r) => r.hypothesis.title)).toEqual(["high", "medium", "weakened", "low"]);
  });

  it("preserves original run order for two hypotheses of equal strength (stable sort)", () => {
    const first = hypothesis({ title: "first", confidenceBand: "high" });
    const second = hypothesis({ title: "second", confidenceBand: "high" });
    const ranked = rankHypotheses([first, second]);
    expect(ranked.map((r) => r.hypothesis.title)).toEqual(["first", "second"]);
  });

  it("carries the original (unranked) index through so numbering elsewhere in the UI stays stable", () => {
    const low = hypothesis({ title: "low", confidenceBand: "low" });
    const high = hypothesis({ title: "high", confidenceBand: "high" });
    const ranked = rankHypotheses([low, high]);
    expect(ranked.find((r) => r.hypothesis.title === "low")?.originalIndex).toBe(0);
    expect(ranked.find((r) => r.hypothesis.title === "high")?.originalIndex).toBe(1);
  });

  it("returns an empty list for no hypotheses — never throws", () => {
    expect(rankHypotheses([])).toEqual([]);
  });
});
