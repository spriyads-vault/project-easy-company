// RECOMMENDED NEXT TEST (UX-07: promoted to the largest, most prominent
// block on the Decision page — position 3 of the required top-to-bottom
// layout, ahead of the reasoning objects). Previously a compact bar
// pinned to the bottom of the Decision workbench with a single-line
// truncated recommendation (App Redesign, Workstream C correction) — the
// ticket's own reported defect: "the recommended next test sits at the
// bottom of the page in the smallest text and truncates mid-sentence...
// the single most decision-relevant item [with] the weakest position."
// Full text now, wrapping to as many lines as needed, never truncated,
// never behind a scroll on a completed case at 1440px (acceptance
// criterion 1). Everything shown is the leading hypothesis's own real
// recommendedNextStep/title, never a synthesized field the domain
// doesn't produce. Also hosts the "Record engineering change" entry
// point — unchanged from where it already lived.
import type { RankedHypothesis } from "@/lib/investigation/rank-hypotheses";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { focusRing, motion, radius, surface, text } from "./theme";

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
    <div className={`mx-4 flex flex-col gap-4 border-l-2 border-l-primary p-5 ${motion.rise} ${surface.card}`}>
      {leading ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recommended next test
          </span>
          <p className="text-xl font-medium leading-snug text-foreground sm:text-2xl">
            {leading.hypothesis.recommendedNextStep}
          </p>
          <p className={`text-sm ${text.muted}`}>Would confirm or rule out: {leading.hypothesis.title}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {leading ? (
          <button
            type="button"
            onClick={onRecordResult}
            className={`${radius.control} border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 ${focusRing}`}
          >
            Record result
          </button>
        ) : null}
        {showEngineeringChange ? (
          <RecordEngineeringChangeForm
            caseId={caseId}
            productId={productId}
            fromRevisionId={revisionId}
            currentRevisionLabel={currentRevisionLabel}
          />
        ) : null}
      </div>
    </div>
  );
}
