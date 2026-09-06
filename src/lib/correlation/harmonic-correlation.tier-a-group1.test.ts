// Tier A group 1 — arithmetic verification of the deterministic harmonic
// correlation engine. Source: crado-tier-a-cases.json, cases TA-09 through
// TA-14 and TA-20. Every case here is asserted directly against
// correlateMeasurementWithProductFacts — no UI, no model call, no database,
// matching the fixture's own stated purpose ("tests computation, not
// engineering insight").
//
// TA-13 and TA-14 are the fixture's own documented engine limitations
// (harmonic number exceeds the hardcoded default cap of 25): their
// expectedCandidates is [] by design, and this file asserts that empty
// result the same as any other case — the gap is a product-capability note,
// not a reason to weaken or skip the assertion (see docs/PROGRESS.md's
// FIX-03/Tier-A entry and CLAUDE.md's testing doctrine: never weaken a test
// to make the suite green).
import { describe, expect, it } from "vitest";
import {
  correlateMeasurementWithProductFacts,
  type ProductFactRecord,
} from "./harmonic-correlation";

/** Mirrors crado-tier-a-cases.json's own expectedCandidates shape, with
 * deviation expressed the way the engine returns it (a ratio, e.g. 0.002 =
 * 0.2%) rather than the fixture's percent form, so assertions read directly
 * against HarmonicCorrelationCandidate's own fields. */
interface ExpectedCandidate {
  source: string;
  harmonicNumber: number;
  expectedFrequencyMhz: number;
  deviationRatio: number;
}

interface TierACase {
  id: string;
  measuredFrequencyMhz: number;
  facts: ProductFactRecord[];
  expectedCandidates: ExpectedCandidate[];
}

const cases: TierACase[] = [
  {
    // TA-09 — tolerance-just-inside. 249.5 / 50 = 4.99 -> N=5,
    // expected 250 MHz, deviation 0.5/249.5 ≈ 0.2004%, inside the 1% band.
    id: "TA-09",
    measuredFrequencyMhz: 249.5,
    facts: [
      {
        id: "ta09-phy-clock",
        category: "clock",
        fact: { label: "PHY clock", frequencyMhz: 50 },
        source: "user_entered",
      },
    ],
    expectedCandidates: [
      {
        source: "PHY clock",
        harmonicNumber: 5,
        expectedFrequencyMhz: 250.0,
        deviationRatio: 0.5 / 249.5,
      },
    ],
  },
  {
    // TA-10 — tolerance-just-inside. 251.0 / 50 = 5.02 -> N=5,
    // expected 250 MHz, deviation 1/251 ≈ 0.3984%, still inside 1%.
    id: "TA-10",
    measuredFrequencyMhz: 251.0,
    facts: [
      {
        id: "ta10-phy-clock",
        category: "clock",
        fact: { label: "PHY clock", frequencyMhz: 50 },
        source: "user_entered",
      },
    ],
    expectedCandidates: [
      {
        source: "PHY clock",
        harmonicNumber: 5,
        expectedFrequencyMhz: 250.0,
        deviationRatio: 1.0 / 251.0,
      },
    ],
  },
  {
    // TA-11 — tolerance-just-outside. 252.6 / 50 = 5.052 -> N=5,
    // expected 250 MHz, deviation 2.6/252.6 ≈ 1.0294%, outside the 1% band:
    // the engine must abstain, not widen tolerance to force a match.
    id: "TA-11",
    measuredFrequencyMhz: 252.6,
    facts: [
      {
        id: "ta11-phy-clock",
        category: "clock",
        fact: { label: "PHY clock", frequencyMhz: 50 },
        source: "user_entered",
      },
    ],
    expectedCandidates: [],
  },
  {
    // TA-12 — tolerance-just-outside. 141.6 / 20 = 7.08 -> N=7,
    // expected 140 MHz, deviation 1.6/141.6 ≈ 1.1299%, outside 1%.
    id: "TA-12",
    measuredFrequencyMhz: 141.6,
    facts: [
      {
        id: "ta12-control-loop-clock",
        category: "clock",
        fact: { label: "Control loop clock", frequencyMhz: 20 },
        source: "user_entered",
      },
    ],
    expectedCandidates: [],
  },
  {
    // TA-13 — KNOWN GAP. 0.4 MHz x 100 = 40 MHz exactly (deviation 0), but
    // N=100 exceeds maxHarmonicNumber (25), so the engine never gets far
    // enough to even compute a deviation. Documents that a low-frequency
    // switcher producing a high-order harmonic is invisible to the
    // correlator — a real engine limitation, not a wrong answer: the
    // fixture's own expectedCandidates is [] here too.
    id: "TA-13",
    measuredFrequencyMhz: 40.0,
    facts: [
      {
        id: "ta13-flyback-controller",
        category: "power",
        fact: {
          label: "Flyback controller",
          topology: "flyback",
          switchingFrequencyMhz: 0.4,
        },
        source: "user_entered",
      },
    ],
    expectedCandidates: [],
  },
  {
    // TA-14 — KNOWN GAP. The 32.768 kHz RTC would need harmonic number
    // ~3052 to reach 100 MHz, far past the cap. The cable fact carries no
    // frequency at all (extractFrequencySources excludes cable/other) and
    // must never enter the correlator.
    id: "TA-14",
    measuredFrequencyMhz: 100.0,
    facts: [
      {
        id: "ta14-rtc",
        category: "clock",
        fact: { label: "Real time clock", frequencyMhz: 0.032768 },
        source: "user_entered",
      },
      {
        id: "ta14-rs485-harness",
        category: "cable",
        fact: { label: "Unshielded RS-485 harness", shielded: false },
        source: "user_entered",
      },
    ],
    expectedCandidates: [],
  },
  {
    // TA-20 — near-miss-must-abstain. Two plausible-looking clocks, both
    // outside tolerance: 25 MHz x 5 = 125 MHz (12/137 ≈ 8.76% off) and
    // 27 MHz x 5 = 135 MHz (2/137 ≈ 1.46% off, "looks close" but still
    // outside the 1% band). Neither may be returned.
    id: "TA-20",
    measuredFrequencyMhz: 137.0,
    facts: [
      {
        id: "ta20-cpu-clock",
        category: "clock",
        fact: { label: "CPU clock", frequencyMhz: 25 },
        source: "user_entered",
      },
      {
        id: "ta20-video-clock",
        category: "clock",
        fact: { label: "Video clock", frequencyMhz: 27 },
        source: "user_entered",
      },
    ],
    expectedCandidates: [],
  },
];

describe("Tier A group 1 — arithmetic verification (TA-09..TA-14, TA-20)", () => {
  for (const testCase of cases) {
    it(`${testCase.id}: correlateMeasurementWithProductFacts returns exactly the expected candidate set`, () => {
      const actual = correlateMeasurementWithProductFacts(
        testCase.measuredFrequencyMhz,
        testCase.facts,
      );

      expect(actual).toHaveLength(testCase.expectedCandidates.length);

      // Order-independent by source label — the engine's own sort (by
      // harmonic number, then deviation) is an implementation detail this
      // fixture doesn't assert on; matching per expected source keeps the
      // assertion about content, not ordering.
      for (const expected of testCase.expectedCandidates) {
        const match = actual.find((c) => c.productFactLabel === expected.source);
        if (!match) {
          throw new Error(
            `${testCase.id}: expected a candidate from "${expected.source}", found none in ${JSON.stringify(actual.map((c) => c.productFactLabel))}`,
          );
        }
        expect(match.harmonicNumber).toBe(expected.harmonicNumber);
        expect(match.expectedFrequencyMhz).toBeCloseTo(expected.expectedFrequencyMhz, 6);
        expect(match.deviationRatio).toBeCloseTo(expected.deviationRatio, 6);
      }
    });
  }
});
