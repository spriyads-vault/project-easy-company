"use client";

// UX-07 correction: an evidence value (or a MISSING item) renders clamped
// by default — "a record, not prose" — with a "Show more" control that
// appears only when the text is long enough to plausibly need it. A
// character-count heuristic, not a live layout measurement: the value
// column's width is fixed by each card's own two-column grid, so a
// length threshold is a good-enough, deterministic, easily-testable proxy
// for "this will overflow its clamp" without pulling a ResizeObserver-
// based overflow detector into what is, at most, a handful of short
// sentences. The full, unclamped text is always available via the native
// `title` attribute (hover) in addition to the explicit expand control.
import { useState } from "react";

interface ClampedTextProps {
  text: string;
  /** 2 for a normal evidence value; 1 for a MISSING item, which the
   * correction ticket specifies renders "one line each". */
  lines?: 1 | 2;
  className?: string;
}

const OVERFLOW_THRESHOLD: Record<1 | 2, number> = { 1: 70, 2: 150 };

export function ClampedText({ text, lines = 2, className = "" }: ClampedTextProps) {
  const [expanded, setExpanded] = useState(false);
  const mayOverflow = text.length > OVERFLOW_THRESHOLD[lines];
  const clampClass = !expanded && mayOverflow ? (lines === 1 ? "line-clamp-1" : "line-clamp-2") : "";

  return (
    <span className="flex flex-col items-start gap-0.5">
      <span title={text} className={`${clampClass} ${className}`}>
        {text}
      </span>
      {mayOverflow ? (
        <button
          type="button"
          onClick={(event) => {
            // These values render inside a whole-card onSelect target
            // (see hypothesis-card.tsx) — a click here must expand/
            // collapse this one value, not also select the card.
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </span>
  );
}
