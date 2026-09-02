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
//
// The revision/frequency/margin/operating-mode extraction itself lives in
// src/lib/text-extraction/measurement-fields.ts, shared with the
// composer's Measurement and Engineering Change intents (UX-04) so all
// three free-text flows read the same numbers the same way.
import {
  extractFrequencyMhz,
  extractMarginDb,
  extractOperatingMode,
  extractRevisionLabel,
} from "@/lib/text-extraction/measurement-fields";

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
