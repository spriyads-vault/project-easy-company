// The signature Crado component: a ranked investigation hypothesis with
// its evidence strictly separated into OBSERVED / KNOWN / INFERRED /
// MISSING. This is a direct rendering of FinalHypothesis (MVP-07) — the
// evidence array's categories are the trust boundary, not a styling
// choice; the model can never populate observed/known (see
// src/lib/hypotheses/schema.ts), so INFERRED is the only place model
// reasoning appears, and it's always labeled as such, never as fact.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { HYPOTHESIS_UPDATE_LABEL, HYPOTHESIS_UPDATE_STYLE } from "./describe-hypothesis-update";
import { evidence, motion, surface, text } from "./theme";

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

export function HypothesisCard({ hypothesis, index, onOpenCitation }: HypothesisCardProps) {
  const whyThisTest = hypothesis.evidence.find((item) => item.category === "inferred")?.description ?? null;

  return (
    <article className={`flex flex-col gap-4 p-4 ${motion.rise} ${surface.panelElevated}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className={`${text.kicker} text-[10px] text-[#847c6a]`}>
            Hypothesis {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-base font-medium leading-snug">{hypothesis.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="border border-[#ddd7c8] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#6b6354]">
            {CONFIDENCE_LABEL[hypothesis.confidenceBand]}
          </span>
          {hypothesis.update ? (
            <span
              className={`border px-2 py-0.5 text-[10px] uppercase tracking-wide ${HYPOTHESIS_UPDATE_STYLE[hypothesis.update.status]}`}
              title={`Continues: ${hypothesis.update.previousHypothesisTitle}`}
            >
              {HYPOTHESIS_UPDATE_LABEL[hypothesis.update.status]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EVIDENCE_SECTIONS.map((section) => {
          const items = hypothesis.evidence.filter(
            (item) => item.category === section.category,
          );
          if (items.length === 0) return null;
          const style = evidence[section.category];
          return (
            <div
              key={section.category}
              className={`flex flex-col gap-1.5 border-l-2 pl-2.5 ${style.borderColor}`}
            >
              <span className={text.kicker}>
                <span aria-hidden="true" className={`mr-1.5 ${style.glyphColor}`}>
                  {style.glyph}
                </span>
                {section.heading}
              </span>
              <ul className="flex flex-col gap-1">
                {items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className={
                      section.category === "inferred"
                        ? "text-sm italic text-[#6b6354]"
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
                          onClick={() =>
                            onOpenCitation(item.citation!, item.category, index, hypothesis.title)
                          }
                          className="inline-flex items-center gap-1 border border-[#1f9d52]/40 bg-[#1f9d52]/5 px-1.5 py-0.5 align-middle text-[11px] text-[#177a3f] transition-colors hover:border-[#1f9d52]/70 hover:bg-[#1f9d52]/15 hover:text-[#15703a]"
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

      <div className="flex flex-col gap-3 border-t border-[#e7e2d6] pt-3">
        <div className="flex flex-col gap-1">
          <span className={text.kicker}>Next investigation</span>
          <p className="text-sm">{hypothesis.recommendedNextStep}</p>
        </div>
        {whyThisTest ? (
          <div className="flex flex-col gap-1">
            <span className={`${text.kicker} text-[10px] text-[#847c6a]`}>Why this test</span>
            <p className={`text-xs italic ${text.muted}`}>{whyThisTest}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
