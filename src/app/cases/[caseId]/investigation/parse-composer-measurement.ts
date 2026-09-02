// COMPOSER MEASUREMENT PARSING (UX-04): deterministic extraction for the
// composer's Measurement intent — "Retested Rev18. 200 MHz is now 3.6 dB
// below the limit." reuses the exact frequency/margin/operating-mode
// patterns src/lib/text-extraction/measurement-fields.ts already applies
// to the new-investigation intake, so the same sentence shape reads the
// same way everywhere in the product. Every field is independently
// optional — an unread field stays null and the confirmation surface shows
// it empty/editable rather than a guessed value. This flow always attaches
// to the investigation's CURRENT revision (the same one the manual "Add
// measurement" form binds to) — no attempt is made to parse an arbitrary
// revision name out of free text and resolve it to a different revision;
// that stays an Advanced-form-only capability.
import {
  extractFrequencyMhz,
  extractMarginDb,
  extractOperatingMode,
} from "@/lib/text-extraction/measurement-fields";

export interface ParsedComposerMeasurement {
  frequencyMhz: number | null;
  marginDb: number | null;
  operatingMode: string | null;
}

export function parseComposerMeasurement(rawText: string): ParsedComposerMeasurement {
  const text = rawText.trim();
  return {
    frequencyMhz: extractFrequencyMhz(text),
    marginDb: extractMarginDb(text),
    operatingMode: extractOperatingMode(text),
  };
}
