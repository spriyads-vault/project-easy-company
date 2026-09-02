// EVIDENCE VIEW (UX-03 → UX-04 table): OBSERVED/KNOWN/INFERRED/MISSING as
// the central information architecture — "avoid four generic rectangular
// cards; use a professional table/list." Same trust boundary
// hypothesis-card.tsx/canvas-nodes.tsx enforce per hypothesis (the model
// can never populate observed/known — see src/lib/hypotheses/schema.ts),
// flattened into one dense TYPE/EVIDENCE/SOURCE/REVISION/USED BY table
// instead of four category cards. Every row still names which hypothesis
// it came from (click to select it in the context rail) and, when
// document-backed, still opens the exact same source drawer — nothing
// here changes what's OBSERVED vs KNOWN vs INFERRED vs MISSING, only how
// densely it's laid out.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { evidence, focusRing, text } from "./theme";

interface EvidenceViewProps {
  hypotheses: readonly HypothesisCreatedPayload[];
  /** The revision this investigation run's evidence pertains to — shown as
   * a real column value (every row in a single run shares one revision),
   * never fabricated per-row. Optional/defaults to "—" so pre-UX-04 call
   * sites (with no revision context) keep working. */
  revisionLabel?: string;
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  onSelectHypothesis?: (hypothesis: HypothesisCreatedPayload, index: number) => void;
}

const CATEGORY_ORDER: EvidenceCategory[] = ["observed", "known", "inferred", "missing"];
const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  observed: "Observed",
  known: "Known",
  inferred: "Inferred",
  missing: "Missing",
};

export function EvidenceView({ hypotheses, revisionLabel = "—", onOpenCitation, onSelectHypothesis }: EvidenceViewProps) {
  if (hypotheses.length === 0) {
    return (
      <p className={`p-5 text-sm ${text.muted}`}>
        No evidence yet — run an investigation to see it collected here.
      </p>
    );
  }

  const rows = CATEGORY_ORDER.flatMap((category) =>
    hypotheses.flatMap((hypothesis, hypothesisIndex) =>
      hypothesis.evidence
        .filter((item) => item.category === category)
        .map((item, itemIndex) => ({
          key: `${category}-${hypothesisIndex}-${itemIndex}`,
          category,
          item,
          hypothesis,
          hypothesisIndex,
        })),
    ),
  );

  return (
    <section aria-labelledby="evidence-view-heading" className="flex flex-col gap-2 p-5">
      <h2 id="evidence-view-heading" className={text.kicker}>
        Evidence
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Revision</TableHead>
            <TableHead>Used by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ key, category, item, hypothesis, hypothesisIndex }) => {
            const style = evidence[category];
            return (
              <TableRow key={key}>
                <TableCell className="whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 ${style.glyphColor}`}>
                    <span aria-hidden="true">{style.glyph}</span>
                    <span className="text-xs font-medium uppercase tracking-wide">{CATEGORY_LABEL[category]}</span>
                  </span>
                </TableCell>
                <TableCell className={`max-w-[420px] whitespace-normal ${category === "inferred" ? "italic" : ""}`}>
                  {item.description}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {item.citation ? (
                    <button
                      type="button"
                      onClick={() => onOpenCitation(item.citation!, item.category, hypothesisIndex, hypothesis.title)}
                      className={`inline-flex items-center gap-1 rounded-[7px] border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[11px] text-primary transition-colors hover:border-primary/70 hover:bg-primary/15 ${focusRing}`}
                    >
                      <span aria-hidden="true">⌗</span>
                      {item.citation.filename}
                      {item.citation.section
                        ? ` · ${item.citation.section}`
                        : item.citation.pageNumber
                          ? ` · p.${item.citation.pageNumber}`
                          : ""}
                    </button>
                  ) : (
                    <span className={text.muted}>—</span>
                  )}
                </TableCell>
                <TableCell className={`whitespace-nowrap ${text.mono}`}>{revisionLabel}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal">
                  {onSelectHypothesis ? (
                    <button
                      type="button"
                      onClick={() => onSelectHypothesis(hypothesis, hypothesisIndex)}
                      className={`text-left text-foreground underline-offset-2 hover:underline ${focusRing}`}
                    >
                      {hypothesis.title}
                    </button>
                  ) : (
                    hypothesis.title
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
