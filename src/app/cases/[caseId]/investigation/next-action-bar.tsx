// PINNED NEXT-ACTION BAR (App Redesign, Workstream C correction):
// replaces decision-view.tsx's large bordered "Recommended next test"
// card. A compact bar pinned to the bottom of the Decision workbench —
// stays visible while the item table above it scrolls, per the ticket's
// "must remain visible while the item table scrolls." Everything shown
// is the leading hypothesis's own real recommendedNextStep/title, never
// a synthesized field the domain doesn't produce. Also hosts the
// "Record engineering change" entry point, relocated here from being a
// detached button above the result content (investigation-controls.tsx,
// pre-correction) — the ticket's own suggested new home: "Expose
// engineering-change entry from the current decision action... bar."
import type { RankedHypothesis } from "@/lib/investigation/rank-hypotheses";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { focusRing, radius, text } from "./theme";

interface NextActionBarProps {
  caseId: string;
  productId: string;
  revisionId: string;
  currentRevisionLabel: string;
  leading: RankedHypothesis | null;
  /** Only offered once there's at least one hypothesis to follow up on —
   * same gate investigation-controls.tsx used to apply before this moved
   * here. */
  showEngineeringChange: boolean;
  onRecordResult: () => void;
}

export function NextActionBar({
  caseId,
  productId,
  revisionId,
  currentRevisionLabel,
  leading,
  showEngineeringChange,
  onRecordResult,
}: NextActionBarProps) {
  if (!leading && !showEngineeringChange) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border bg-card px-4 py-2.5">
      {leading ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden="true" className="h-6 w-0.5 shrink-0 rounded-full bg-primary" />
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recommended next test
            </span>
            <p className="truncate text-sm text-foreground">{leading.hypothesis.recommendedNextStep}</p>
            <p className={`truncate text-xs ${text.muted}`}>
              Would confirm or rule out: {leading.hypothesis.title}
            </p>
          </div>
        </div>
      ) : (
        <span aria-hidden="true" className="flex-1" />
      )}
      <div className="flex shrink-0 items-center gap-2">
        {showEngineeringChange ? (
          <RecordEngineeringChangeForm
            caseId={caseId}
            productId={productId}
            fromRevisionId={revisionId}
            currentRevisionLabel={currentRevisionLabel}
          />
        ) : null}
        {leading ? (
          <button
            type="button"
            onClick={onRecordResult}
            className={`${radius.control} shrink-0 border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 ${focusRing}`}
          >
            Record result
          </button>
        ) : null}
      </div>
    </div>
  );
}
