// Real counts only — never a placeholder number. The header count and this
// list both come straight from listEngineeringDocuments' `count: "exact"`
// query; there is no path in this component that can display a number
// that doesn't match what's actually in the workspace.
import Link from "next/link";
import type { DocumentListItem } from "@/lib/documents/queries";
import type { DocumentStatus } from "@/lib/domain/schema";
import { text, accent } from "./theme";

interface DocumentListProps {
  documents: DocumentListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploading: "UPLOADING",
  processing: "PROCESSING",
  indexed: "INDEXED",
  failed: "FAILED",
};

const STATUS_CLASS: Record<DocumentStatus, string> = {
  uploading: text.muted,
  processing: "text-[#c8c6bb]",
  indexed: accent.greenText,
  failed: accent.warnText,
};

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  schematic: "Schematic",
  pcb: "PCB",
  test_report: "Test report",
  datasheet: "Datasheet",
  regulatory: "Regulatory",
  mechanical: "Mechanical",
  engineering_note: "Engineering note",
  other: "Other",
};

export function DocumentList({ documents, page, pageSize, totalCount }: DocumentListProps) {
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  if (documents.length === 0) {
    return (
      <p className={`text-sm ${text.muted}`}>
        No documents uploaded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 border-b border-[#21231e] py-2.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{doc.filename}</span>
              <span className={`${text.kicker} text-[10px]`}>
                {DOCUMENT_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                {doc.pageCount !== null ? ` · ${doc.pageCount} pages` : ""}
                {!doc.isCurrent ? " · historical" : ""}
              </span>
              {doc.status === "failed" && doc.failureReason ? (
                <span className={`text-xs ${accent.warnText}`}>{doc.failureReason}</span>
              ) : null}
            </div>
            <span
              className={`shrink-0 border border-[#2c2f27] px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[doc.status]}`}
            >
              {STATUS_LABEL[doc.status]}
            </span>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav aria-label="Document pages" className="flex items-center justify-between gap-3 pt-2">
          <span className={`text-xs ${text.muted}`}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink page={page - 1} disabled={page <= 1} label="Previous" />
            <PageLink page={page + 1} disabled={page >= totalPages} label="Next" />
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ page, disabled, label }: { page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="border border-[#2c2f27] px-3 py-1 text-xs uppercase tracking-wide text-[#4a4d43]">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/documents?page=${page}`}
      className="border border-[#2c2f27] px-3 py-1 text-xs uppercase tracking-wide hover:border-[#3ecf6e]/60 hover:text-[#5fdb87]"
    >
      {label}
    </Link>
  );
}
