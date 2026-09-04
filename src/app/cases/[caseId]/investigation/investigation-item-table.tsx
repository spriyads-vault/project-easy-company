"use client";

// INVESTIGATION ITEM TABLE (App Redesign, Workstream C correction):
// replaces correlation-card.tsx's deterministic card and the stacked
// hypothesis-card.tsx list with one dense master table — real
// deterministic correlations (KNOWN) and real ranked hypotheses
// (INFERRED), nothing else fabricated to fill rows. Selecting a row is
// the only way into detail: it drives the Evidence Inspector
// (context-rail.tsx), exactly like the canvas's own artifact selection
// already did, just from a table row instead of a graph node. No row
// ever states an inferred coupling path as a fact — the classification
// column is the trust boundary, not decoration.
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { HYPOTHESIS_STRENGTH_LABEL, rankHypotheses } from "@/lib/investigation/rank-hypotheses";
import type { RailSelection } from "./context-rail";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { focusRing, text } from "./theme";

export type FocusedItemCategory = "deterministic" | "hypothesis" | null;

interface InvestigationItemTableProps {
  correlations: CorrelationFoundPayload[];
  hypotheses: HypothesisCreatedPayload[];
  timeline: TimelineEntry[];
  selection: RailSelection;
  onSelectCorrelation: (correlation: CorrelationFoundPayload) => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  /** Set briefly by a trace-step click (investigation-workspace.tsx) —
   * real category-level routing from the step's own real label text, not
   * a fabricated 1:1 event-to-row id the wire schema doesn't carry. See
   * that file's comment on handleTraceStepSelect for the honest limit of
   * this link. */
  focusedCategory?: FocusedItemCategory;
}

function correlationKey(correlation: CorrelationFoundPayload): string {
  return `${correlation.productFactId}-${correlation.sourceFrequencyMhz}-${correlation.harmonicNumber}`;
}

/** Real evidence-count summary for a hypothesis row — e.g. "2 known · 1
 * missing" — derived from the hypothesis's own stored evidence array,
 * never a fabricated total. */
function evidenceSummary(hypothesis: HypothesisCreatedPayload): string {
  const counts = { observed: 0, known: 0, missing: 0 };
  for (const item of hypothesis.evidence) {
    if (item.category === "observed") counts.observed++;
    else if (item.category === "known") counts.known++;
    else if (item.category === "missing") counts.missing++;
  }
  const parts: string[] = [];
  if (counts.observed > 0) parts.push(`${counts.observed} observed`);
  if (counts.known > 0) parts.push(`${counts.known} known`);
  if (counts.missing > 0) parts.push(`${counts.missing} missing`);
  return parts.length > 0 ? parts.join(" · ") : "No supporting evidence recorded";
}

/** A real persisted timestamp for this exact hypothesis, when the live
 * session's own timeline happens to carry one (matched by title — the
 * wire schema has no hypothesis id to join on more precisely). Returns
 * null rather than a guess when no match exists — never fabricated. */
function findHypothesisTimestamp(hypothesis: HypothesisCreatedPayload, timeline: TimelineEntry[]): string | null {
  const entry = timeline.find((item) => item.type === "hypothesis" && item.title === hypothesis.title);
  return entry ? entry.createdAt : null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function InvestigationItemTable({
  correlations,
  hypotheses,
  timeline,
  selection,
  onSelectCorrelation,
  onSelectHypothesis,
  focusedCategory,
}: InvestigationItemTableProps) {
  const ranked = rankHypotheses(hypotheses);

  if (correlations.length === 0 && ranked.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className={`text-sm ${text.muted}`}>
          No deterministic correlations or hypotheses yet for this measurement.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[92px]">Classification</TableHead>
          <TableHead>Investigation item</TableHead>
          <TableHead className="hidden lg:table-cell">Evidence summary</TableHead>
          <TableHead className="w-[110px]">State</TableHead>
          <TableHead className="hidden w-[120px] sm:table-cell">Updated by</TableHead>
          <TableHead className="hidden w-[80px] sm:table-cell">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {correlations.map((correlation) => {
          const isSelected = selection?.kind === "correlation" && selection.correlation === correlation;
          const deviationLabel =
            correlation.deviationRatio === 0
              ? "Exact match"
              : `${(correlation.deviationRatio * 100).toFixed(3)}% deviation`;
          return (
            <TableRow
              key={correlationKey(correlation)}
              data-state={isSelected ? "selected" : undefined}
              tabIndex={0}
              role="button"
              onClick={() => onSelectCorrelation(correlation)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCorrelation(correlation);
                }
              }}
              className={`h-11 cursor-pointer ${focusRing} ${
                focusedCategory === "deterministic" ? "crado-rise bg-primary/5" : ""
              }`}
            >
              <TableCell>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Known</span>
              </TableCell>
              <TableCell className="max-w-0">
                <p className={`truncate ${text.mono} text-[13px]`}>
                  {correlation.sourceFrequencyMhz} MHz × {correlation.harmonicNumber} = {correlation.expectedFrequencyMhz} MHz
                </p>
              </TableCell>
              <TableCell className="hidden truncate text-xs text-muted-foreground lg:table-cell">
                {correlation.productFactLabel} · {deviationLabel}
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">Verified</span>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">Deterministic check</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">—</TableCell>
            </TableRow>
          );
        })}

        {ranked.map(({ hypothesis, originalIndex, strength }) => {
          const isSelected = selection?.kind === "hypothesis" && selection.index === originalIndex;
          const timestamp = findHypothesisTimestamp(hypothesis, timeline);
          return (
            <TableRow
              key={`${hypothesis.productFactId}-${originalIndex}`}
              data-state={isSelected ? "selected" : undefined}
              tabIndex={0}
              role="button"
              onClick={() => onSelectHypothesis(hypothesis, originalIndex)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectHypothesis(hypothesis, originalIndex);
                }
              }}
              className={`h-11 cursor-pointer ${focusRing} ${
                focusedCategory === "hypothesis" ? "crado-rise bg-warning/5" : ""
              }`}
            >
              <TableCell>
                <span className="text-[11px] font-medium uppercase tracking-wide text-warning">Inferred</span>
              </TableCell>
              <TableCell className="max-w-0">
                <p className="truncate text-[13px] text-foreground">{hypothesis.title}</p>
              </TableCell>
              <TableCell className="hidden truncate text-xs text-muted-foreground lg:table-cell">
                {evidenceSummary(hypothesis)}
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{HYPOTHESIS_STRENGTH_LABEL[strength]}</span>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">Agent</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{formatTime(timestamp)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
