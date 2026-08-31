import { describe, expect, it } from "vitest";
import { chunkDocumentPages } from "./chunk-text";
import type { ExtractedPage } from "./extract-text";

describe("chunkDocumentPages", () => {
  it("preserves page-number provenance across chunks (positive case)", () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: "First page content about the 40 MHz clock." },
      { pageNumber: 2, text: "Second page content about the measured 200 MHz peak." },
    ];
    const chunks = chunkDocumentPages(pages);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      pageNumber: 1,
      section: null,
      content: "First page content about the 40 MHz clock.",
    });
    expect(chunks[1]).toMatchObject({
      chunkIndex: 1,
      pageNumber: 2,
      content: "Second page content about the measured 200 MHz peak.",
    });
  });

  it("greedily merges short paragraphs on the same page into one chunk, but starts a fresh chunk on the next page", () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: "Paragraph A.\n\nParagraph B." },
      { pageNumber: 2, text: "Paragraph C." },
    ];
    const chunks = chunkDocumentPages(pages);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]).toMatchObject({ pageNumber: 1, content: "Paragraph A.\n\nParagraph B." });
    expect(chunks[1]).toMatchObject({ pageNumber: 2, content: "Paragraph C." });
  });

  it("tracks Markdown headings as the section for chunks that follow (positive case)", () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: null,
        text: "# Introduction\nThis document covers the test setup.\n\n## Results\nThe peak measured 200 MHz.",
      },
    ];
    const chunks = chunkDocumentPages(pages, { markdown: true });

    expect(chunks[0]).toMatchObject({
      section: "Introduction",
      content: "This document covers the test setup.",
    });
    expect(chunks[1]).toMatchObject({
      section: "Results",
      content: "The peak measured 200 MHz.",
    });
  });

  it("does not treat a '#' line as a heading when markdown option is off (negative case)", () => {
    const pages: ExtractedPage[] = [{ pageNumber: 1, text: "# Not a heading here" }];
    const chunks = chunkDocumentPages(pages, { markdown: false });
    expect(chunks[0].section).toBeNull();
    expect(chunks[0].content).toBe("# Not a heading here");
  });

  it("returns no chunks for a page with only whitespace (missing-data case)", () => {
    const pages: ExtractedPage[] = [{ pageNumber: 1, text: "   \n\n  " }];
    expect(chunkDocumentPages(pages)).toEqual([]);
  });

  it("splits a paragraph run into multiple chunks once it exceeds the target size (boundary case)", () => {
    const longParagraph = "word ".repeat(250); // ~1250 chars, over the 1000-char target
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: `Intro sentence.\n\n${longParagraph}\n\nClosing sentence.` },
    ];
    const chunks = chunkDocumentPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk still carries the page it came from.
    expect(chunks.every((c) => c.pageNumber === 1)).toBe(true);
  });

  it("carries the last heading forward onto a later page (no explicit reset per page)", () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: "## Test Setup\nDescribed on page 1." },
      { pageNumber: 2, text: "Continues describing the setup on page 2." },
    ];
    const chunks = chunkDocumentPages(pages, { markdown: true });
    expect(chunks[0].section).toBe("Test Setup");
    expect(chunks[1].section).toBe("Test Setup");
    expect(chunks[1].pageNumber).toBe(2);
  });
});
