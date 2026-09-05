// REASONING SECTION (UX-07): two visually distinct objects side by side —
// left, the deterministic relationship (CorrelationCard); right, the
// machine hypothesis (HypothesisCard) — replacing InvestigationItemTable's
// shared <Table>. Retired deliberately, not by omission: rendering
// arithmetic and a machine guess as sibling rows of one table flattened
// the exact distinction the product is built on (see
// docs/PROGRESS.md's UX-07 entry and acceptance criterion 4 — "the
// deterministic correlation and the hypothesis do not share a table
// element"). Both cards carry their own "State" field directly on the
// object now (Verified / the real leading-plausible-weakened-unresolved
// rank) — the two columns InvestigationItemTable's retirement could have
// silently dropped; "Updated by" (Deterministic check / Agent) is
// deliberately NOT carried forward — once the two objects are their own
// visually distinct kind, which one produced a row is no longer
// information a reader needs restated, it's already the whole point of
// the two-column split.
//
// "View as map" always renders here, adjacent to what it changes,
// regardless of whether any correlation/hypothesis exists yet — the Map
// view still has real content to show even then (the Measurement node is
// never empty; see build-canvas-graph.ts).
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import { rankHypotheses } from "@/lib/investigation/rank-hypotheses";
import type { RailSelection } from "./context-rail";
import { CorrelationCard } from "./correlation-card";
import { HypothesisCard } from "./hypothesis-card";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { focusRing, text } from "./theme";

interface ReasoningSectionProps {
  correlations: CorrelationFoundPayload[];
  hypotheses: HypothesisCreatedPayload[];
  selection: RailSelection;
  onSelectCorrelation: (correlation: CorrelationFoundPayload) => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onOpenCitation: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  onToggleMap: () => void;
  /** Set briefly by a trace-step click (investigation-workspace.tsx) —
   * real category-level routing from the step's own real label text, not
   * a fabricated 1:1 event-to-object id the wire schema doesn't carry.
   * Optional/undefined renders neither column emphasized, exactly as
   * before this existed. */
  focusedCategory?: "deterministic" | "hypothesis" | null;
}

export function ReasoningSection({
  correlations,
  hypotheses,
  selection,
  onSelectCorrelation,
  onSelectHypothesis,
  onOpenCitation,
  onToggleMap,
  focusedCategory,
}: ReasoningSectionProps) {
  const ranked = rankHypotheses(hypotheses);
  const isEmpty = correlations.length === 0 && ranked.length === 0;

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className={text.kicker}>Reasoning</h2>
        <button
          type="button"
          onClick={onToggleMap}
          className={`rounded-[7px] border border-border px-2.5 py-1 text-xs font-medium ${text.muted} transition-colors hover:text-foreground ${focusRing}`}
        >
          View as map
        </button>
      </div>

      {isEmpty ? (
        <p className={`text-sm ${text.muted}`}>
          No deterministic correlations or hypotheses yet for this measurement.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            className={`flex flex-col gap-3 rounded-lg transition-colors ${
              focusedCategory === "deterministic" ? "crado-rise bg-primary/5" : ""
            }`}
          >
            {correlations.map((correlation) => (
              <CorrelationCard
                key={`${correlation.productFactId}-${correlation.sourceFrequencyMhz}-${correlation.harmonicNumber}`}
                correlation={correlation}
                onSelect={() => onSelectCorrelation(correlation)}
                isSelected={selection?.kind === "correlation" && selection.correlation === correlation}
              />
            ))}
          </div>
          <div
            className={`flex flex-col gap-3 rounded-lg transition-colors ${
              focusedCategory === "hypothesis" ? "crado-rise bg-warning/5" : ""
            }`}
          >
            {ranked.map(({ hypothesis, originalIndex, strength }) => (
              <HypothesisCard
                key={`${hypothesis.productFactId}-${originalIndex}`}
                hypothesis={hypothesis}
                index={originalIndex}
                strength={strength}
                onOpenCitation={onOpenCitation}
                onSelect={() => onSelectHypothesis(hypothesis, originalIndex)}
                isSelected={selection?.kind === "hypothesis" && selection.index === originalIndex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
