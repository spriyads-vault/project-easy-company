// Pure, testable derivation of the Investigations home's "latest action"
// line — never a fabricated status, always derived from the real,
// computed InvestigationSummary fields (see queries.ts). No case ever
// shows an invented dB figure: marginDeltaDb is only non-null when the
// query itself found ≥2 real measurements to compute a delta from.
import type { InvestigationSummary } from "./queries";

export type InvestigationGroup = "active" | "recent";

export function groupInvestigation(investigation: InvestigationSummary): InvestigationGroup {
  return investigation.status === "open" ? "active" : "recent";
}

export function describeLatestAction(investigation: InvestigationSummary): string {
  if (investigation.latestRunStatus === "running") {
    return "Investigating…";
  }
  if (investigation.marginDeltaDb !== null) {
    const magnitude = Math.abs(investigation.marginDeltaDb);
    if (magnitude === 0) return "No measured change";
    return investigation.marginDeltaDb > 0
      ? `${magnitude} dB measured improvement`
      : `${magnitude} dB measured regression`;
  }
  if (!investigation.latestMeasurement) {
    return "Waiting for a measurement";
  }
  if (investigation.status === "resolved") {
    return "Investigation complete";
  }
  if (investigation.latestRunStatus === "completed") {
    return "Investigation complete";
  }
  if (investigation.latestRunStatus === "failed") {
    return "Last run failed";
  }
  return "Waiting for evidence";
}
