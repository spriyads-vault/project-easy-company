import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractDocumentText } from "./extract-text";

async function buildTestPdf(pageTexts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage();
    if (text) {
      page.drawText(text, { x: 50, y: 700, size: 14, font });
    }
  }
  return doc.save();
}

describe("extractDocumentText — PDF", () => {
  it("extracts text per page with 1-indexed page numbers (positive case)", async () => {
    const pdf = await buildTestPdf(["Page one about the 40 MHz clock.", "Page two about 200 MHz."]);
    const result = await extractDocumentText(pdf, "application/pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toMatchObject({ pageNumber: 1 });
    expect(result.pages[0].text).toContain("40 MHz clock");
    expect(result.pages[1]).toMatchObject({ pageNumber: 2 });
    expect(result.pages[1].text).toContain("200 MHz");
  });

  it("reports a clear failure for a PDF with no extractable text, rather than pretending it was indexed (failed extraction case)", async () => {
    const pdf = await buildTestPdf(["", ""]);
    const result = await extractDocumentText(pdf, "application/pdf");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no extractable text/i);
    expect(result.reason).toMatch(/ocr/i);
  });

  it("reports a clear failure for corrupt/unreadable PDF bytes (negative case)", async () => {
    const result = await extractDocumentText(
      new TextEncoder().encode("this is not a pdf"),
      "application/pdf",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/could not read this pdf/i);
  });
});

describe("extractDocumentText — plain text", () => {
  it("extracts a .txt file as a single page with no page number (positive case)", async () => {
    const bytes = new TextEncoder().encode("The system clock runs at 40 MHz.");
    const result = await extractDocumentText(bytes, "text/plain");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pageCount).toBeNull();
    expect(result.pages).toEqual([{ pageNumber: null, text: "The system clock runs at 40 MHz." }]);
  });

  it("reports a clear failure for an empty text file (boundary case)", async () => {
    const result = await extractDocumentText(new TextEncoder().encode("   "), "text/plain");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/empty/i);
  });
});

describe("extractDocumentText — Markdown", () => {
  it("extracts a .md file as a single page, headings included as raw text for the chunker to interpret", async () => {
    const bytes = new TextEncoder().encode("# Title\nSome content.");
    const result = await extractDocumentText(bytes, "text/markdown");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pages[0].text).toBe("# Title\nSome content.");
    expect(result.pageCount).toBeNull();
  });
});
