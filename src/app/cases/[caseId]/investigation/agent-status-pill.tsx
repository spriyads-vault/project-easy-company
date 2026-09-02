// AGENT PRESENCE (UX-03): the status half of what UX-02's InvestigationHero
// used to render as its own boxed row now lives here, as a small pill
// inside the top bar — "agent status should integrate into the workspace…
// no giant boxed agent header." The one-line failure sentence
// ("200 MHz is 7.4 dB above the selected limit.") moved to the canvas
// itself, as the unboxed line introducing the Measurement artifact (see
// investigation-canvas.tsx) — this component is identity + status only.
import type { RunStatus } from "@/lib/investigation/reconstruct";
import { heroStatusStyle, type HeroStatusTone } from "./theme";

interface AgentStatusPillProps {
  status: RunStatus;
  busy: boolean;
  hasMeasurement: boolean;
}

function resolveStatus(
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

export function AgentStatusPill({ status, busy, hasMeasurement }: AgentStatusPillProps) {
  const { label, tone } = resolveStatus(status, busy, hasMeasurement);

  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide sm:inline-flex ${heroStatusStyle[tone]}`}
    >
      {tone === "active" ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />
      ) : null}
      Crado · {label}
    </span>
  );
}
