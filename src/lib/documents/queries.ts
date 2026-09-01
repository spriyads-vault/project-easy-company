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
