"use client";

import { useActionState, useState } from "react";
import { searchDocumentsAction, type SearchDocumentsFormState } from "./actions";
import { SourcePreview } from "./source-preview";
import { surface, text } from "./theme";
import { focusRing, radius, typography } from "@/lib/design/tokens";
import type { EngineeringDocumentPassage } from "@/lib/documents/search";

const initialState: SearchDocumentsFormState = {};

export function SearchPanel() {
  const [state, formAction, pending] = useActionState(searchDocumentsAction, initialState);
  const [selected, setSelected] = useState<EngineeringDocumentPassage | null>(null);

  const results = state.results ?? [];
  const selectedStillVisible = selected && results.some((r) => r.chunkId === selected.chunkId);

  return (
    <div className={`flex flex-col gap-4 p-5 ${surface.card}`}>
      <h2 className={typography.sectionHeading}>Search sources</h2>

      <form action={formAction} className="flex gap-2">
        <label className="sr-only" htmlFor="document-search-query">
          Search engineering documents
        </label>
        <input
          id="document-search-query"
          name="query"
          type="search"
          placeholder="e.g. 40 MHz clock shielding"
          className={`flex-1 ${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] ${focusRing}`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {state.query !== undefined && results.length === 0 && !pending ? (
        <p role="status" className={`text-sm ${text.muted}`}>
          No matching passages found.
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ul className="flex flex-col gap-2">
            {results.map((result) => (
              <li key={result.chunkId}>
                <button
                  type="button"
                  onClick={() => setSelected(result)}
                  aria-pressed={selected?.chunkId === result.chunkId}
                  className={`flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    selected?.chunkId === result.chunkId
                      ? "border-[#1f9d52]/50 bg-[#1f9d52]/10"
                      : "border-[#ececee] hover:border-[#d4d4d8] hover:bg-[#f4f4f5]/60"
                  }`}
                >
                  <span className="truncate font-medium text-[#18181b]">{result.filename}</span>
                  <span className={`truncate text-xs ${text.muted}`}>
                    {result.pageNumber !== null
                      ? `Page ${result.pageNumber}`
                      : (result.section ?? "—")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selectedStillVisible ? (
            <SourcePreview passage={selected} query={state.query ?? ""} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
