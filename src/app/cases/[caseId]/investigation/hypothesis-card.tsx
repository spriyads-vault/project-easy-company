// INVESTIGATION HYPOTHESIS artifact (UX-03, promoted to the Decision
// view's reasoning object in UX-07, restyled by the UX-07 correction):
// agent-generated, clearly labeled INFERRED, never made to look
// equivalent to the deterministic relationship artifact beside it. The
// only structural distinction between the two cards is the outer card's
// own 2px accent bar (see `artifact.hypothesis.accent`) — everything
// inside is plain, uniform, record-style typography: no per-section
// glyph, no colored left border per evidence category, no confidence/
// strength pill. Evidence is strictly separated into OBSERVED / KNOWN /
// INFERRED / MISSING — a direct rendering of FinalHypothesis (MVP-07);
// the categories are the trust boundary, not a styling choice. The
// model can never populate observed/known (see
// src/lib/hypotheses/schema.ts), so INFERRED is the only place model
// reasoning appears, and it's always labeled as such, never as fact.
//
// UX-07 correction (rejected-on-review pass): three content-assembly
// bugs fixed here, not evidence-model changes —
//   1. "Why this test" removed entirely: it always just reprinted the
//      INFERRED paragraph verbatim, which read as the same sentence
//      printed twice on screen. The INFERRED section already says it.
//   2. The recommended next test no longer renders inside this card at
//      all: it duplicated next-action-bar.tsx's own pinned copy of the
//      exact same string. The pinned bar is the single home for the
//      recommended action.
//   3. Confidence/strength/update-status are no longer pill badges —
//      folded into the eyebrow line as plain uppercase text. A pill
//      implies a precision the confidence band does not have.
// "State" (this hypothesis's real leading/plausible/weakened/unresolved
// rank) still lives on the object per UX-07's own Condition C — now as
// plain eyebrow text rather than a badge.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { HYPOTHESIS_STRENGTH_LABEL, type HypothesisStrength } from "@/lib/investigation/rank-hypotheses";
import { HYPOTHESIS_UPDATE_LABEL } from "./describe-hypothesis-update";
import { ClampedText } from "./clamped-text";
import { artifact, focusRing, motion, surface } from "./theme";
import { bodyText, cardTitle, sectionLabel } from "./reasoning-typography";

interface HypothesisCardProps {
  hypothesis: HypothesisCreatedPayload;
  /** Zero-based position among this run's hypotheses — used only for the
   * "Hypothesis 01" label and the source drawer's "Used in" line. */
  index: number;
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  /** UX-03: selects this artifact in the right context rail — makes the
   * whole card a click/keyboard target (UX-07; previously a small
   * "Details" link). Optional so every pre-UX-03 test call site keeps
   * rendering a plain, non-interactive card exactly as before. */
  onSelect?: () => void;
  isSelected?: boolean;
  /** UX-07: this hypothesis's real rank among this run's other
   * hypotheses (rankHypotheses' own output) — the caller computes this
   * once for the whole set, never re-derived per card. Optional/undefined
   * omits the State field entirely (e.g. this component's own tests,
   * which render a single hypothesis with nothing to rank it against). */
  strength?: HypothesisStrength;
}

const CONFIDENCE_LABEL: Record<HypothesisCreatedPayload["confidenceBand"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

const EVIDENCE_SECTIONS: { category: EvidenceCategory; heading: string }[] = [
  { category: "observed", heading: "Observed" },
  { category: "known", heading: "Known" },
  { category: "inferred", heading: "Inferred" },
  { category: "missing", heading: "Missing" },
];

export function HypothesisCard({
  hypothesis,
  index,
  onOpenCitation,
  onSelect,
  isSelected = false,
  strength,
}: HypothesisCardProps) {
  const style = artifact.hypothesis;

  // UX-07 correction: one plain-text eyebrow line, not a row of pills —
  // "Hypothesis 01 · Inferred · Leading · Medium confidence · Unchanged".
  // Each piece stays its own element so existing/targeted test queries
  // (getByText("Hypothesis 03"), etc.) keep working unchanged. The
  // artifact-kind label (`style.label`, "Inferred") is deliberately
  // combined with its leading separator into one span rather than
  // isolated on its own — isolated, its text would be byte-identical to
  // the evidence section's own "Inferred" <dt> below and the two would
  // become ambiguous to any query (including a real screen reader user
  // navigating by text search), even though they mean different things.
  const header = (
    <div className={`flex flex-wrap items-baseline gap-x-1 ${sectionLabel}`}>
      <span>Hypothesis {String(index + 1).padStart(2, "0")}</span>
      <span>{`· ${style.label}`}</span>
      {strength ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{HYPOTHESIS_STRENGTH_LABEL[strength]}</span>
        </>
      ) : null}
      <span aria-hidden="true">·</span>
      <span>{CONFIDENCE_LABEL[hypothesis.confidenceBand]}</span>
      {hypothesis.update ? (
        <>
          <span aria-hidden="true">·</span>
          <span title={`Continues: ${hypothesis.update.previousHypothesisTitle}`}>
            {HYPOTHESIS_UPDATE_LABEL[hypothesis.update.status]}
          </span>
        </>
      ) : null}
    </div>
  );

  const body = (
    <>
      <div className="flex shrink-0 flex-col gap-1.5">
        {header}
        <h3 className={cardTitle}>{hypothesis.title}</h3>
      </div>

      {/* UX-07 correction: the card's own max-height (320px at 1440px) is
          enforced on the outer container below; this section absorbs
          whatever's left and scrolls internally rather than growing the
          card or clipping a value with no way to reach the rest of it —
          each individual value already clamps to 1-2 lines by default
          (ClampedText), this is only a backstop for a hypothesis with
          many evidence items in total. */}
      <dl className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {EVIDENCE_SECTIONS.map((section) => {
          const items = hypothesis.evidence.filter((item) => item.category === section.category);
          if (items.length === 0) return null;
          return (
            <div key={section.category} className="grid grid-cols-[96px_1fr] items-start gap-x-3 gap-y-2">
              <dt className={sectionLabel}>{section.heading}</dt>
              {items.map((item, itemIndex) => (
                <dd key={itemIndex} className={`col-start-2 ${bodyText} ${section.category === "missing" ? "text-muted-foreground" : ""}`}>
                  <ClampedText text={item.description} lines={section.category === "missing" ? 1 : 2} />
                  {item.citation ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        // UX-07: the card itself may now be a click target
                        // (onSelect, when used as a reasoning object) —
                        // stop this nested click from also bubbling up and
                        // overwriting the rail's source selection with a
                        // plain hypothesis selection right after it's set.
                        event.stopPropagation();
                        onOpenCitation(item.citation!, item.category, index, hypothesis.title);
                      }}
                      className="text-[11px] text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    >
                      {item.citation.filename}
                      {item.citation.section
                        ? ` · ${item.citation.section}`
                        : item.citation.pageNumber
                          ? ` · p.${item.citation.pageNumber}`
                          : ""}
                    </button>
                  ) : null}
                </dd>
              ))}
            </div>
          );
        })}
      </dl>
    </>
  );

  // UX-07 correction: max default height 320px at 1440px — the header/
  // title always stay visible (shrink-0 above); the evidence list below
  // absorbs the rest and scrolls internally if real content is long
  // enough to need it. The card never grows past this to accommodate
  // more content.
  const containerClass = `flex max-h-[320px] flex-col gap-3 border-l-2 p-4 ${style.accent} ${motion.rise} ${surface.card} ${
    isSelected ? "ring-1 ring-primary/50" : ""
  }`;

  if (!onSelect) {
    return <article className={containerClass}>{body}</article>;
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        // Only the card's own background/border area should trigger
        // selection on Enter/Space — a click that already landed on a
        // nested interactive element (a citation button, a "Show more"
        // toggle) fires that element's own handler and should not also
        // re-trigger this one.
        if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer text-left ${containerClass} ${focusRing}`}
    >
      {body}
    </article>
  );
}
