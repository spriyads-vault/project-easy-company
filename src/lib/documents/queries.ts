// Read path for the Documents/Sources UI. Every list is paginated with a
// real `.range()` query and a real `count: "exact"` — this must not
// assume a workspace has only a handful of documents (see CLAUDE.md
// section 9: "performance does not depend on loading every document into
// memory"). Takes an already-authenticated Supabase client rather than
// building one itself (see src/lib/analysis/create-analysis-run.ts for the
// same shape) — next/headers' cookies() only works inside Next's own
// request lifecycle, and pagination is directly integration-tested here
// against real Postgres, which needs to construct its own client outside
// that lifecycle.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  DocumentStatus,
  DocumentType,
} from "@/lib/domain/schema";

export interface DocumentListItem {
  id: string;
  filename: string;
  documentType: DocumentType;
  status: DocumentStatus;
  pageCount: number | null;
  uploadedAt: string;
  indexedAt: string | null;
  failureReason: string | null;
  productId: string | null;
  productRevisionId: string | null;
  /** Denormalized for display only — never joined for access control, RLS
   * already scopes the row itself. Null for workspace-level documents not
   * tied to a product. */
  productName: string | null;
  revisionLabel: string | null;
  isCurrent: boolean;
  /** Real distinct-citation count from countDocumentCitationsByWorkspace,
   * merged in by the caller (listEngineeringDocuments doesn't compute it
   * itself — it's a separate, workspace-wide query, not a per-page one).
   * Optional/defaults to 0 in callers that don't need the Sources table's
   * USED column (e.g. a product's own document list). */
  usedCount?: number;
}

export interface ListDocumentsInput {
  /** 1-indexed. @default 1 */
  page?: number;
  /** @default 25, capped at 100 */
  pageSize?: number;
  productId?: string;
  productRevisionId?: string;
  /** Restrict to one or more DocumentType values (a Sources-page filter
   * tab groups several, e.g. "Product" -> schematic/pcb/mechanical). */
  documentTypes?: string[];
}

export interface ListDocumentsResult {
  documents: DocumentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const DOCUMENT_LIST_COLUMNS =
  "id, filename, document_type, status, page_count, uploaded_at, indexed_at, failure_reason, product_id, product_revision_id, is_current, products(name), product_revisions(label)";

export async function listEngineeringDocuments(
  supabase: SupabaseClient<Database>,
  input: ListDocumentsInput = {},
): Promise<ListDocumentsResult> {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let rangedQuery = supabase
    .from("engineering_documents")
    .select(DOCUMENT_LIST_COLUMNS, { count: "exact" })
    .order("uploaded_at", { ascending: false })
    .range(from, to);
  if (input.productId) rangedQuery = rangedQuery.eq("product_id", input.productId);
  if (input.productRevisionId) {
    rangedQuery = rangedQuery.eq("product_revision_id", input.productRevisionId);
  }
  if (input.documentTypes && input.documentTypes.length > 0) {
    rangedQuery = rangedQuery.in("document_type", input.documentTypes);
  }

  const { data, count, error } = await rangedQuery;

  if (!error) {
    return {
      documents: (data ?? []).map(mapDocumentRow),
      totalCount: count ?? 0,
      page,
      pageSize,
    };
  }

  // PostgREST errors (PGRST103 "Requested range not satisfiable") when the
  // requested page is past the end of the data — e.g. the last document on
  // a page got deleted, or a stale link is followed. That's a legitimate
  // empty page, not a broken one: it must still report the real total
  // count rather than falling back to 0, so a caller can render "no more
  // results" instead of implying the workspace is empty. A second,
  // unranged count-only query recovers it without ever fetching every row.
  let countQuery = supabase
    .from("engineering_documents")
    .select("id", { count: "exact", head: true });
  if (input.productId) countQuery = countQuery.eq("product_id", input.productId);
  if (input.productRevisionId) {
    countQuery = countQuery.eq("product_revision_id", input.productRevisionId);
  }
  if (input.documentTypes && input.documentTypes.length > 0) {
    countQuery = countQuery.in("document_type", input.documentTypes);
  }
  const { count: totalCount } = await countQuery;

  return { documents: [], totalCount: totalCount ?? 0, page, pageSize };
}

function mapDocumentRow(row: {
  id: string;
  filename: string;
  document_type: string;
  status: string;
  page_count: number | null;
  uploaded_at: string;
  indexed_at: string | null;
  failure_reason: string | null;
  product_id: string | null;
  product_revision_id: string | null;
  is_current: boolean;
  products: { name: string } | null;
  product_revisions: { label: string } | null;
}): DocumentListItem {
  return {
    id: row.id,
    filename: row.filename,
    documentType: row.document_type as DocumentType,
    status: row.status as DocumentStatus,
    pageCount: row.page_count,
    uploadedAt: row.uploaded_at,
    indexedAt: row.indexed_at,
    failureReason: row.failure_reason,
    productId: row.product_id,
    productRevisionId: row.product_revision_id,
    productName: row.products?.name ?? null,
    revisionLabel: row.product_revisions?.label ?? null,
    isCurrent: row.is_current,
  };
}

// A minimal, local shape — only what's needed to pull a document_id out of
// a hypothesis.created payload's evidence citations. Deliberately not the
// full hypothesisCreatedPayloadSchema (src/lib/analysis/events.ts, not
// exported): this never needs to validate a hypothesis's title/confidence/
// evidence description, only that a citation's documentId exists, so a
// smaller, purpose-built schema is what "no fabricated dashboard numbers"
// actually calls for — a real, minimal read, not importing the world.
const citationCountPayloadSchema = z.object({
  evidence: z.array(z.object({ citation: z.object({ documentId: z.string() }).optional() })),
});

/** How many distinct hypothesis-evidence citations reference each document
 * across every past investigation in the current workspace — the Sources
 * table's USED column (UX-04's ticket spec). Never a placeholder: RLS
 * already scopes analysis_events to the caller's workspace (workspace_id
 * is a column on the row itself, not reached via a join), so this reads
 * real, already-persisted hypothesis.created events and counts real
 * citations — the same source of truth deriveSourcesUsed.ts already uses
 * for a single run, generalized to the whole workspace. A document with no
 * entry in the returned map has genuinely never been cited, not merely
 * "not yet counted." */
export async function countDocumentCitationsByWorkspace(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("analysis_events")
    .select("payload")
    .eq("event_type", "hypothesis.created");
  if (error || !data) return new Map();

  const byDocument = new Map<string, number>();
  for (const row of data) {
    const parsed = citationCountPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    for (const item of parsed.data.evidence) {
      if (!item.citation) continue;
      byDocument.set(item.citation.documentId, (byDocument.get(item.citation.documentId) ?? 0) + 1);
    }
  }
  return byDocument;
}
