// RUN INVESTIGATION BUTTON (App Redesign, Workstream C correction):
// extracted from investigation-controls.tsx's inline button so the case
// header (top-bar.tsx, via investigation-workspace.tsx's rightSlot) can
// host Run/Run again/Re-evaluate directly, per the ticket's "Move Run,
// Run again, Resume and case-level overflow actions into this header."
// Same button, same label/disabled logic as before — relocated, not
// rebuilt.
import type { RunStatus } from "@/lib/investigation/reconstruct";
import { radius } from "./theme";

interface RunInvestigationButtonProps {
  status: RunStatus;
  busy: boolean;
  hasMultipleRevisions: boolean;
  canRunAnalysis: boolean;
  disabledReason: string | null;
  onRunInvestigation: () => void;
}

function buttonLabel(status: RunStatus, busy: boolean, hasMultipleRevisions: boolean): string {
  if (busy) return "Analyzing…";
  if (status === "idle") return "Run investigation";
  return hasMultipleRevisions ? "Re-evaluate" : "Run again";
}

export function RunInvestigationButton({
  status,
  busy,
  hasMultipleRevisions,
  canRunAnalysis,
  disabledReason,
  onRunInvestigation,
}: RunInvestigationButtonProps) {
  return (
    <button
      type="button"
      onClick={onRunInvestigation}
      disabled={!canRunAnalysis || busy}
      title={disabledReason ?? undefined}
      className={`${radius.control} shrink-0 border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground`}
    >
      {buttonLabel(status, busy, hasMultipleRevisions)}
    </button>
  );
}
