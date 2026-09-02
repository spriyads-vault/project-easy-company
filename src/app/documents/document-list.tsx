// Real counts only — never a placeholder number. The header count and this
// list both come straight from listEngineeringDocuments' `count: "exact"`
// query; there is no path in this component that can display a number
// that doesn't match what's actually in the workspace.
import Link from "next/link";
import type { DocumentListItem } from "@/lib/documents/queries";
import type { DocumentStatus } from "@/lib/domain/schema";
import { describeDocumentType } from "@/lib/documents/describe-document-type";
import { text } from "./theme";
import { StatusBadge } from "@/lib/design/status-badge";
import type { HeroStatusTone } from "@/lib/design/tokens";

interface DocumentListProps {
  documents: DocumentListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  /** The active Sources filter tab (e.g. "testing"), carried through
   * pagination links so "next page" doesn't silently drop the filter. */
  typeFilter?: string;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploading: "UPLOADING",
  processing: "PROCESSING",
  indexed: "INDEXED",
  failed: "FAILED",
};

const STATUS_TONE: Record<DocumentStatus, HeroStatusTone> = {
  uploading: "waiting",
  processing: "active",
  indexed: "complete",
  failed: "failed",
};

export function DocumentList({
  documents,
  page,
  pageSize,
  totalCount,
  typeFilter,
}: DocumentListProps) {
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  if (documents.length === 0) {
    return (
      <p className={`text-sm ${text.muted}`}>
        {typeFilter ? "No documents match this filter." : "No documents uploaded yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-[#1c212a]">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-[#f5f6f7]">{doc.filename}</span>
              <span className={`${text.kicker} normal-case tracking-normal text-[11px]`}>
                {describeDocumentType(doc.documentType)}
                {doc.productName
                  ? ` · ${doc.productName}${doc.revisionLabel ? ` ${doc.revisionLabel}` : ""}`
                  : ""}
                {doc.pageCount !== null ? ` · ${doc.pageCount} pages` : ""}
                {!doc.isCurrent ? " · historical" : ""}
              </span>
              <span className={`text-[11px] ${text.muted}`}>
                {doc.status === "indexed" && doc.indexedAt
                  ? `Indexed ${formatDate(doc.indexedAt)}`
                  : doc.status === "failed" && doc.failureReason
                    ? doc.failureReason
                    : null}
              </span>
            </div>
            <StatusBadge label={STATUS_LABEL[doc.status]} tone={STATUS_TONE[doc.status]} />
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav aria-label="Document pages" className="flex items-center justify-between gap-3 pt-2">
          <span className={`text-xs ${text.muted}`}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink page={page - 1} disabled={page <= 1} label="Previous" typeFilter={typeFilter} />
            <PageLink page={page + 1} disabled={page >= totalPages} label="Next" typeFilter={typeFilter} />
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
  typeFilter,
}: {
  page: number;
  disabled: boolean;
  label: string;
  typeFilter?: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-[#1c212a] px-3 py-1 text-xs font-medium text-[#6b7684]">
        {label}
      </span>
    );
  }
  const href = typeFilter ? `/documents?page=${page}&type=${typeFilter}` : `/documents?page=${page}`;
  return (
    <Link
      href={href}
      className="rounded-lg border border-[#232933] px-3 py-1 text-xs font-medium text-[#f5f6f7] transition-colors hover:border-[#22c55e]/50 hover:text-[#22c55e]"
    >
      {label}
    </Link>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
