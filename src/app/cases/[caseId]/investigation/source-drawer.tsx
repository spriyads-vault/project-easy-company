"use client";

// The right-side drawer opened by clicking a document citation. Shows the
// exact stored, retrieved passage and its provenance — never the full
// document (out of MVP scope: "exact passage + provenance is enough").
// A real dialog, not a styled div: role="dialog", traps focus while open,
// closes on Escape or backdrop click, and returns focus to whatever
// triggered it — the citation button that opened it.
import { useEffect, useRef } from "react";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import type { EvidenceCategory } from "@/lib/domain/schema";
import { describeDocumentType } from "@/lib/documents/describe-document-type";
import { surface, text } from "./theme";

interface SourceDrawerProps {
  citation: EvidenceCitation | null;
  hypothesisTitle: string | null;
  hypothesisIndex: number | null;
  evidenceCategory: EvidenceCategory | null;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function SourceDrawer({
  citation,
  hypothesisTitle,
  hypothesisIndex,
  evidenceCategory,
  onClose,
}: SourceDrawerProps) {
  const open = citation !== null;
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!citation) return null;

  const location = citation.pageNumber
    ? `Page ${citation.pageNumber}`
    : (citation.section ?? "No page/section metadata for this format");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close source"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-drawer-heading"
        className={`relative flex h-full w-full flex-col gap-4 overflow-y-auto p-5 sm:w-[420px] ${surface.panelElevated}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className={text.kicker}>{describeDocumentType(citation.documentType)}</span>
            <h2 id="source-drawer-heading" className="text-base font-medium leading-snug">
              {citation.filename}
            </h2>
            <span className={`text-xs ${text.muted}`}>{location}</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="shrink-0 border border-[#3a3d34] px-2 py-1 text-xs uppercase tracking-wide hover:border-[#3ecf6e]/60 hover:text-[#5fdb87]"
          >
            Close
          </button>
        </div>

        <div className={`flex flex-col gap-2 border-t border-b border-[#2c2f27] py-4`}>
          <span className={text.kicker}>Retrieved passage</span>
          <p className="text-sm leading-relaxed">{citation.passage}</p>
        </div>

        {hypothesisTitle !== null && hypothesisIndex !== null ? (
          <div className="flex flex-col gap-1">
            <span className={text.kicker}>Used in</span>
            <p className="text-sm">
              Hypothesis {String(hypothesisIndex + 1).padStart(2, "0")} — {hypothesisTitle}
            </p>
          </div>
        ) : null}

        {evidenceCategory ? (
          <div className="flex flex-col gap-1">
            <span className={text.kicker}>Evidence type</span>
            <p className="text-sm uppercase tracking-wide">{evidenceCategory}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
