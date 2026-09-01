// Deterministic before/after comparison (MVP-11). Pure TypeScript, zero I/O,
// no model call — the exact "Do not let the LLM calculate it" requirement.
// marginDb is dB relative to the regulatory limit (positive = over/fail,
// negative = under/pass — see MVP-03's decision, unchanged here), so an
// improvement is `before.marginDb - after.marginDb`: a positive delta means
// the margin dropped (moved toward/under the limit), a negative delta means
// it got worse.
export interface ComparedMeasurement {
  revisionLabel: string;
  frequencyMhz: number;
  marginDb: number;
}

export interface MeasurementComparison {
  before: ComparedMeasurement;
  after: ComparedMeasurement;
  /** Positive = improvement, negative = regression, 0 = no change.
   * Rounded to one decimal place — matches the precision measurements are
   * actually entered at (see measurementPeakInputSchema). */
  deltaDb: number;
  improved: boolean;
  /** True only when before/after measured the same nominal frequency —
   * comparing across different frequencies would be a different claim than
   * "the same failure improved by N dB", so callers should not label this
   * a before/after result when false. */
  sameFrequency: boolean;
}

export function compareMeasurements(
  before: ComparedMeasurement,
  after: ComparedMeasurement,
): MeasurementComparison {
  const rawDelta = before.marginDb - after.marginDb;
  // Avoid float noise like 10.999999999999998 from repeated subtraction.
  const deltaDb = Math.round(rawDelta * 10) / 10;
  return {
    before,
    after,
    deltaDb,
    improved: deltaDb > 0,
    sameFrequency: before.frequencyMhz === after.frequencyMhz,
  };
}
