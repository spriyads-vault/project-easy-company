// Integration test: the real extract -> chunk -> embed -> store -> mark
// indexed pipeline against real Postgres/RLS (local Supabase). No real
// Anthropic call and no real embedding API call — the embedder is a local,
// zero-dependency function (src/lib/documents/embedding.ts), so nothing
// here needs a fake adapter the way MVP-07/08 did. Run with
// `pnpm test:integration`.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ingestDocument } from "./ingest-document";
import {
  createAdminClient,
  createConfirmedUser,
} from "./integration-test-helpers";

async function buildTestPdf(pageTexts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage();
    if (text) page.drawText(text, { x: 50, y: 700, size: 14, font });
  }
  return doc.save();
}

async function insertDocumentRow(
  db: SupabaseClient<Database>,
  overrides: { filename: string; mimeType: string; byteSize?: number },
): Promise<string> {
  const { data, error } = await db
    .from("engineering_documents")
    .insert({
      filename: overrides.filename,
      document_type: "test_report",
      mime_type: overrides.mimeType,
      byte_size: overrides.byteSize ?? 100,
      storage_path: `x/x/${overrides.filename}`,
      status: "processing",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("no document row");
  return data.id;
}

describe("ingestDocument", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    userA = await createConfirmedUser(admin, `ingest-a-${Date.now()}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
  });

  it("indexes a PDF: chunks are stored with page provenance and a real embedding (positive case)", async () => {
    const pdfBytes = await buildTestPdf([
      "Page one: the 40 MHz system clock drives the display controller.",
      "Page two: measured 200 MHz at 7.4 dB over the Class B limit.",
    ]);
    const documentId = await insertDocumentRow(userA.client, {
      filename: "test-report.pdf",
      mimeType: "application/pdf",
    });

    const result = await ingestDocument(userA.client, {
      documentId,
      buffer: pdfBytes,
      mimeType: "application/pdf",
    });

    expect(result).toMatchObject({ status: "indexed", pageCount: 2 });
    expect(result.chunkCount).toBeGreaterThan(0);

    const { data: doc } = await userA.client
      .from("engineering_documents")
      .select("status, page_count, indexed_at, failure_reason")
      .eq("id", documentId)
      .single();
    expect(doc).toMatchObject({ status: "indexed", page_count: 2, failure_reason: null });
    expect(doc?.indexed_at).not.toBeNull();

    const { data: chunks } = await userA.client
      .from("document_chunks")
      .select("chunk_index, page_number, content, embedding")
      .eq("document_id", documentId)
      .order("chunk_index");
    expect(chunks!.length).toBeGreaterThan(0);
    expect(chunks![0].page_number).toBe(1);
    expect(chunks![0].content).toContain("40 MHz system clock");
    // pgvector returns the stored vector as its bracketed text literal.
    expect(chunks![0].embedding).toMatch(/^\[.*\]$/);
  });

  it("indexes a Markdown file with section provenance from its headings", async () => {
    const documentId = await insertDocumentRow(userA.client, {
      filename: "notes.md",
      mimeType: "text/markdown",
    });
    const bytes = new TextEncoder().encode("# Findings\nThe clock harmonic aligns with the peak.");

    const result = await ingestDocument(userA.client, {
      documentId,
      buffer: bytes,
      mimeType: "text/markdown",
    });

    expect(result.status).toBe("indexed");
    const { data: chunks } = await userA.client
      .from("document_chunks")
      .select("section, page_number")
      .eq("document_id", documentId);
    expect(chunks![0]).toMatchObject({ section: "Findings", page_number: null });
  });

  it("marks a PDF with no extractable text as failed, with a clear reason — never pretends it was indexed (failed extraction case)", async () => {
    const pdfBytes = await buildTestPdf(["", ""]);
    const documentId = await insertDocumentRow(userA.client, {
      filename: "scanned.pdf",
      mimeType: "application/pdf",
    });

    const result = await ingestDocument(userA.client, {
      documentId,
      buffer: pdfBytes,
      mimeType: "application/pdf",
    });

    expect(result.status).toBe("failed");
    expect(result.failureReason).toMatch(/ocr/i);

    const { data: doc } = await userA.client
      .from("engineering_documents")
      .select("status, failure_reason")
      .eq("id", documentId)
      .single();
    expect(doc?.status).toBe("failed");
    expect(doc?.failure_reason).toMatch(/ocr/i);

    const { data: chunks } = await userA.client
      .from("document_chunks")
      .select("id")
      .eq("document_id", documentId);
    expect(chunks).toEqual([]);
  });

  it("re-ingesting the same document replaces chunks rather than duplicating them (idempotent retry)", async () => {
    const documentId = await insertDocumentRow(userA.client, {
      filename: "retry.txt",
      mimeType: "text/plain",
    });
    const bytes = new TextEncoder().encode("Original content about the clock.");

    await ingestDocument(userA.client, { documentId, buffer: bytes, mimeType: "text/plain" });
    const firstCount = (
      await userA.client.from("document_chunks").select("id").eq("document_id", documentId)
    ).data!.length;

    const secondResult = await ingestDocument(userA.client, {
      documentId,
      buffer: bytes,
      mimeType: "text/plain",
    });
    const secondCount = (
      await userA.client.from("document_chunks").select("id").eq("document_id", documentId)
    ).data!.length;

    expect(secondResult.status).toBe("indexed");
    expect(secondCount).toBe(firstCount);
  });
});
