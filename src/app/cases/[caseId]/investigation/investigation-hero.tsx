// UX-01 (section 2): the investigation header — the first thing a demo
// viewer reads. Renders as the top-most row inside the workspace grid (see
// investigation-workspace.tsx) so its STATUS badge can live-update from the
// same `state` the rest of the workspace already tracks, rather than
// duplicating status logic in the server-rendered page.tsx header above it.
// Purely presentational: every value here is a prop from data already
// loaded elsewhere (measurement, product/revision labels, run status) —
// nothing computed or inferred here.
import type { MeasurementRow } from "@/lib/cases/queries";
import type { RunStatus } from "@/lib/investigation/reconstruct";
import { accent, heroStatusStyle, motion, surface, text, type HeroStatusTone } from "./theme";

interface InvestigationHeroProps {
  caseId: string;
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
  if (status === "completed") return { label: "Investigation complete", tone: "complete" };
  if (status === "failed" || status === "interrupted") return { label: "Analysis failed", tone: "failed" };
  return { label: "Ready to investigate", tone: "idle" };
}

export function InvestigationHero({
  caseId,
  productName,
  revisionLabel,
  measurement,
  status,
  busy,
}: InvestigationHeroProps) {
  const peak = measurement?.peaks[0] ?? null;
  const { label, tone } = heroStatus(status, busy, peak !== null);
  // Presentational shorthand only — derived from the real case id, not a
  // separate stored case-numbering capability (out of UX-01 scope).
  const caseRef = `CASE-${caseId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

  return (
    <div className={`flex flex-col gap-4 p-5 ${motion.rise} ${surface.panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {productName ? (
            <span className="text-sm font-medium uppercase tracking-wide text-[#f3f1e8]">
              {productName}
            </span>
          ) : null}
          {revisionLabel ? (
            <span className={`text-sm ${text.mono} ${text.muted}`}>{revisionLabel}</span>
          ) : null}
          <span className={`text-xs ${text.mono} text-[#6f6d65]`}>{caseRef}</span>
          <span className="border border-[#3a3d34] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#c8c6bb]">
            Radiated emissions
          </span>
        </div>
        <span
          className={`border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${heroStatusStyle[tone]}`}
        >
          {tone === "active" ? (
            <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#3ecf6e] align-middle" />
          ) : null}
          {label}
        </span>
      </div>

      {peak ? (
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-semibold sm:text-5xl ${text.mono}`}>
            {peak.frequencyMhz} <span className="text-xl font-normal sm:text-2xl">MHz</span>
          </span>
          <span
            className={`text-lg font-medium ${text.mono} ${peak.marginDb > 0 ? accent.warnText : accent.greenText}`}
          >
            {peak.marginDb > 0 ? "+" : ""}
            {peak.marginDb} dB{" "}
            {peak.marginDb > 0 ? "above" : peak.marginDb < 0 ? "below" : "at"} selected limit
          </span>
        </div>
      ) : (
        <p className={`text-sm ${text.muted}`}>
          Crado needs a physical measurement before it can investigate this case.
        </p>
      )}
    </div>
  );
}
