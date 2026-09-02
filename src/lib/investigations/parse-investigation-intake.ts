// Deterministic (never a model call) extraction for the "What happened?"
// intake composer — the same design choice as
// src/app/cases/[caseId]/investigation/parse-engineer-input.ts, extended
// to the richer set of fields a brand-new investigation needs. See
// docs/UX_AGENT_NATIVE.md §7 for the full reasoning.
//
// Every field is independently optional — nothing here ever guesses a
// value it isn't confident about; a field it can't read stays null and
// the confirmation surface simply shows it as editable/empty rather than
// inventing a plausible-looking value. The one exception is the product
// match, which is checked against the workspace's REAL product list
// (never invented) and clearly separated from an unmatched name guess.

export interface ProductCandidate {
  id: string;
  name: string;
}

export interface ParsedIntake {
  /** A real, existing product this text matched — never fabricated. */
  productMatch: ProductCandidate | null;
  /** When no existing product matched, a best-effort name guessed from the
   * text's own words (for a "create new product" confirmation) — still
   * always the engineer's own words, never invented. */
  productNameGuess: string | null;
  revisionLabel: string | null;
  frequencyMhz: number | null;
  /** Signed: positive = above the selected limit, negative = below it. */
  marginDb: number | null;
  operatingMode: string | null;
}

const REVISION_PATTERN = /\bRev[\s-]?(\d+)\b/i;
const FREQUENCY_PATTERN = /(\d+(?:\.\d+)?)\s*MHz\b/i;
const ABOVE_BELOW_LIMIT_PATTERN =
  /(\d+(?:\.\d+)?)\s*dB\s+(above|below)\s+(?:the\s+)?(?:selected\s+)?limit/i;
const SIGNED_DB_PATTERN = /([+-])\s*(\d+(?:\.\d+)?)\s*dB\b/i;

// A short list of activity/state words that mark a clause as describing
// what the product was doing, not the failure itself — used only to find
// the *sentence* to keep verbatim as the operating mode, never to
// synthesize new wording.
const OPERATING_MODE_HINT = /\b(active|on|transmitting|tx|rx|charging|idle|standby|connected|running)\b/i;

function extractRevisionLabel(text: string): string | null {
  const match = text.match(REVISION_PATTERN);
  return match ? `Rev${match[1]}` : null;
}

function extractFrequencyMhz(text: string): number | null {
  const match = text.match(FREQUENCY_PATTERN);
  return match ? Number(match[1]) : null;
}

function extractMarginDb(text: string): number | null {
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

function extractOperatingMode(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const modeSentence = sentences.find((sentence) => OPERATING_MODE_HINT.test(sentence));
  if (!modeSentence) return null;
  // Strip a trailing period so the confirmation surface doesn't show one.
  return modeSentence.replace(/[.!?]+$/, "").trim();
}

/** The leading noun-phrase before the revision token or a known failure
 * verb — a best-effort product-name guess, always the engineer's own
 * words, used only when no real product matched. */
function guessProductName(text: string): string | null {
  const match = text.match(/^(.*?)\s+(?:Rev[\s-]?\d+|failed|measured|tested|retested)/i);
  const guess = match?.[1]?.trim();
  return guess && guess.length > 0 && guess.length <= 80 ? guess : null;
}

function matchExistingProduct(text: string, products: ProductCandidate[]): ProductCandidate | null {
  const lowerText = text.toLowerCase();
  const matches = products.filter((product) => lowerText.includes(product.name.toLowerCase()));
  if (matches.length === 0) return null;
  // Longest name wins — the most specific real match for overlapping names.
  return matches.reduce((best, candidate) => (candidate.name.length > best.name.length ? candidate : best));
}

export function parseInvestigationIntake(rawText: string, products: ProductCandidate[]): ParsedIntake {
  const text = rawText.trim();
  const productMatch = matchExistingProduct(text, products);

  return {
    productMatch,
    productNameGuess: productMatch ? null : guessProductName(text),
    revisionLabel: extractRevisionLabel(text),
    frequencyMhz: extractFrequencyMhz(text),
    marginDb: extractMarginDb(text),
    operatingMode: extractOperatingMode(text),
  };
}
