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
//
// UX-07 correction: the recommendation used to render as a text-xl/2xl
// headline — big enough that it (and the button row beside it) clipped
// at some breakpoints. It's an instruction, not a headline: capped at
// 14px per the correction ticket's fixed type scale, which removes the
// size pressure that caused the clipping in the first place. The two
// actions below are now one primary style / one secondary style, both
// sentence case (see reasoning-typography.ts's buttonBase comment for
// why the previous pair looked like two different button systems).
import type { RankedHypothesis } from "@/lib/investigation/rank-hypotheses";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import { focusRing, motion, surface } from "./theme";
import { bodyText, nextTestText, primaryButton, sectionLabel } from "./reasoning-typography";

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
    <div className={`mx-4 flex min-w-0 flex-col gap-4 border-l-2 border-l-primary p-5 ${motion.rise} ${surface.card}`}>
      {leading ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className={sectionLabel}>Recommended next test</span>
          <p className={`min-w-0 break-words text-foreground ${nextTestText}`}>
            {leading.hypothesis.recommendedNextStep}
          </p>
          <p className={`min-w-0 break-words ${bodyText} text-muted-foreground`}>
            Would confirm or rule out: {leading.hypothesis.title}
          </p>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {leading ? (
          <button type="button" onClick={onRecordResult} className={`${primaryButton} ${focusRing}`}>
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
