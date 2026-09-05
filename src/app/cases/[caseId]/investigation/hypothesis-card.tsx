// INVESTIGATION HYPOTHESIS artifact (UX-03, promoted to the Decision
// view's reasoning object in UX-07): the signature Crado component.
// Agent-generated — clearly labeled INFERRED, never made to look
// equivalent to the deterministic relationship artifact beside it (a
// muted amber accent vs. the deterministic card's neutral one, and the
// evidence grid's own △ INFERRED marker). Evidence is strictly separated
// into OBSERVED / KNOWN / INFERRED / MISSING — a direct rendering of
// FinalHypothesis (MVP-07); the categories are the trust boundary, not a
// styling choice. The model can never populate observed/known (see
// src/lib/hypotheses/schema.ts), so INFERRED is the only place model
// reasoning appears, and it's always labeled as such, never as fact.
//
// UX-07: carries its own "State" — the deterministic
// leading/plausible/weakened/unresolved ranking label from
// rank-hypotheses.ts — directly on the object, replacing the retired
// InvestigationItemTable's "State" column (see decision-view.tsx and
// docs/PROGRESS.md's UX-07 entry). This is a UI-derived label over
// already-real confidenceBand/update.status fields, not a new
// engineering calculation — same distinction rank-hypotheses.ts's own
// header comment already makes.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { HYPOTHESIS_STRENGTH_LABEL, type HypothesisStrength } from "@/lib/investigation/rank-hypotheses";
import { HYPOTHESIS_UPDATE_LABEL, HYPOTHESIS_UPDATE_STYLE } from "./describe-hypothesis-update";
import { artifact, evidence, focusRing, motion, surface, text } from "./theme";

interface HypothesisCardProps {
  hypothesis: HypothesisCreatedPayload;
  /** Zero-based position among this run's hypotheses — used only for the
   * "HYPOTHESIS 01" label and the source drawer's "Used in" line. */
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

const EVIDENCE_SECTIONS: {
  category: EvidenceCategory;
  heading: string;
  hint: string;
}[] = [
  { category: "observed", heading: "Observed", hint: "Directly measured." },
  { category: "known", heading: "Known", hint: "Recorded product context." },
  { category: "inferred", heading: "Inferred", hint: "A candidate reading, not a fact." },
  { category: "missing", heading: "Missing", hint: "Needed to support or rule this out." },
];

export function HypothesisCard({
  hypothesis,
  index,
  onOpenCitation,
  onSelect,
  isSelected = false,
  strength,
}: HypothesisCardProps) {
  const whyThisTest = hypothesis.evidence.find((item) => item.category === "inferred")?.description ?? null;
  const style = artifact.hypothesis;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <span className={`${text.kicker} text-[10px] ${evidence.inferred.glyphColor}`}>
          <span aria-hidden="true">{evidence.inferred.glyph}</span>{" "}
          <span>Hypothesis {String(index + 1).padStart(2, "0")}</span>
          {" · "}
          {style.label}
        </span>
        <h3 className="text-base font-medium leading-snug">{hypothesis.title}</h3>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {strength ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {HYPOTHESIS_STRENGTH_LABEL[strength]}
            </span>
          ) : null}
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {CONFIDENCE_LABEL[hypothesis.confidenceBand]}
          </span>
        </div>
        {hypothesis.update ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${HYPOTHESIS_UPDATE_STYLE[hypothesis.update.status]}`}
            title={`Continues: ${hypothesis.update.previousHypothesisTitle}`}
          >
            {HYPOTHESIS_UPDATE_LABEL[hypothesis.update.status]}
          </span>
        ) : null}
      </div>
    </div>
  );

  const body = (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2">
        {EVIDENCE_SECTIONS.map((section) => {
          const items = hypothesis.evidence.filter(
            (item) => item.category === section.category,
          );
          if (items.length === 0) return null;
          const sectionStyle = evidence[section.category];
          return (
            <div
              key={section.category}
              className={`flex flex-col gap-1.5 border-l-2 pl-2.5 ${sectionStyle.borderColor} ${sectionStyle.dashed ? "border-dashed" : ""}`}
            >
              <span className={text.kicker}>
                <span aria-hidden="true" className={`mr-1.5 ${sectionStyle.glyphColor}`}>
                  {sectionStyle.glyph}
                </span>
                {section.heading}
              </span>
              <ul className="flex flex-col gap-1">
                {items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className={
                      section.category === "inferred"
                        ? "text-sm italic text-muted-foreground"
                        : section.category === "missing"
                          ? `text-sm ${text.muted}`
                          : "text-sm"
                    }
                  >
                    {item.description}
                    {item.citation ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={(event) => {
                            // UX-07: the card itself may now be a click
                            // target (onSelect, when the card is used as a
                            // reasoning object) — stop this nested click
                            // from also bubbling up and overwriting the
                            // rail's source selection with a plain
                            // hypothesis selection right after it's set.
                            event.stopPropagation();
                            onOpenCitation(item.citation!, item.category, index, hypothesis.title);
                          }}
                          className="inline-flex items-center gap-1 rounded-[7px] border border-primary/40 bg-primary/5 px-1.5 py-0.5 align-middle text-[11px] text-primary transition-colors hover:border-primary/70 hover:bg-primary/15"
                        >
                          <span aria-hidden="true">⌗</span>
                          {item.citation.filename}
                          {item.citation.section ? ` · ${item.citation.section}` : item.citation.pageNumber ? ` · p.${item.citation.pageNumber}` : ""}
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <div className={`flex flex-col gap-1 rounded-lg border-l-2 ${artifact.nextTest.accent} bg-primary/[0.03] py-1.5 pl-2.5`}>
          <span className={text.kicker}>Next investigation</span>
          <p className="text-sm">{hypothesis.recommendedNextStep}</p>
        </div>
        {whyThisTest ? (
          <div className="flex flex-col gap-1">
            <span className={`${text.kicker} text-[10px] text-muted-foreground`}>Why this test</span>
            <p className={`text-xs italic ${text.muted}`}>{whyThisTest}</p>
          </div>
        ) : null}
      </div>
    </>
  );

  const containerClass = `flex flex-col gap-4 border-l-2 p-4 ${style.accent} ${motion.rise} ${surface.card} ${
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
        // nested interactive element (a citation button) fires that
        // element's own handler and should not also re-trigger this one.
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
