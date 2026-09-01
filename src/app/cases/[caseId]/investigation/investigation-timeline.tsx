// The investigation timeline (MVP-11) — "This should become a core Crado
// visual": a compact, chronological chain of what actually happened on this
// case (measurement -> hypothesis -> engineer observation -> updated
// hypothesis), reading top to bottom. Purely presentational — the data
// (src/lib/investigation/timeline.ts) is loaded server-side in page.tsx and
// passed down, so a refresh (or a revalidatePath after recording a result)
// shows the real persisted history without ever re-running the model.
import type { TimelineEntry } from "@/lib/investigation/timeline";
import {
  HYPOTHESIS_UPDATE_LABEL,
  HYPOTHESIS_UPDATE_STYLE,
} from "./describe-hypothesis-update";
import { motion, surface, text } from "./theme";

interface InvestigationTimelineProps {
  entries: TimelineEntry[];
}

function marginLabel(marginDb: number): string {
  return marginDb > 0 ? `+${marginDb} dB` : `${marginDb} dB`;
}

function entryKicker(entry: TimelineEntry): string {
  if (entry.type === "measurement") return "Measurement";
  if (entry.type === "observation") return "Observation";
  if (entry.type === "engineering_change") return "Engineering change";
  if (entry.type === "new_revision") return "New revision";
  if (entry.type === "result") return "Result";
  return entry.update ? "Updated investigation" : "Hypothesis";
}

// A restrained, distinct glyph per step type — plain characters, matching
// the ✓/◌ vocabulary already used for agent activity, never a decorative
// icon library. "result" (the measured outcome) gets its own filled marker
// so the strongest moment in the chain reads as visually distinct at a
// glance, per UX-01 section 7.
function entryGlyph(entry: TimelineEntry): string {
  switch (entry.type) {
    case "measurement":
      return "▮";
    case "hypothesis":
      return "◆";
    case "observation":
      return "●";
    case "engineering_change":
      return "▲";
    case "new_revision":
      return "▮";
    case "result":
      return "★";
  }
}

// Staggers the entrance animation across the first several entries only —
// a long timeline shouldn't force the viewer to wait out a cascading
// reveal to see its bottom.
const RISE_DELAY_CLASSES = [motion.rise, motion.riseDelay1, motion.riseDelay2, motion.riseDelay3];
function riseDelayClass(index: number): string {
  return RISE_DELAY_CLASSES[Math.min(index, RISE_DELAY_CLASSES.length - 1)];
}

export function InvestigationTimeline({ entries }: InvestigationTimelineProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="investigation-timeline-heading"
      className={`flex flex-col gap-3 p-5 ${surface.card}`}
    >
      <h2 id="investigation-timeline-heading" className={text.kicker}>
        Investigation timeline
      </h2>

      <ol className="flex flex-col">
        {entries.map((entry, index) => (
          <li
            key={`${entry.type}-${entry.id}`}
            className={`relative flex flex-col gap-1 py-3 pl-6 ${riseDelayClass(index)} ${
              index < entries.length - 1 ? "border-l border-[#ddd7c8]" : "border-l border-transparent"
            } ${entry.type === "result" ? "-ml-3 border-l-0 bg-[#1f9d52]/[0.04] pl-9 pr-3" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 top-3 -translate-x-1/2 text-xs leading-none ${
                entry.type === "result" ? "text-[#177a3f]" : "text-[#847c6a]"
              }`}
            >
              {entryGlyph(entry)}
            </span>
            <span className={`${text.kicker} text-[10px]`}>{entryKicker(entry)}</span>

            {entry.type === "measurement" ? (
              <p className="text-sm">
                <span className={`text-xs ${text.muted}`}>{entry.revisionLabel} — </span>
                {entry.label ? `${entry.label} — ` : ""}
                <span className={text.mono}>{entry.frequencyMhz} MHz</span>
                {" · "}
                <span className={text.mono}>{marginLabel(entry.marginDb)}</span>
              </p>
            ) : null}

            {entry.type === "hypothesis" ? (
              <div className="flex flex-col gap-1">
                {entry.revisionLabel ? (
                  <span className={`text-xs ${text.muted}`}>{entry.revisionLabel}</span>
                ) : null}
                <p className="text-sm">{entry.title}</p>
                {entry.update ? (
                  <span
                    className={`inline-block w-fit border px-2 py-0.5 text-[10px] uppercase tracking-wide ${HYPOTHESIS_UPDATE_STYLE[entry.update.status]}`}
                  >
                    {HYPOTHESIS_UPDATE_LABEL[entry.update.status]}
                  </span>
                ) : null}
                <p className={`text-xs ${text.muted}`}>→ {entry.recommendedNextStep}</p>
              </div>
            ) : null}

            {entry.type === "observation" ? (
              <p className="text-sm">
                {entry.observation}
                {entry.measurementChange ? ` ${entry.measurementChange}` : ""}
              </p>
            ) : null}

            {entry.type === "engineering_change" ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm">
                  {entry.title}
                  {entry.affectedSubsystem ? (
                    <span className={`ml-2 text-xs ${text.muted}`}>{entry.affectedSubsystem}</span>
                  ) : null}
                </p>
                <p className={`text-xs ${text.muted}`}>
                  {entry.fromRevisionLabel ?? "Unknown revision"} → {entry.toRevisionLabel}
                </p>
              </div>
            ) : null}

            {entry.type === "new_revision" ? (
              <p className="text-sm">
                <span className={text.mono}>{entry.label}</span>
                {entry.supersedesLabel ? (
                  <span className={`text-xs ${text.muted}`}> supersedes {entry.supersedesLabel}</span>
                ) : null}
              </p>
            ) : null}

            {entry.type === "result" ? (
              <p className="text-base font-medium">
                <span className={text.mono}>{entry.comparison.before.revisionLabel}</span>
                {" → "}
                <span className={text.mono}>{entry.comparison.after.revisionLabel}</span>
                {": "}
                <span className={entry.comparison.improved ? "text-[#177a3f]" : "text-[#a15a17]"}>
                  {entry.comparison.deltaDb === 0
                    ? "no change"
                    : `${entry.comparison.improved ? "improved" : "worsened"} by ${Math.abs(entry.comparison.deltaDb).toFixed(1)} dB`}
                </span>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
