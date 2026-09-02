// Restrained spectrum-style visualization for the one thing we actually
// store: a single measured peak and its margin relative to the selected
// limit line. We do NOT have a full raw spectrum trace, so this
// deliberately does not draw one — a dashed limit line and a single peak
// marker, nothing fabricated in between. See CLAUDE.md "Product truth":
// measurement is part of the product truth, never invented.
import { accent } from "./theme";

interface SpectrumChartProps {
  frequencyMhz: number;
  marginDb: number;
}

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 120;
const LIMIT_Y = VIEW_HEIGHT / 2;
// Clamp the visual range so one very large excursion can't flatten the
// chart — the exact number is always shown as text regardless.
const DISPLAY_RANGE_DB = 12;

export function SpectrumChart({ frequencyMhz, marginDb }: SpectrumChartProps) {
  const clamped = Math.max(-DISPLAY_RANGE_DB, Math.min(DISPLAY_RANGE_DB, marginDb));
  const peakY = LIMIT_Y - (clamped / DISPLAY_RANGE_DB) * (LIMIT_Y - 16);
  const peakX = VIEW_WIDTH * 0.62;
  const aboveLimit = marginDb > 0;
  const peakColor = aboveLimit ? accent.warn : accent.green;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={`${frequencyMhz} megahertz peak, ${marginDb > 0 ? "+" : ""}${marginDb} decibels relative to the selected limit`}
      className="h-28 w-full"
    >
      {/* Selected limit line */}
      <line
        x1={16}
        y1={LIMIT_Y}
        x2={VIEW_WIDTH - 16}
        y2={LIMIT_Y}
        stroke="#d4d4d8"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text x={16} y={LIMIT_Y - 8} fill="#a1a1aa" fontSize={9} letterSpacing="0.08em">
        SELECTED LIMIT
      </text>

      {/* Stem from the limit line to the peak */}
      <line x1={peakX} y1={LIMIT_Y} x2={peakX} y2={peakY} stroke={peakColor} strokeWidth={1.5} />
      <circle cx={peakX} cy={peakY} r={4} fill={peakColor} />

      <text
        x={peakX}
        y={peakY - 10}
        fill="#18181b"
        fontSize={11}
        fontFamily="var(--font-geist-mono, monospace)"
        textAnchor="middle"
      >
        {frequencyMhz} MHz
      </text>
      <text
        x={peakX}
        y={aboveLimit ? peakY + 18 : peakY - 22}
        fill={peakColor}
        fontSize={10}
        fontFamily="var(--font-geist-mono, monospace)"
        textAnchor="middle"
      >
        {marginDb > 0 ? "+" : ""}
        {marginDb} dB
      </text>
    </svg>
  );
}
