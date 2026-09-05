// FAILURE SUMMARY (UX-07, answer-first Decision layout): one prose
// sentence, not a stat grid — "200 MHz measured 7.4 dB above the
// selected limit, with Wi-Fi and display active." plus a second line
// carrying test type, revision, and when it was measured. Every value
// here is exactly what's in Postgres for this case's current measurement
// (see MeasurementRow) — nothing derived from the analysis run, nothing
// invented (no fabricated absolute-dB "selected limit" value the schema
// doesn't store; the limit line shown is the real stored name).
//
// UX-07 removed the spectrum plot that used to live here: only a single
// peak and a limit-line name are stored — there is no real trace to
// draw, and at a legible size the plot would occupy prime space to
// restate two numbers this sentence already gives. The same
// SpectrumChart component now renders, full size, inside the Inspector's
// measurement detail (context-rail.tsx) instead — the one place a reader
// asked to see it, not the one every page load shows an illegible
// thumbnail of it.
import Link from "next/link";
import type { MeasurementRow } from "@/lib/cases/queries";
import { focusRing, text } from "./theme";

interface FailureStripProps {
  caseId: string;
  measurement: MeasurementRow | null;
  onSelect?: () => void;
}

function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function FailureStrip({ caseId, measurement, onSelect }: FailureStripProps) {
  const peak = measurement?.peaks[0] ?? null;

  if (!measurement || !peak) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
        <p className={`text-sm ${text.muted}`}>No measurement recorded for this case yet.</p>
        <Link href={`/cases/${caseId}`} className={`text-xs ${text.muted} hover:text-foreground hover:underline`}>
          Add measurement
        </Link>
      </div>
    );
  }

  const marginPhrase =
    peak.marginDb > 0
      ? `${peak.marginDb} dB above the selected limit`
      : peak.marginDb < 0
        ? `${Math.abs(peak.marginDb)} dB below the selected limit`
        : "at the selected limit";

  return (
    <div className="flex flex-col gap-1 border-b border-border px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base leading-snug text-foreground">
          <span className={`${text.mono} font-semibold`}>{peak.frequencyMhz} MHz</span> measured {marginPhrase}
          {measurement.operatingMode ? `, with ${measurement.operatingMode.toLowerCase()}` : ""}.
        </p>
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className={`shrink-0 text-xs ${text.muted} hover:text-foreground ${focusRing}`}
          >
            Details
          </button>
        ) : null}
      </div>
      <p className={`text-xs ${text.muted}`}>
        Radiated emissions · {measurement.revisionLabel}
        {peak.limitLine ? ` · ${peak.limitLine}` : ""} · measured {formatMeasuredAt(measurement.createdAt)}
        {" · "}
        <Link href={`/cases/${caseId}`} className="hover:text-foreground hover:underline">
          Add measurement
        </Link>
      </p>
    </div>
  );
}
