// SOURCES (UX-03 → UX-04 table): which documents were actually used as
// evidence in this run — derived from real citations (see
// derive-sources-used.ts), never a generic "documents in the workspace"
// list. Honest empty states: a run that searched and found nothing says
// so; a run that never searched renders nothing at all. This is the
// per-investigation scoped view — NAME/TYPE/PASSAGES USED are the columns
// that make sense once already scoped to one run; the workspace-wide
// Sources index (with PRODUCT/REVISION/STATUS/USED/UPDATED) lives at
// /documents (see document-list.tsx).
import Link from "next/link";
import type { AgentCompletedPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import { describeDocumentType } from "@/lib/documents/describe-document-type";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deriveSourcesUsed } from "./derive-sources-used";
import { surface, text } from "./theme";

interface SourcesPanelProps {
  hypotheses: readonly HypothesisCreatedPayload[];
  metrics: AgentCompletedPayload | null;
}

export function SourcesPanel({ hypotheses, metrics }: SourcesPanelProps) {
  if (!metrics) return null;

  const sources = deriveSourcesUsed(hypotheses);

  return (
    <section
      aria-labelledby="sources-panel-heading"
      className={`flex flex-col gap-3 p-5 ${surface.card}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id="sources-panel-heading" className={text.kicker}>
            Sources used
          </h2>
          <span className={`text-sm font-semibold ${text.mono}`}>{sources.length}</span>
        </div>
        <span className={`text-xs ${text.muted}`}>
          {metrics.documentsAvailable} {metrics.documentsAvailable === 1 ? "document" : "documents"}{" "}
          available · {metrics.documentSearches}{" "}
          {metrics.documentSearches === 1 ? "search" : "searches"} performed ·{" "}
          {metrics.passagesRetrieved} {metrics.passagesRetrieved === 1 ? "passage" : "passages"} retrieved
        </span>
      </div>

      {metrics.documentsAvailable === 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className={`${text.kicker} text-[10px] text-muted-foreground`}>No sources</span>
          <p className={`text-sm ${text.muted}`}>
            No engineering documents have been added for this product.
          </p>
        </div>
      ) : sources.length === 0 ? (
        <p className={`text-sm ${text.muted}`}>
          {metrics.passagesRetrieved === 0
            ? "No relevant passages were retrieved for this investigation."
            : "No document passages were used as evidence in this investigation."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Passages used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.documentId}>
                <TableCell className="max-w-[360px] truncate font-medium text-foreground">
                  {source.filename}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {describeDocumentType(source.documentType)}
                </TableCell>
                <TableCell className={`whitespace-nowrap ${text.mono}`}>
                  {source.passageCount} {source.passageCount === 1 ? "passage" : "passages"} used
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Link
        href="/documents"
        className={`self-start text-xs ${text.muted} hover:text-foreground hover:underline`}
      >
        View all sources →
      </Link>
    </section>
  );
}
