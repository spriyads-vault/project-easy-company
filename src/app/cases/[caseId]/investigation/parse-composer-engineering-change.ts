// COMPOSER ENGINEERING CHANGE PARSING (UX-04): deterministic extraction for
// the composer's Engineering change intent — "Changed the display
// termination and created Rev18." Title and description are ALWAYS a
// verbatim substring of what the engineer typed, never reworded — the one
// generated value is the suggested new revision label, and only when the
// text didn't name one explicitly, in which case it's built the same way
// RecordEngineeringChangeForm's existing "New revision label" field already
// suggests one (suggestNextRevisionLabel) — a pre-existing, disclosed
// precedent, not a new fabrication. affectedSubsystem is intentionally
// never guessed: there's no reliable, non-fragile way to pick a subsystem
// name out of arbitrary text, so it's always left null/editable.
import { extractRevisionLabel } from "@/lib/text-extraction/measurement-fields";
import { suggestNextRevisionLabel } from "@/lib/products/suggest-next-revision-label";

export interface ParsedComposerEngineeringChange {
  /** Always a verbatim substring of the input, capped to the domain
   * schema's 200-char title limit. */
  title: string;
  /** Always the full verbatim input, capped to the schema's 2000-char
   * description limit. */
  description: string;
  /** The revision label to create. */
  newRevisionLabel: string;
  /** True when `newRevisionLabel` was read directly from the text (e.g.
   * "...created Rev18"); false when it's a computed suggestion the
   * engineer still needs to confirm. */
  newRevisionLabelWasExplicit: boolean;
}

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

// Everything from an explicit "and created/creates/made RevN" clause
// onward is about the *result* (the new revision), not the change itself —
// stripped so the title reads as "Display termination changed" rather than
// "Display termination changed and created Rev18".
const REVISION_CREATION_CLAUSE = /\s*,?\s*(?:and\s+)?(?:created|creates|creating|made)\s+Rev[\s-]?\d+\b.*$/i;

function extractTitle(text: string): string {
  const withoutRevisionClause = text.replace(REVISION_CREATION_CLAUSE, "").trim().replace(/[.,;]+$/, "");
  const base = withoutRevisionClause.length > 0 ? withoutRevisionClause : text;
  return base.length > TITLE_MAX ? `${base.slice(0, TITLE_MAX - 1)}…` : base;
}

export function parseComposerEngineeringChange(
  rawText: string,
  currentRevisionLabel: string,
): ParsedComposerEngineeringChange {
  const text = rawText.trim();
  const explicitRevision = extractRevisionLabel(text);

  return {
    title: extractTitle(text),
    description: text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text,
    newRevisionLabel: explicitRevision ?? suggestNextRevisionLabel(currentRevisionLabel),
    newRevisionLabelWasExplicit: explicitRevision !== null,
  };
}
