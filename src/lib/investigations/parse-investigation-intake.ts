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
import type { ProductFactInput } from "@/lib/domain/schema";

export interface ProductCandidate {
  id: string;
  name: string;
}

// FIX-02 Defect 2: a frequency-bearing product fact (clock, radio, or
// switching rail) pulled from the intake sentence itself, deterministically
// — CLAUDE.md tie-breaker 7 ("prefer a testable deterministic utility
// before adding another agent/model call"). A minimal, UI-friendly shape:
// the confirmation panel renders these as plain editable label/frequency
// rows, and buildProductFactInput below expands one into the full
// category-specific ProductFactInput only at persist time.
export type FrequencyFactCategory = "clock" | "radio" | "power";

export interface ExtractedProductFact {
  category: FrequencyFactCategory;
  label: string;
  frequencyMhz: number;
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
  /** Clock/radio/switching-rail facts found in the sentence itself — see
   * extractProductFacts. Always [] rather than a guess when nothing
   * qualifies (e.g. a frequency with no named source next to it). */
  productFacts: ExtractedProductFact[];
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

// FIX-02 Defect 2 / FIX-04: which words identify each category, matched
// only as the word(s) immediately after a frequency figure —
// "N MHz <words>". Kept narrow and literal on purpose ("extract nothing
// rather than guess"): every alternative here is a real, specific
// component/topology word an engineer would actually write next to a
// figure, never a generic word that could belong to something unrelated
// (e.g. "controller" or "rail" alone are deliberately left out — see
// FIX-04's own PROGRESS.md entry for the "flyback controller" case this
// excludes from the label). FIX-04 widened this from FIX-02's original
// "clock"/radio-list/"switching rail|regulator|converter" after
// "25 MHz MCU crystal" and "8 MHz reference oscillator" were found to
// extract nothing — the keyword only ever needs to be the LAST word
// matchFrequencySourceLabel captures; a descriptive word in front of it
// ("MCU", "reference", "system") is already handled by that function's
// own up-to-4-leading-words allowance, so words like "clock" alone cover
// every "<adjective> clock" phrasing without a compound entry per
// adjective.
const FREQUENCY_FACT_CATEGORIES: ReadonlyArray<{
  category: FrequencyFactCategory;
  keywordPattern: string;
}> = [
  {
    category: "clock",
    keywordPattern: "clock|crystal|oscillator|xtal|resonator|phy|mclk|timebase",
  },
  {
    category: "radio",
    keywordPattern:
      "radio|wifi|wi-fi|bluetooth|ble|lora|zigbee|transceiver|transmitter|module",
  },
  {
    category: "power",
    keywordPattern:
      "switching\\s+(?:rail|regulator|converter|frequency)|power\\s+rail|switcher|regulator|converter|buck|boost|flyback|smps",
  },
];

const FREQUENCY_TOKEN_PATTERN = /(\d+(?:\.\d+)?)\s*(MHz|GHz|kHz)\b/gi;

function toMhz(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case "ghz":
      return value * 1000;
    case "khz":
      return value / 1000;
    default:
      return value;
  }
}

function capitalizeFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** The plain source name right after a frequency figure, up to and
 * including the category keyword — e.g. "system clock", or the keyword
 * alone ("WiFi") when nothing precedes it. Never crosses a clause
 * boundary: matching stops at the first character that isn't a letter,
 * digit, "/", "-", or whitespace, so "200 MHz, 7.4 dB above..." (a comma
 * immediately after the figure) correctly matches nothing — the ticket's
 * own ", 7.4 dB above the limit, with..." case. */
function matchFrequencySourceLabel(afterFrequency: string, keywordPattern: string): string | null {
  const pattern = new RegExp(
    `^\\s+((?:[A-Za-z][A-Za-z0-9/-]*\\s+){0,4}(?:${keywordPattern}))\\b`,
    "i",
  );
  return afterFrequency.match(pattern)?.[1] ?? null;
}

/** Deterministic only — no model call, per CLAUDE.md tie-breaker 7 and this
 * ticket's own rule. Each frequency figure in the text is checked against
 * each category in turn; the first category whose keyword appears
 * immediately after it wins (a figure never becomes two facts at once).
 * A figure with no recognized source word next to it (e.g. the
 * measurement's own "200 MHz, 7.4 dB above...") contributes nothing. */
export function extractProductFacts(rawText: string): ExtractedProductFact[] {
  const text = rawText.trim();
  const facts: ExtractedProductFact[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(FREQUENCY_TOKEN_PATTERN)) {
    const value = Number(match[1]);
    const unit = match[2];
    const afterFrequency = text.slice((match.index ?? 0) + match[0].length);

    for (const { category, keywordPattern } of FREQUENCY_FACT_CATEGORIES) {
      const rawLabel = matchFrequencySourceLabel(afterFrequency, keywordPattern);
      if (!rawLabel) continue;

      const label = capitalizeFirst(rawLabel.trim());
      const dedupeKey = `${category}:${label.toLowerCase()}`;
      if (seen.has(dedupeKey)) break;
      seen.add(dedupeKey);
      facts.push({ category, label, frequencyMhz: toMhz(value, unit) });
      break;
    }
  }

  return facts;
}

/** Expands a minimal extracted fact into the full, category-specific
 * ProductFactInput the existing product_facts insert path
 * (src/app/products/[productId]/revisions/[revisionId]/actions.ts's
 * createFact) already validates and writes — reused rather than
 * duplicated, per this ticket's own "product facts already have a
 * fact-creation path, reuse it." Radio/power facts need a
 * technology/topology string the plain sentence doesn't separately name;
 * reusing the label itself (never inventing new words) is the only
 * non-guessing choice available. source: "extracted" records that this
 * came from parsed text, not a manual entry. */
export function buildProductFactInput(fact: ExtractedProductFact): ProductFactInput {
  switch (fact.category) {
    case "clock":
      return {
        category: "clock",
        fact: { label: fact.label, frequencyMhz: fact.frequencyMhz },
        source: "extracted",
      };
    case "radio":
      return {
        category: "radio",
        fact: { label: fact.label, technology: fact.label, frequencyMhz: fact.frequencyMhz },
        source: "extracted",
      };
    case "power":
      return {
        category: "power",
        fact: { label: fact.label, topology: fact.label, switchingFrequencyMhz: fact.frequencyMhz },
        source: "extracted",
      };
  }
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
    productFacts: extractProductFacts(text),
  };
}
