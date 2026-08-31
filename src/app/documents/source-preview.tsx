// The citation/source preview MVP-10C's drawer will build on: document,
// page/section, and the exact retrieved passage, with the query terms
// highlighted where practical. Highlighting is done as real React text
// nodes (never dangerouslySetInnerHTML) — passage text comes from an
// uploaded document, which in a multi-tenant app is user-controlled
// content, not something to inject as raw HTML.
import type { EngineeringDocumentPassage } from "@/lib/documents/search";
import { surface, text } from "./theme";

interface SourcePreviewProps {
  passage: EngineeringDocumentPassage;
  query: string;
}

export function SourcePreview({ passage, query }: SourcePreviewProps) {
  const location =
    passage.pageNumber !== null
      ? `Page ${passage.pageNumber}${passage.section ? ` · ${passage.section}` : ""}`
      : (passage.section ?? "No page/section metadata for this format");

  return (
    <div
      aria-label="Source preview"
      className={`flex flex-col gap-3 p-4 ${surface.panelElevated}`}
    >
      <span className={text.kicker}>Source</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{passage.filename}</span>
        <span className={`text-xs ${text.muted}`}>{location}</span>
      </div>
      <p className="text-sm leading-relaxed">{highlightPassage(passage.passage, query)}</p>
    </div>
  );
}

function highlightPassage(passage: string, query: string): React.ReactNode[] {
  const terms = Array.from(
    new Set((query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((term) => term.length > 1)),
  );
  if (terms.length === 0) return [passage];

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = passage.split(pattern);
  const lowerTerms = new Set(terms);

  return parts.map((part, index) =>
    lowerTerms.has(part.toLowerCase()) ? (
      <mark key={index} className="bg-[#3ecf6e]/25 px-0.5 text-[#f3f1e8]">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
