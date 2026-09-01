// INVESTIGATION HYPOTHESIS artifact (UX-03): the signature Crado
// component. Agent-generated — clearly labeled INFERRED, never made to
// look equivalent to the deterministic relationship artifact above it (a
// muted amber accent vs. the deterministic card's neutral one, and the
// evidence grid's own △ INFERRED marker). Evidence is strictly separated
// into OBSERVED / KNOWN / INFERRED / MISSING — a direct rendering of
// FinalHypothesis (MVP-07); the categories are the trust boundary, not a
// styling choice. The model can never populate observed/known (see
// src/lib/hypotheses/schema.ts), so INFERRED is the only place model
// reasoning appears, and it's always labeled as such, never as fact.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
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
  /** UX-03: selects this artifact in the right context rail. Optional so
   * every pre-UX-03 test call site keeps working unmodified. */
  onSelect?: () => void;
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

export function HypothesisCard({ hypothesis, index, onOpenCitation, onSelect }: HypothesisCardProps) {
  const whyThisTest = hypothesis.evidence.find((item) => item.category === "inferred")?.description ?? null;
  const style = artifact.hypothesis;

  return (
    <article className={`flex flex-col gap-4 border-l-2 p-4 ${style.accent} ${motion.rise} ${surface.card}`}>
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
            {onSelect ? (
              <button
                type="button"
                onClick={onSelect}
                className={`text-xs ${text.muted} hover:text-[#1c1a15] ${focusRing}`}
              >
                Details
              </button>
            ) : null}
            <span className="rounded-full border border-[#ddd7c8] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#6b6354]">
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
                          className="inline-flex items-center gap-1 rounded-[7px] border border-[#1f9d52]/40 bg-[#1f9d52]/5 px-1.5 py-0.5 align-middle text-[11px] text-[#177a3f] transition-colors hover:border-[#1f9d52]/70 hover:bg-[#1f9d52]/15 hover:text-[#15703a]"
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

      <div className="flex flex-col gap-3 border-t border-[#efe9db] pt-3">
        <div className={`flex flex-col gap-1 rounded-lg border-l-2 ${artifact.nextTest.accent} bg-[#1f9d52]/[0.03] py-1.5 pl-2.5`}>
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
