// AGENT PRESENCE (UX-02, replaces UX-01's numeric-first hero): the first
// thing a viewer reads is that Crado is an active participant in this
// investigation, not a dashboard that ran a report. Renders as the
// top-most row inside the workspace (see investigation-workspace.tsx) so
// its status badge can live-update from the same `state` the rest of the
// workspace already tracks, rather than duplicating status logic in the
// server-rendered page.tsx header above it.
//
// The measured failure itself (the actual numbers) lives in
// MeasurementPanel as its own structured artifact further down the canvas
// — this header's job is identity + status + a one-line plain-English
// summary of what's being investigated, matching the ticket's
// "CRADO INVESTIGATION AGENT · ● INVESTIGATING / Radiated emissions ·
// Gateway X · Rev 17 / 200 MHz is 7.4 dB above the selected limit." shape.
// The case reference itself now lives in the quiet top nav (page.tsx), not
// duplicated here. Purely presentational: every value here is a prop from
// data already loaded elsewhere — nothing computed or inferred here beyond
// formatting.
import type { MeasurementRow } from "@/lib/cases/queries";
import type { RunStatus } from "@/lib/investigation/reconstruct";
import { heroStatusStyle, motion, surface, text, type HeroStatusTone } from "./theme";

interface InvestigationHeroProps {
  productName: string;
  revisionLabel: string;
  measurement: MeasurementRow | null;
  status: RunStatus;
  busy: boolean;
}

function heroStatus(
  status: RunStatus,
  busy: boolean,
  hasMeasurement: boolean,
): { label: string; tone: HeroStatusTone } {
  if (!hasMeasurement) return { label: "Waiting for evidence", tone: "waiting" };
  if (busy || status === "running") return { label: "Investigating", tone: "active" };
  if (status === "completed") return { label: "Complete", tone: "complete" };
  if (status === "failed" || status === "interrupted") return { label: "Analysis failed", tone: "failed" };
  return { label: "Ready", tone: "idle" };
}

function failureSummary(peak: MeasurementRow["peaks"][number] | null): string | null {
  if (!peak) return null;
  const direction = peak.marginDb > 0 ? "above" : peak.marginDb < 0 ? "below" : "at";
  const magnitude = Math.abs(peak.marginDb);
  return direction === "at"
    ? `${peak.frequencyMhz} MHz is at the selected limit.`
    : `${peak.frequencyMhz} MHz is ${magnitude} dB ${direction} the selected limit.`;
}

export function InvestigationHero({
  productName,
  revisionLabel,
  measurement,
  status,
  busy,
}: InvestigationHeroProps) {
  const peak = measurement?.peaks[0] ?? null;
  const { label, tone } = heroStatus(status, busy, peak !== null);
  const summary = failureSummary(peak);

  return (
    <div className={`flex flex-col gap-3 p-5 ${motion.rise} ${surface.panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1f9d52]/40 bg-[#1f9d52]/10 text-[11px] font-semibold text-[#177a3f]"
          >
            C
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-[#1c1a15]">
            Crado Investigation Agent
          </span>
        </div>
        <span
          className={`border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${heroStatusStyle[tone]}`}
        >
          {tone === "active" ? (
            <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1f9d52] align-middle" />
          ) : null}
          {label}
        </span>
      </div>

      <p className={`text-sm ${text.muted}`}>
        Radiated emissions
        {productName ? ` · ${productName}` : ""}
        {revisionLabel ? ` · ${revisionLabel}` : ""}
      </p>

      <p className="text-base leading-relaxed text-[#1c1a15]">
        {summary ?? "Crado needs a physical measurement before it can investigate this case."}
      </p>
    </div>
  );
}
