// Shared deterministic (never a model call) field extraction — the exact
// numeric/label shapes a radiated-emissions measurement is described in,
// factored out of parse-investigation-intake.ts (UX-04's original home for
// this logic) so the composer's new Measurement and Engineering Change
// intents (UX-04, this pass) can reuse the identical, already-tested
// patterns instead of a second, drifting copy. Every function here reads
// only what's literally in the text — nothing is guessed or invented; a
// field that isn't confidently found comes back `null`.
export const REVISION_PATTERN = /\bRev[\s-]?(\d+)\b/i;
export const FREQUENCY_PATTERN = /(\d+(?:\.\d+)?)\s*MHz\b/i;
export const ABOVE_BELOW_LIMIT_PATTERN =
  /(\d+(?:\.\d+)?)\s*dB\s+(above|below)\s+(?:the\s+)?(?:selected\s+)?limit/i;
export const SIGNED_DB_PATTERN = /([+-])\s*(\d+(?:\.\d+)?)\s*dB\b/i;

// A short list of activity/state words that mark a clause as describing
// what the product was doing, not the failure itself — used only to find
// the *sentence* to keep verbatim as the operating mode, never to
// synthesize new wording.
const OPERATING_MODE_HINT = /\b(active|on|transmitting|tx|rx|charging|idle|standby|connected|running)\b/i;

export function extractRevisionLabel(text: string): string | null {
  const match = text.match(REVISION_PATTERN);
  return match ? `Rev${match[1]}` : null;
}

export function extractFrequencyMhz(text: string): number | null {
  const match = text.match(FREQUENCY_PATTERN);
  return match ? Number(match[1]) : null;
}

/** Signed: positive = above the selected limit, negative = below it. Prefers
 * an explicit "N dB above/below the limit" reading (unambiguous) over a bare
 * signed figure ("-3.6 dB" with no "limit" wording), which is a weaker
 * signal reused by callers that already know the surrounding context makes
 * it a margin and not, say, a delta. */
export function extractMarginDb(text: string): number | null {
  const aboveBelow = text.match(ABOVE_BELOW_LIMIT_PATTERN);
  if (aboveBelow) {
    const magnitude = Number(aboveBelow[1]);
    return aboveBelow[2].toLowerCase() === "above" ? magnitude : -magnitude;
  }
  const signed = text.match(SIGNED_DB_PATTERN);
  if (signed) {
    const magnitude = Number(signed[2]);
    return signed[1] === "-" ? -magnitude : magnitude;
  }
  return null;
}

export function extractOperatingMode(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const modeSentence = sentences.find((sentence) => OPERATING_MODE_HINT.test(sentence));
  if (!modeSentence) return null;
  // Strip a trailing period so the confirmation surface doesn't show one.
  return modeSentence.replace(/[.!?]+$/, "").trim();
}
