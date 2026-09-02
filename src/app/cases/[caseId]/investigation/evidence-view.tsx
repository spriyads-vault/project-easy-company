// EVIDENCE VIEW (UX-03): OBSERVED/KNOWN/INFERRED/MISSING as the central
// information architecture — "avoid four generic rectangular cards; use
// compact inline evidence markers." Same trust boundary hypothesis-card.tsx
// enforces per hypothesis (the model can never populate observed/known,
// see src/lib/hypotheses/schema.ts), aggregated across every hypothesis
// this run produced and grouped by category instead of by hypothesis, so
// every claim reads as inspectable at a glance. Every item still names
// which hypothesis it came from and, when document-backed, still opens the
// exact same source drawer.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { evidence, focusRing, text } from "./theme";

interface EvidenceViewProps {
  hypotheses: readonly HypothesisCreatedPayload[];
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
}

const SECTIONS: { category: EvidenceCategory; heading: string; hint: string }[] = [
  { category: "observed", heading: "Observed", hint: "Directly measured." },
  { category: "known", heading: "Known", hint: "Recorded product context." },
  { category: "inferred", heading: "Inferred", hint: "A candidate reading, not a fact." },
  { category: "missing", heading: "Missing", hint: "Needed to support or rule this out." },
];

export function EvidenceView({ hypotheses, onOpenCitation }: EvidenceViewProps) {
  if (hypotheses.length === 0) {
    return (
      <p className={`p-5 text-sm ${text.muted}`}>
        No evidence yet — run an investigation to see it collected here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      {SECTIONS.map((section) => {
        const items = hypotheses.flatMap((hypothesis, hypothesisIndex) =>
          hypothesis.evidence
            .filter((item) => item.category === section.category)
            .map((item) => ({ item, hypothesis, hypothesisIndex })),
        );
        if (items.length === 0) return null;
        const style = evidence[section.category];

        return (
          <section key={section.category} aria-labelledby={`evidence-${section.category}-heading`} className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2">
              <span aria-hidden="true" className={style.glyphColor}>
                {style.glyph}
              </span>
              <h3 id={`evidence-${section.category}-heading`} className={text.kicker}>
                {section.heading}
              </h3>
              <span className={`text-xs ${text.muted}`}>{section.hint}</span>
            </div>
            <ul className="flex flex-col divide-y divide-[#ececee]">
              {items.map(({ item, hypothesis, hypothesisIndex }, itemIndex) => (
                <li
                  key={itemIndex}
                  className={`flex items-start gap-2.5 border-l-2 py-2 pl-3 ${style.borderColor} ${style.dashed ? "border-dashed" : ""}`}
                >
                  <p
                    className={
                      section.category === "inferred"
                        ? "text-sm italic"
                        : section.category === "missing"
                          ? `text-sm ${text.muted}`
                          : "text-sm"
                    }
                  >
                    {item.description}
                    <span className={`ml-2 text-xs ${text.muted}`}>— {hypothesis.title}</span>
                    {item.citation ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() =>
                            onOpenCitation(item.citation!, item.category, hypothesisIndex, hypothesis.title)
                          }
                          className={`inline-flex items-center gap-1 rounded-[7px] border border-[#1f9d52]/40 bg-[#1f9d52]/5 px-1.5 py-0.5 align-middle text-[11px] text-[#15803d] transition-colors hover:border-[#1f9d52]/70 hover:bg-[#1f9d52]/15 ${focusRing}`}
                        >
                          <span aria-hidden="true">⌗</span>
                          {item.citation.filename}
                          {item.citation.section
                            ? ` · ${item.citation.section}`
                            : item.citation.pageNumber
                              ? ` · p.${item.citation.pageNumber}`
                              : ""}
                        </button>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
