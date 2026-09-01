// A pure display-only suggestion for the "new revision label" field on the
// RECORD ENGINEERING CHANGE form (MVP-11) — never authoritative, the
// engineer can always type something else. Increments a trailing integer
// in the current label ("Rev17" -> "Rev18", "Rev 3" -> "Rev 4"); falls back
// to a plain suffix when the label has no trailing number to increment.
export function suggestNextRevisionLabel(currentLabel: string): string {
  const match = currentLabel.match(/^(.*?)(\d+)(\s*)$/);
  if (!match) return `${currentLabel} (new)`;
  const [, prefix, digits, trailingSpace] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${prefix}${next}${trailingSpace}`;
}
