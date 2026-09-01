// MEASUREMENT region: the actual stored evidence for the measurement under
// investigation — one peak, its margin relative to the selected limit, and
// the operating mode it was captured under. Nothing here is derived from
// the analysis run; it's exactly what's in Postgres, visible before any
// investigation is started.
import Link from "next/link";
import type { MeasurementRow } from "@/lib/cases/queries";
import { SpectrumChart } from "./spectrum-chart";
import { accent, surface, text } from "./theme";

interface MeasurementPanelProps {
  caseId: string;
  measurement: MeasurementRow | null;
}

/** Splits a free-text operating mode ("WiFi TX + display active") into
 * condition chips on its natural conjunctions. This only re-presents the
 * real stored string — it never infers or invents structured flags that
 * aren't actually in the schema. */
function operatingConditions(operatingMode: string | null): string[] {
  if (!operatingMode) return [];
  const parts = operatingMode
    .split(/\s*\+\s*|,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [operatingMode];
}

export function MeasurementPanel({ caseId, measurement }: MeasurementPanelProps) {
  const peak = measurement?.peaks[0] ?? null;

  return (
    <section aria-labelledby="measurement-panel-heading" className={`flex flex-col gap-4 p-5 ${surface.panel}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id="measurement-panel-heading" className={text.kicker}>
            Measurement
          </h2>
          {measurement ? (
            <span className={`${text.mono} text-xs ${text.muted}`}>{measurement.revisionLabel}</span>
          ) : null}
        </div>
        <Link
          href={`/cases/${caseId}`}
          className={`text-xs ${text.muted} hover:text-[#1c1a15] hover:underline`}
        >
          Add measurement
        </Link>
      </div>

      {!measurement || !peak ? (
        <p className={`text-sm ${text.muted}`}>
          No measurement recorded for this case yet.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className={`text-3xl font-semibold ${text.mono}`}>
                {peak.frequencyMhz} <span className="text-lg font-normal">MHz</span>
              </span>
              <span
                className={`text-sm font-medium ${text.mono} ${
                  peak.marginDb > 0 ? accent.warnText : accent.greenText
                }`}
              >
                {peak.marginDb > 0 ? "+" : ""}
                {peak.marginDb} dB relative to selected limit
              </span>
            </div>
          </div>

          <SpectrumChart frequencyMhz={peak.frequencyMhz} marginDb={peak.marginDb} />

          {operatingConditions(measurement.operatingMode).length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {operatingConditions(measurement.operatingMode).map((condition) => (
                <li
                  key={condition}
                  className="border border-[#e7e2d6] px-2 py-1 text-xs uppercase tracking-wide text-[#6b6354]"
                >
                  {condition}
                </li>
              ))}
            </ul>
          ) : null}

          {peak.detector || peak.limitLine ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {peak.detector ? (
                <>
                  <dt className={text.muted}>Detector</dt>
                  <dd className={text.mono}>{peak.detector}</dd>
                </>
              ) : null}
              {peak.limitLine ? (
                <>
                  <dt className={text.muted}>Limit line</dt>
                  <dd className={text.mono}>{peak.limitLine}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
        </>
      )}
    </section>
  );
}
