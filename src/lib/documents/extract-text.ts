// Text extraction, narrow on purpose (CLAUDE.md MVP scope: PDF/TXT/Markdown
// only, no OCR, no CAD parsing). A PDF with no extractable text (scanned/
// image-only) is reported as a clear failure, never silently indexed with
// zero content — see docs/PROGRESS.md and CLAUDE.md "Product truth: never
// pretend it was indexed."
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { SupportedDocumentMimeType } from "@/lib/domain/schema";

export interface ExtractedPage {
  /** 1-indexed. Null for formats with no page concept (plain text). */
  pageNumber: number | null;
  text: string;
}

export interface TextExtractionSuccess {
  ok: true;
  pages: ExtractedPage[];
  pageCount: number | null;
}

export interface TextExtractionFailure {
  ok: false;
  reason: string;
}

export type TextExtractionResult = TextExtractionSuccess | TextExtractionFailure;

export async function extractDocumentText(
  buffer: Uint8Array,
  mimeType: SupportedDocumentMimeType,
): Promise<TextExtractionResult> {
  switch (mimeType) {
    case "application/pdf":
      return extractFromPdf(buffer);
    case "text/plain":
    case "text/markdown":
      return extractFromPlainText(buffer);
  }
}

async function extractFromPdf(buffer: Uint8Array): Promise<TextExtractionResult> {
  let totalPages: number;
  let text: string[];
  try {
    const pdf = await getDocumentProxy(buffer);
    const extracted = await extractPdfText(pdf, { mergePages: false });
    totalPages = extracted.totalPages;
    text = extracted.text;
  } catch {
    return {
      ok: false,
      reason: "Could not read this PDF — it may be corrupted or password-protected.",
    };
  }

  const pages = text.map((pageText, index) => ({ pageNumber: index + 1, text: pageText }));
  const hasExtractableText = pages.some((page) => page.text.trim().length > 0);
  if (!hasExtractableText) {
    return {
      ok: false,
      reason:
        "No extractable text found in this PDF — it's likely scanned/image-only and needs OCR, which isn't supported yet.",
    };
  }

  return { ok: true, pages, pageCount: totalPages };
}

function extractFromPlainText(buffer: Uint8Array): TextExtractionResult {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (text.trim().length === 0) {
    return { ok: false, reason: "This file is empty." };
  }
  return { ok: true, pages: [{ pageNumber: null, text }], pageCount: null };
}
