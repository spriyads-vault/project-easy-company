// The signature Crado component: a ranked investigation hypothesis with
// its evidence strictly separated into OBSERVED / KNOWN / INFERRED /
// MISSING. This is a direct rendering of FinalHypothesis (MVP-07) — the
// evidence array's categories are the trust boundary, not a styling
// choice; the model can never populate observed/known (see
// src/lib/hypotheses/schema.ts), so INFERRED is the only place model
// reasoning appears, and it's always labeled as such, never as fact.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import { surface, text } from "./theme";

interface HypothesisCardProps {
  hypothesis: HypothesisCreatedPayload;
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

export function HypothesisCard({ hypothesis }: HypothesisCardProps) {
  return (
    <article className={`flex flex-col gap-4 p-4 ${surface.panelElevated}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-medium leading-snug">{hypothesis.title}</h3>
        <span className="shrink-0 border border-[#3a3d34] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#c8c6bb]">
          {CONFIDENCE_LABEL[hypothesis.confidenceBand]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EVIDENCE_SECTIONS.map((section) => {
          const items = hypothesis.evidence.filter(
            (item) => item.category === section.category,
          );
          if (items.length === 0) return null;
          return (
            <div key={section.category} className="flex flex-col gap-1.5">
              <span className={text.kicker}>{section.heading}</span>
              <ul className="flex flex-col gap-1">
                {items.map((item, index) => (
                  <li
                    key={index}
                    className={
                      section.category === "inferred"
                        ? "text-sm italic text-[#d8d6cb]"
                        : section.category === "missing"
                          ? `border-l-2 border-[#3a3d34] pl-2 text-sm ${text.muted}`
                          : "text-sm"
                    }
                  >
                    {item.description}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 border-t border-[#2c2f27] pt-3">
        <span className={text.kicker}>Next investigation</span>
        <p className="text-sm">{hypothesis.recommendedNextStep}</p>
      </div>
    </article>
  );
}
