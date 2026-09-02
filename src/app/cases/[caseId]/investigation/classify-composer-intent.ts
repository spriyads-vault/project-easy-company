// COMPOSER INTENT CLASSIFICATION (UX-04): deterministic (never a model
// call), same design precedent as parse-engineer-input.ts and
// parse-investigation-intake.ts — see docs/UX_AGENT_NATIVE.md §7. The
// composer accepts free text for three different actions (Observation,
// Measurement, Engineering change); this decides which one a message most
// likely is, so the right confirmation surface and the right structural
// parser can be shown.
//
// Deliberately NOT a bag of keyword checks: every rule below keys off a
// *structural* pattern (a number + unit + a specific framing), not a bare
// word match, and the engineer always sees a 3-way switcher on the
// confirmation card regardless of confidence — so a wrong or low-confidence
// read is always one click from being corrected, never a silent
// misclassification. See the module-level comments on each pattern for why
// it's read the way it is.
import { DECREASE_WORDS, INCREASE_WORDS } from "./parse-engineer-input";
import { ABOVE_BELOW_LIMIT_PATTERN, FREQUENCY_PATTERN } from "@/lib/text-extraction/measurement-fields";

export type ComposerIntent = "observation" | "measurement" | "engineering_change";

export interface ComposerClassification {
  intent: ComposerIntent;
  /** "high": a structurally unambiguous signal was found (an explicit
   * revision-creation phrase, or an explicit "N dB above/below the limit"
   * margin reading). "low": Crado's best guess from a weaker signal — the
   * confirmation surface should make switching intents easy, never commit
   * silently. Observation, the always-safe default, is "high" simply
   * because there's nothing to second-guess: it never creates a revision
   * or asserts an absolute margin, so a wrong observation classification
   * costs the engineer one click to switch, not a bad structured write. */
  confidence: "high" | "low";
}

// Nothing else in the app creates a product revision except recording an
// engineering change — an explicit "created/creates/made RevN" or "new
// revision" phrase is the one structurally unambiguous signal that this
// message describes one. A bare change verb ("changed", "modified") alone
// is NOT treated as this intent: "Changed the antenna position during the
// test" is describing what was done during a measurement, not necessarily
// that a new revision now exists — that would be exactly the "fragile
// keyword-only" misread this classifier is built to avoid.
const REVISION_CREATED_PATTERN = /\b(created|creates|creating|made)\s+Rev[\s-]?\d+\b/i;
const NEW_REVISION_PHRASE = /\bnew revision\b/i;

// A re-test/measurement verb, used only to gate the low-confidence
// Measurement path below — on its own it says nothing about intent.
const RETEST_VERB = /\b(retest(?:ed)?|re-?measured|measured|tested)\b/i;

export function classifyComposerIntent(text: string): ComposerClassification {
  const trimmed = text.trim();

  if (REVISION_CREATED_PATTERN.test(trimmed) || NEW_REVISION_PHRASE.test(trimmed)) {
    return { intent: "engineering_change", confidence: "high" };
  }

  // "N dB above/below the limit" only ever describes an absolute margin
  // reading — parse-engineer-input.ts's own delta patterns (dropped/rose/
  // etc.) never match this phrasing, so there's no ambiguity with
  // Observation here.
  if (ABOVE_BELOW_LIMIT_PATTERN.test(trimmed)) {
    return { intent: "measurement", confidence: "high" };
  }

  // A frequency mention + a re-test verb, with no delta-direction word
  // (which would instead point to "the peak dropped/rose N dB" — an
  // Observation) — read as a fresh absolute measurement, but only a
  // low-confidence one: there's no explicit above/below-the-limit phrase
  // to anchor it, so a bare signed figure here ("-3.6 dB") could just as
  // easily be a delta the engineer forgot to phrase as one.
  const hasDeltaWord = DECREASE_WORDS.test(trimmed) || INCREASE_WORDS.test(trimmed);
  if (FREQUENCY_PATTERN.test(trimmed) && RETEST_VERB.test(trimmed) && !hasDeltaWord) {
    return { intent: "measurement", confidence: "low" };
  }

  return { intent: "observation", confidence: "high" };
}
