// UX-05 Workstream B: a restrained, monochrome engineering-line-drawing
// glyph used as a recent-investigation card's orientation aid — never the
// card's primary information. The `products` table has no device-type/
// category column (confirmed against the schema before writing this), so
// there is no real signal to classify a product's physical form from yet.
// Per the ticket's own instruction — "If the data cannot establish the
// physical device type, use one consistent generic hardware/component
// outline; do not falsely depict an antenna, PCB, gateway or sensor" —
// this renders exactly one honest generic outline (a connected hardware
// enclosure: body + one external connector + a status indicator) for
// every product today. The `category` prop exists so a future real
// product-category field is a drop-in addition, not a rewrite — passing
// one now would be fabricating data the schema doesn't have, so nothing
// calls it yet.
import { cn } from "./cn";

export type DeviceCategory = "generic";

interface DeviceGlyphProps {
  category?: DeviceCategory;
  className?: string;
  /** Set only when the glyph is the sole content identifying something
   * (rare — normally it sits beside real product/title text that already
   * carries the accessible name, so this defaults to decorative/hidden). */
  label?: string;
}

export function DeviceGlyph({ category: _category = "generic", className, label }: DeviceGlyphProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("text-muted-foreground/70", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Enclosure */}
      <rect x="8" y="12" width="32" height="24" rx="3" />
      {/* External connector/port — the one generic "this is connected
          hardware" cue, not a specific antenna/PCB/sensor claim. */}
      <path d="M40 20h4M40 28h4" />
      {/* Status indicator */}
      <circle cx="15" cy="19" r="1.6" fill="currentColor" stroke="none" />
      {/* Ventilation/board lines — restrained texture, not a fabricated
          internal-component illustration. */}
      <path d="M14 27h12M14 31h8" />
    </svg>
  );
}
