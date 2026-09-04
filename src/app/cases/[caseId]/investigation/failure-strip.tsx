// FAILURE HEADER STRIP (App Redesign, Workstream C correction): replaces
// measurement-panel.tsx's large rounded card in the Decision workbench —
// a compact ~96px row of real stored measurement fields plus a small
// fixed-size spectrum plot, not a card with a lot of empty space around
// one number. Every value here is exactly what's in Postgres for this
// case's current measurement (see MeasurementRow) — nothing derived from
// the analysis run, and nothing shown here is invented (no fabricated
// "selected limit" absolute dB value the schema doesn't store; "Limit"
// shows the real limit-line name, same field measurement-panel.tsx used).
import Link from "next/link";
import type { MeasurementRow } from "@/lib/cases/queries";
import { SpectrumChart } from "./spectrum-chart";
import { focusRing, text } from "./theme";

interface FailureStripProps {
  caseId: string;
  measurement: MeasurementRow | null;
  onSelect?: () => void;
}

function StatCell({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  tone?: "warning" | "success";
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 border-r border-border px-4 py-2 first:pl-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`truncate text-sm font-medium ${mono ? text.mono : ""} ${
          tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
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

  return (
    <div className="flex items-stretch justify-between gap-4 border-b border-border px-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-stretch">
        <StatCell label="Peak frequency" value={`${peak.frequencyMhz} MHz`} mono />
        <StatCell
          label="Margin"
          value={`${peak.marginDb > 0 ? "+" : ""}${peak.marginDb} dB`}
          mono
          tone={peak.marginDb > 0 ? "warning" : "success"}
        />
        {peak.limitLine ? <StatCell label="Limit" value={peak.limitLine} mono /> : null}
        {measurement.operatingMode ? <StatCell label="Operating mode" value={measurement.operatingMode} /> : null}
        <StatCell label="Revision" value={measurement.revisionLabel} mono />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <SpectrumChart frequencyMhz={peak.frequencyMhz} marginDb={peak.marginDb} className="h-12 w-36" />
        <div className="flex flex-col items-end gap-1 self-center">
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
            >
              Details
            </button>
          ) : null}
          <Link href={`/cases/${caseId}`} className={`text-xs ${text.muted} hover:text-foreground hover:underline`}>
            Add measurement
          </Link>
        </div>
      </div>
    </div>
  );
}
