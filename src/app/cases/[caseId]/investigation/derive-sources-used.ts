// Pure derivation, no fetch: "sources used" is exactly the set of document
// citations that survived src/lib/agents/validate-agent-output.ts's
// hallucination checks and made it into a hypothesis's KNOWN evidence —
// never a separate, potentially-drifted list.
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";

export interface SourceUsage {
  documentId: string;
  filename: string;
  documentType: string;
  /** Distinct chunks actually cited from this document, across every
   * hypothesis in this run. */
  passageCount: number;
}

export function deriveSourcesUsed(
  hypotheses: readonly HypothesisCreatedPayload[],
): SourceUsage[] {
  const byDocument = new Map<string, { filename: string; documentType: string; chunkIds: Set<string> }>();

  for (const hypothesis of hypotheses) {
    for (const item of hypothesis.evidence) {
      const citation = item.citation;
      if (!citation) continue;
      const existing = byDocument.get(citation.documentId);
      if (existing) {
        existing.chunkIds.add(citation.chunkId);
      } else {
        byDocument.set(citation.documentId, {
          filename: citation.filename,
          documentType: citation.documentType,
          chunkIds: new Set([citation.chunkId]),
        });
      }
    }
  }

  return Array.from(byDocument.entries()).map(([documentId, value]) => ({
    documentId,
    filename: value.filename,
    documentType: value.documentType,
    passageCount: value.chunkIds.size,
  }));
}
