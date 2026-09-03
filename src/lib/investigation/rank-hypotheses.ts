// UX-05 (Decision-centred investigation workspace): orders the run's
// hypotheses by real support so the Decision view's "Leading hypotheses"
// section can show the strongest lead first — without inventing a
// probability, percentage, or score the domain doesn't produce (see
// docs/PROGRESS.md's MVP-11 note on why hypothesis strength stays
// qualitative-only). Every input here is a field HypothesisCreatedPayload
// already carries: confidenceBand (set by the agent's own structured
// output, MVP-07) and update.status (set only when this hypothesis is a
// documented continuation of an earlier one, MVP-11) — nothing is
// inferred beyond those two real fields.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";

export type HypothesisStrength = "leading" | "plausible" | "weakened" | "unresolved";

export const HYPOTHESIS_STRENGTH_LABEL: Record<HypothesisStrength, string> = {
  leading: "Leading",
  plausible: "Plausible",
  weakened: "Weakened",
  unresolved: "Unresolved",
};

const STRENGTH_ORDER: HypothesisStrength[] = ["leading", "plausible", "weakened", "unresolved"];

/**
 * A hypothesis explicitly weakened by later evidence ranks last regardless
 * of its original confidence band — that's the whole point of tracking
 * updates. One still explicitly flagged as needing more evidence ranks as
 * unresolved for the same reason. Absent an update (the common case — most
 * hypotheses are not a continuation of an earlier run), strength follows
 * the agent's own confidenceBand directly: high confidence reads as
 * leading, medium as plausible, low as unresolved (a low-confidence read
 * is not "weakened" — nothing weakened it, it simply isn't strong yet).
 */
export function deriveHypothesisStrength(hypothesis: HypothesisCreatedPayload): HypothesisStrength {
  if (hypothesis.update?.status === "weakened_by_new_evidence") return "weakened";
  if (hypothesis.update?.status === "needs_more_evidence") return "unresolved";
  if (hypothesis.confidenceBand === "high") return "leading";
  if (hypothesis.confidenceBand === "medium") return "plausible";
  return "unresolved";
}

export interface RankedHypothesis {
  hypothesis: HypothesisCreatedPayload;
  /** The hypothesis's position in the original, unranked run order —
   * carried through so a click can still report "Hypothesis 02" against
   * the same numbering the timeline/evidence view use, not a
   * ranking-dependent number that would shift as new hypotheses stream
   * in. */
  originalIndex: number;
  strength: HypothesisStrength;
}

/** Stable sort — ties (same strength) keep their original run order, so
 * ranking never reshuffles two hypotheses the agent produced with equal
 * standing. */
export function rankHypotheses(hypotheses: readonly HypothesisCreatedPayload[]): RankedHypothesis[] {
  return hypotheses
    .map((hypothesis, originalIndex) => ({
      hypothesis,
      originalIndex,
      strength: deriveHypothesisStrength(hypothesis),
    }))
    .sort((a, b) => STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength));
}
