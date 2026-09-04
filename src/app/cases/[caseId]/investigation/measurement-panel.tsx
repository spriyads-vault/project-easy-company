// MEASUREMENT artifact (UX-03): the opening node of the investigation
// canvas — an "instrument-style object", not a bordered dashboard panel.
// The actual stored evidence for the measurement under investigation: one
// peak, its margin relative to the selected limit, and the operating mode
// it was captured under. Nothing here is derived from the analysis run;
// it's exactly what's in Postgres, visible before any investigation is
// started.
import Link from "next/link";
import type { MeasurementRow } from "@/lib/cases/queries";
import { SpectrumChart } from "./spectrum-chart";
import { accent, artifact, focusRing, surface, text } from "./theme";

interface MeasurementPanelProps {
  caseId: string;
  measurement: MeasurementRow | null;
  /** UX-03: selects this artifact in the right context rail. Optional so
   * every pre-UX-03 test call site (rendering the panel standalone) keeps
   * working unmodified. */
  onSelect?: () => void;
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

export function MeasurementPanel({ caseId, measurement, onSelect }: MeasurementPanelProps) {
  const peak = measurement?.peaks[0] ?? null;
  const style = artifact.measurement;

  return (
    <section
      aria-labelledby="measurement-panel-heading"
      className={`flex flex-col gap-4 border-l-2 p-5 ${style.accent} ${surface.card}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id="measurement-panel-heading" className={text.kicker}>
            {style.label}
          </h2>
          {measurement ? (
            <span className={`${text.mono} text-xs ${text.muted}`}>{measurement.revisionLabel}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {onSelect && measurement ? (
            <button
              type="button"
              onClick={onSelect}
              className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
            >
              Details
            </button>
          ) : null}
          <Link
            href={`/cases/${caseId}`}
            className={`text-xs ${text.muted} hover:text-foreground hover:underline`}
          >
            Add measurement
          </Link>
        </div>
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
                  className="rounded-full border border-border px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground"
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
