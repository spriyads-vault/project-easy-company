// Deterministic frequency/harmonic correlation utility (docs/ARCHITECTURE.md:
// "Deterministic utilities run separately from the LLM"). Pure TypeScript,
// no I/O, no model calls. Given a measured failure frequency and the
// product's known frequency-bearing facts (clocks, radios, switching power
// rails), it finds which facts could plausibly produce an emission at that
// frequency via an integer harmonic (N x source frequency ≈ measured
// frequency).
//
// IMPORTANT: a harmonic match is a candidate relationship, not a diagnosis.
// Many unrelated signals can coincidentally land near an integer multiple of
// a clock frequency, and a real root cause requires engineering
// investigation (see docs/MVP_SCOPE.md, CLAUDE.md "Product truth"). Nothing
// in this module's output may be read as "this is the cause" — every result
// is phrased as a candidate and callers (MVP-07's hypothesis service, the
// UI) must keep it labeled INFERRED, never promoted to KNOWN.
import type { ProductFactCategory, ProductFactInput } from "@/lib/domain/schema";

/** A product fact plus the id it was persisted under. */
export type ProductFactRecord = ProductFactInput & { id: string };

/** A single fact reduced to "this thing has a characteristic frequency." */
export interface FrequencySource {
  productFactId: string;
  category: ProductFactCategory;
  label: string;
  frequencyMhz: number;
}

export interface HarmonicCorrelationCandidate {
  /** Provenance: exactly which ProductFact produced this candidate. */
  productFactId: string;
  productFactCategory: ProductFactCategory;
  productFactLabel: string;
  sourceFrequencyMhz: number;
  /** The integer N such that sourceFrequencyMhz * N ≈ measuredFrequencyMhz. */
  harmonicNumber: number;
  expectedFrequencyMhz: number;
  measuredFrequencyMhz: number;
  deviationMhz: number;
  /** deviationMhz as a fraction of measuredFrequencyMhz, e.g. 0.001 = 0.1%. */
  deviationRatio: number;
  /**
   * Plain-language description of the candidate relationship. Deliberately
   * phrased as "consistent with", never "caused by" or "confirmed" — see
   * module doc comment.
   */
  description: string;
}

export interface CorrelationOptions {
  /**
   * Maximum deviation between the measured frequency and N x source
   * frequency, as a fraction of the measured frequency, still counted as a
   * match. Default 1% — generous enough for a nominal clock label (e.g.
   * "40 MHz") entered by an engineer rather than a trimmed/measured value,
   * tight enough not to match everything.
   */
  toleranceRatio?: number;
  /**
   * Highest harmonic number considered. Real emissions rarely register
   * meaningfully above this; keeping it bounded also keeps results finite
   * for very low source frequencies. Default 25.
   */
  maxHarmonicNumber?: number;
}

const DEFAULT_TOLERANCE_RATIO = 0.01;
const DEFAULT_MAX_HARMONIC_NUMBER = 25;

/**
 * Reduce a workspace's product facts to the subset that carry a
 * characteristic frequency worth correlating against (clocks always do;
 * radios and power rails only if one was entered).
 */
export function extractFrequencySources(
  facts: readonly ProductFactRecord[],
): FrequencySource[] {
  const sources: FrequencySource[] = [];

  for (const record of facts) {
    switch (record.category) {
      case "clock":
        sources.push({
          productFactId: record.id,
          category: "clock",
          label: record.fact.label,
          frequencyMhz: record.fact.frequencyMhz,
        });
        break;
      case "radio":
        if (record.fact.frequencyMhz !== undefined) {
          sources.push({
            productFactId: record.id,
            category: "radio",
            label: record.fact.label,
            frequencyMhz: record.fact.frequencyMhz,
          });
        }
        break;
      case "power":
        if (record.fact.switchingFrequencyMhz !== undefined) {
          sources.push({
            productFactId: record.id,
            category: "power",
            label: record.fact.label,
            frequencyMhz: record.fact.switchingFrequencyMhz,
          });
        }
        break;
      // cable and other facts carry no characteristic frequency.
      case "cable":
      case "other":
        break;
    }
  }

  return sources;
}

/**
 * Find candidate harmonic relationships between a measured frequency and a
 * set of frequency-bearing facts. For each source, at most one candidate is
 * returned — the harmonic number whose expected frequency is closest to the
 * measurement — so a tight tolerance never produces two near-duplicate
 * entries for the same fact.
 */
export function findHarmonicCorrelations(
  measuredFrequencyMhz: number,
  sources: readonly FrequencySource[],
  options: CorrelationOptions = {},
): HarmonicCorrelationCandidate[] {
  if (!Number.isFinite(measuredFrequencyMhz) || measuredFrequencyMhz <= 0) {
    throw new RangeError(
      `measuredFrequencyMhz must be a positive, finite number (got ${measuredFrequencyMhz}).`,
    );
  }

  const toleranceRatio = options.toleranceRatio ?? DEFAULT_TOLERANCE_RATIO;
  const maxHarmonicNumber =
    options.maxHarmonicNumber ?? DEFAULT_MAX_HARMONIC_NUMBER;

  const candidates: HarmonicCorrelationCandidate[] = [];

  for (const source of sources) {
    if (!Number.isFinite(source.frequencyMhz) || source.frequencyMhz <= 0) {
      // Malformed source (shouldn't happen given Zod validation upstream,
      // but this is a pure function — don't trust callers silently).
      continue;
    }

    const ratio = measuredFrequencyMhz / source.frequencyMhz;
    const harmonicNumber = Math.max(1, Math.round(ratio));
    if (harmonicNumber < 1 || harmonicNumber > maxHarmonicNumber) {
      continue;
    }

    const expectedFrequencyMhz = source.frequencyMhz * harmonicNumber;
    const deviationMhz = Math.abs(measuredFrequencyMhz - expectedFrequencyMhz);
    const deviationRatio = deviationMhz / measuredFrequencyMhz;

    if (deviationRatio > toleranceRatio) {
      continue;
    }

    const ordinal =
      harmonicNumber === 1 ? "fundamental" : `${harmonicNumber}th harmonic`;

    candidates.push({
      productFactId: source.productFactId,
      productFactCategory: source.category,
      productFactLabel: source.label,
      sourceFrequencyMhz: source.frequencyMhz,
      harmonicNumber,
      expectedFrequencyMhz,
      measuredFrequencyMhz,
      deviationMhz,
      deviationRatio,
      description:
        `${measuredFrequencyMhz} MHz is consistent with the ${ordinal} of ` +
        `"${source.label}" (${source.frequencyMhz} MHz x ${harmonicNumber} = ` +
        `${expectedFrequencyMhz.toFixed(3)} MHz).`,
    });
  }

  // Lower harmonic numbers are physically more common in practice and a
  // closer match is a stronger candidate; neither is a probability, just a
  // reasonable default ordering for the UI/hypothesis service to start from.
  return candidates.sort((a, b) => {
    if (a.harmonicNumber !== b.harmonicNumber) {
      return a.harmonicNumber - b.harmonicNumber;
    }
    return a.deviationRatio - b.deviationRatio;
  });
}

/**
 * Convenience wrapper: extract frequency sources from raw product facts and
 * correlate them against a measured frequency in one call.
 */
export function correlateMeasurementWithProductFacts(
  measuredFrequencyMhz: number,
  productFacts: readonly ProductFactRecord[],
  options?: CorrelationOptions,
): HarmonicCorrelationCandidate[] {
  const sources = extractFrequencySources(productFacts);
  return findHarmonicCorrelations(measuredFrequencyMhz, sources, options);
}
