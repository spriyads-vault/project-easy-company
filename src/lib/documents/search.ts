// Hybrid retrieval — the one clean tool MVP-10B's Investigation Agent will
// call. No LLM involved (deterministic ranking done in Postgres, see
// search_document_chunks in the MVP-10A migration); workspace scoping is
// never a caller-supplied value, only the authenticated Supabase client's
// own RLS/current_workspace_id() — a caller cannot search another
// workspace's chunks by passing a different id, because there's no id
// parameter for that at all.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeHashedEmbedding, toVectorLiteral } from "./embedding";

export interface SearchEngineeringDocumentsInput {
  query: string;
  /** Restrict to a product/revision within the caller's own workspace.
   * Omit either to search across the whole workspace. */
  productId?: string;
  productRevisionId?: string;
  /** @default 10 */
  limit?: number;
}

export interface EngineeringDocumentPassage {
  chunkId: string;
  documentId: string;
  filename: string;
  documentType: string;
  /** Page where the source format has pages (PDF); null otherwise. */
  pageNumber: number | null;
  /** Heading the passage falls under, where the source has one (Markdown). */
  section: string | null;
  passage: string;
  keywordScore: number;
  semanticScore: number;
  /** The ranking score actually used to order results — a documented,
   * tunable blend of keywordScore and semanticScore (see the migration's
   * search_document_chunks function), not a model-produced number. */
  relevanceScore: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Searches this caller's workspace's indexed engineering documents and
 * returns exact, source-backed passages — never a summary, never a
 * document dumped whole into context. Every result carries enough
 * provenance (documentId, filename, page/section) to cite back to an
 * exact location, which is what keeps a regulatory passage from silently
 * becoming a new, ungrounded "fact" (CLAUDE.md: "Every regulatory
 * statement shown as authoritative must have provenance").
 */
export async function searchEngineeringDocuments(
  supabase: SupabaseClient<Database>,
  input: SearchEngineeringDocumentsInput,
): Promise<EngineeringDocumentPassage[]> {
  const query = input.query.trim();
  if (!query) return [];

  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const queryEmbedding = toVectorLiteral(computeHashedEmbedding(query));

  const { data, error } = await supabase.rpc("search_document_chunks", {
    query_text: query,
    query_embedding: queryEmbedding,
    filter_product_id: input.productId,
    filter_product_revision_id: input.productRevisionId,
    match_limit: limit,
  });

  if (error || !data) return [];

  return data.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    filename: row.filename,
    documentType: row.document_type,
    pageNumber: row.page_number,
    section: row.section,
    passage: row.content,
    keywordScore: row.keyword_score,
    semanticScore: row.semantic_score,
    relevanceScore: row.combined_score,
  }));
}
