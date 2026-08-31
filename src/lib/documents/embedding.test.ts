import { describe, expect, it } from "vitest";
import {
  computeHashedEmbedding,
  cosineSimilarity,
  toVectorLiteral,
  EMBEDDING_DIMENSIONS,
} from "./embedding";

describe("computeHashedEmbedding", () => {
  it("is deterministic — the same text always produces the same vector", () => {
    const a = computeHashedEmbedding("40 MHz system clock");
    const b = computeHashedEmbedding("40 MHz system clock");
    expect(a).toEqual(b);
  });

  it("produces a vector of the requested dimension, L2-normalized", () => {
    const vector = computeHashedEmbedding("radiated emissions test report");
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("returns a zero vector for empty/whitespace-only text (boundary case)", () => {
    const vector = computeHashedEmbedding("   ");
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it("supports a custom dimension count", () => {
    expect(computeHashedEmbedding("hello world", 64)).toHaveLength(64);
  });

  it("scores lexically-overlapping text as more similar than unrelated text (semantic-ish positive/negative case)", () => {
    const clockDoc = computeHashedEmbedding(
      "The 40 MHz system clock drives the display controller and may radiate harmonics.",
    );
    const relatedQuery = computeHashedEmbedding("40 MHz clock harmonic radiation");
    const unrelatedQuery = computeHashedEmbedding(
      "shielded cable connector mechanical enclosure gasket",
    );

    const relatedScore = cosineSimilarity(clockDoc, relatedQuery);
    const unrelatedScore = cosineSimilarity(clockDoc, unrelatedQuery);
    expect(relatedScore).toBeGreaterThan(unrelatedScore);
  });
});

describe("toVectorLiteral", () => {
  it("formats a vector as pgvector's bracketed literal", () => {
    expect(toVectorLiteral([1, 2.5, -3])).toBe("[1,2.5,-3]");
  });

  it("round-trips a real computed embedding into a parseable literal", () => {
    const vector = computeHashedEmbedding("test");
    const literal = toVectorLiteral(vector);
    expect(literal.startsWith("[")).toBe(true);
    expect(literal.endsWith("]")).toBe(true);
    expect(literal.split(",")).toHaveLength(EMBEDDING_DIMENSIONS);
  });
});
