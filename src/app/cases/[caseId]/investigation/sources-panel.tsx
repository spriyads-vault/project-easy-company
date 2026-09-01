// SOURCES: which documents were actually used as evidence in this run —
// derived from real citations (see derive-sources-used.ts), never a
// generic "documents in the workspace" list. Honest empty states: a run
// that searched and found nothing says so; a run that never searched
// renders nothing at all (see AgentActivityPanel's own guard for that).
import Link from "next/link";
import type { AgentCompletedPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import { describeDocumentType } from "@/lib/documents/describe-document-type";
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
      className={`flex flex-col gap-3 p-5 ${surface.panel}`}
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
          <span className={`${text.kicker} text-[10px] text-[#6b6354]`}>No sources</span>
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
        <ul className="flex flex-col">
          {sources.map((source) => (
            <li
              key={source.documentId}
              className="flex items-center justify-between gap-3 border-b border-[#e7e2d6] py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{source.filename}</span>
                <span className={`${text.kicker} text-[10px]`}>
                  {describeDocumentType(source.documentType)}
                </span>
              </div>
              <span className={`shrink-0 text-xs ${text.mono} ${text.muted}`}>
                {source.passageCount} {source.passageCount === 1 ? "passage" : "passages"} used
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/documents"
        className={`self-start text-xs ${text.muted} hover:text-[#1c1a15] hover:underline`}
      >
        View all sources →
      </Link>
    </section>
  );
}
