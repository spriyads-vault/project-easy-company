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
// the *clause* to keep (near-)verbatim as the operating mode, never to
// synthesize new wording.
const OPERATING_MODE_HINT = /\b(active|on|transmitting|tx|rx|charging|idle|standby|connected|running)\b/i;

// FIX-02: the clause introducing the operating mode — "...with Wi-Fi TX
// and the display active". Matched from the LAST occurrence (a real
// failure description can legitimately contain an earlier, unrelated
// "with", e.g. "failed with 200 MHz exceeding the limit, with Wi-Fi TX
// active" — the trailing clause is the one that actually describes the
// mode) to the end of the string, not to the next sentence boundary: a
// one-sentence input with no internal `.`/`!`/`?` at all is exactly the
// shape that triggered this ticket's bug (see extractOperatingMode).
const MODE_CONNECTOR_PATTERN = /\b(?:with|while|during)\b/gi;

/** Strips trailing sentence punctuation and standalone "the" — this
 * field's own established convention has no articles (see the intake
 * composer's placeholder, "WiFi TX + display active"), so "the display
 * active" normalizes to "display active" the same way "the WiFi radio
 * active" would. Never invents or reorders words, only removes filler. */
function cleanModeClause(raw: string): string {
  return raw
    .replace(/[.!?]+\s*$/, "")
    .replace(/\bthe\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
  // Prefer the connector-introduced clause ("with"/"while"/"during" to the
  // end of the string) — isolates just the mode clause rather than ever
  // falling back to the raw input. Only trusted when it actually contains
  // an activity/state word: "with" can introduce something else entirely
  // ("failed with a 3 dB margin"), and extracting nothing is correct there,
  // not a guess.
  let lastConnectorEnd = -1;
  for (const match of text.matchAll(MODE_CONNECTOR_PATTERN)) {
    lastConnectorEnd = match.index + match[0].length;
  }
  if (lastConnectorEnd >= 0) {
    const clause = cleanModeClause(text.slice(lastConnectorEnd));
    if (clause && OPERATING_MODE_HINT.test(clause)) return clause;
  }

  // No connector clause — fall back to the previous whole-sentence-hint
  // approach, but only across text that's genuinely split into more than
  // one sentence. A single, undivided sentence being "the one sentence
  // with a hint word" is exactly FIX-02's bug (the entire raw input
  // matching itself as its own "mode sentence"), so that degenerate case
  // must never win; leaving the field empty is correct there instead.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 2) return null;
  const modeSentence = sentences.find((sentence) => OPERATING_MODE_HINT.test(sentence));
  return modeSentence ? cleanModeClause(modeSentence) : null;
}
