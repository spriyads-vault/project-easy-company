// UX-02 bottom composer: a small, deterministic, testable parser — never a
// model call, never a paraphrase. "Do not silently convert natural
// language into authoritative product facts": this never rewrites what
// the engineer typed into different words (the OBSERVATION shown for
// confirmation is always their own sentence, verbatim); it only
// mechanically pulls out a "N dB" delta when the phrasing makes the
// direction unambiguous, purely so the confirmation card can show it as
// its own MEASUREMENT CHANGE line before anything is persisted. Anything
// it can't confidently read a direction for is left as an observation
// with no measurement change — never guessed.
export interface ParsedEngineerInput {
  /** Always the engineer's own words, unmodified — this is what gets
   * confirmed and persisted as the observation. */
  observation: string;
  /** A short "+N dB" / "-N dB" phrase, or null when no unambiguous
   * directional dB figure was found in the text. */
  measurementChange: string | null;
}

const SIGNED_DB_PATTERN = /([+-])\s*(\d+(?:\.\d+)?)\s*dB\b/i;
const MAGNITUDE_DB_PATTERN = /(\d+(?:\.\d+)?)\s*dB\b/i;
// Exported for classify-composer-intent.ts (UX-04): a delta-direction word
// like "dropped" is exactly the signal that tells the composer's intent
// classifier this dB figure describes a *change* (an Observation), not an
// absolute margin reading (a Measurement) — see that module's own comments
// for the full reasoning.
export const DECREASE_WORDS = /\b(dropped|decreased|reduced|fell|lower|down)\b/i;
export const INCREASE_WORDS = /\b(increased|rose|climbed|higher|up)\b/i;

function formatDelta(deltaDb: number): string {
  return deltaDb > 0 ? `+${deltaDb} dB` : `${deltaDb} dB`;
}

export function parseEngineerInput(raw: string): ParsedEngineerInput {
  const observation = raw.trim();

  // An explicit sign ("-9 dB", "+3dB") is unambiguous on its own.
  const signed = observation.match(SIGNED_DB_PATTERN);
  if (signed) {
    const magnitude = Number(signed[2]);
    const deltaDb = signed[1] === "-" ? -magnitude : magnitude;
    return { observation, measurementChange: formatDelta(deltaDb) };
  }

  // Otherwise a bare magnitude ("dropped 9 dB") only becomes a directional
  // change when a recognized direction word is also present — a bare
  // "9 dB" with no direction word stays unparsed rather than guessed.
  const magnitudeMatch = observation.match(MAGNITUDE_DB_PATTERN);
  if (magnitudeMatch) {
    const magnitude = Number(magnitudeMatch[1]);
    if (DECREASE_WORDS.test(observation)) {
      return { observation, measurementChange: formatDelta(-magnitude) };
    }
    if (INCREASE_WORDS.test(observation)) {
      return { observation, measurementChange: formatDelta(magnitude) };
    }
  }

  return { observation, measurementChange: null };
}
