// The ingestion pipeline: extract -> chunk -> embed -> store -> mark
// indexed (or mark failed with a clear, honest reason). Synchronous, no
// queue — CLAUDE.md: "no queues/workflow engine unless there is a
// demonstrated need," and MVP document volumes don't demonstrate one yet.
// Takes an already-authenticated Supabase client, exactly like
// createAnalysisRunForFailureCase (MVP-08) — RLS does the workspace
// scoping, this function never touches auth itself.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SupportedDocumentMimeType } from "@/lib/domain/schema";
import { extractDocumentText } from "./extract-text";
import { chunkDocumentPages } from "./chunk-text";
import { computeHashedEmbedding, toVectorLiteral } from "./embedding";

export interface IngestDocumentParams {
  documentId: string;
  buffer: Uint8Array;
  mimeType: SupportedDocumentMimeType;
}

export interface IngestDocumentResult {
  status: "indexed" | "failed";
  chunkCount: number;
  pageCount: number | null;
  failureReason: string | null;
}

export async function ingestDocument(
  supabase: SupabaseClient<Database>,
  params: IngestDocumentParams,
): Promise<IngestDocumentResult> {
  const extraction = await extractDocumentText(params.buffer, params.mimeType);
  if (!extraction.ok) {
    await markFailed(supabase, params.documentId, extraction.reason);
    return { status: "failed", chunkCount: 0, pageCount: null, failureReason: extraction.reason };
  }

  const chunks = chunkDocumentPages(extraction.pages, {
    markdown: params.mimeType === "text/markdown",
  });
  if (chunks.length === 0) {
    const reason = "No extractable text content found to index.";
    await markFailed(supabase, params.documentId, reason);
    return {
      status: "failed",
      chunkCount: 0,
      pageCount: extraction.pageCount,
      failureReason: reason,
    };
  }

  const rows = chunks.map((chunk) => ({
    document_id: params.documentId,
    chunk_index: chunk.chunkIndex,
    page_number: chunk.pageNumber,
    section: chunk.section,
    content: chunk.content,
    embedding: toVectorLiteral(computeHashedEmbedding(chunk.content)),
  }));

  // Idempotent on retry: clear any partial chunks from a prior attempt
  // before inserting the fresh set, so re-ingesting a document never
  // leaves stale/duplicate chunks behind.
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", params.documentId);
  if (deleteError) {
    const reason = "Could not prepare this document for indexing.";
    await markFailed(supabase, params.documentId, reason);
    return { status: "failed", chunkCount: 0, pageCount: extraction.pageCount, failureReason: reason };
  }

  const { error: insertError } = await supabase.from("document_chunks").insert(rows);
  if (insertError) {
    const reason = "Could not store extracted content.";
    await markFailed(supabase, params.documentId, reason);
    return { status: "failed", chunkCount: 0, pageCount: extraction.pageCount, failureReason: reason };
  }

  const { error: updateError } = await supabase
    .from("engineering_documents")
    .update({
      status: "indexed",
      indexed_at: new Date().toISOString(),
      page_count: extraction.pageCount,
      failure_reason: null,
    })
    .eq("id", params.documentId);
  if (updateError) {
    return {
      status: "failed",
      chunkCount: rows.length,
      pageCount: extraction.pageCount,
      failureReason: "Could not finalize indexing.",
    };
  }

  return {
    status: "indexed",
    chunkCount: rows.length,
    pageCount: extraction.pageCount,
    failureReason: null,
  };
}

async function markFailed(
  supabase: SupabaseClient<Database>,
  documentId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("engineering_documents")
    .update({ status: "failed", failure_reason: reason })
    .eq("id", documentId);
}
