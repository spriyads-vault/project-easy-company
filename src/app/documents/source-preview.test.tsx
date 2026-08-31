import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EngineeringDocumentPassage } from "@/lib/documents/search";
import { SourcePreview } from "./source-preview";

function passage(overrides: Partial<EngineeringDocumentPassage> = {}): EngineeringDocumentPassage {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    filename: "EMC-Test-04.pdf",
    documentType: "test_report",
    pageNumber: 4,
    section: null,
    passage: "The 40 MHz system clock is the primary suspect for the 200 MHz emission.",
    keywordScore: 0.5,
    semanticScore: 0.8,
    relevanceScore: 0.65,
    ...overrides,
  };
}

describe("SourcePreview", () => {
  it("shows the document name, page, and full passage (source preview)", () => {
    render(<SourcePreview passage={passage()} query="40 MHz clock" />);
    expect(screen.getByText("EMC-Test-04.pdf")).toBeInTheDocument();
    expect(screen.getByText("Page 4")).toBeInTheDocument();
    // The passage renders as several highlight spans/marks, not one text
    // node — assert on the paragraph's full concatenated text instead.
    expect(
      screen.getByText(
        (_, el) => el?.tagName.toLowerCase() === "p" && el.textContent === passage().passage,
      ),
    ).toBeInTheDocument();
  });

  it("shows page and section together when both are present", () => {
    render(<SourcePreview passage={passage({ pageNumber: 2, section: "Results" })} query="clock" />);
    expect(screen.getByText("Page 2 · Results")).toBeInTheDocument();
  });

  it("shows the section alone for a Markdown-sourced passage with no page (positive case)", () => {
    render(<SourcePreview passage={passage({ pageNumber: null, section: "Findings" })} query="clock" />);
    expect(screen.getByText("Findings")).toBeInTheDocument();
  });

  it("shows a clear fallback when neither page nor section is available", () => {
    render(<SourcePreview passage={passage({ pageNumber: null, section: null })} query="clock" />);
    expect(screen.getByText(/no page\/section metadata/i)).toBeInTheDocument();
  });

  it("highlights the query terms within the passage without altering the underlying text", () => {
    render(<SourcePreview passage={passage()} query="40 MHz" />);
    const marks = screen.getAllByText(/^(40|MHz)$/i, { selector: "mark" });
    expect(marks.length).toBeGreaterThan(0);
    // The full passage text is still present and unmodified.
    expect(
      screen.getByText((_, el) => el?.tagName.toLowerCase() === "p" && el.textContent === passage().passage),
    ).toBeInTheDocument();
  });

  it("does not highlight anything for a blank query (negative case)", () => {
    render(<SourcePreview passage={passage()} query="" />);
    expect(screen.queryByText("40", { selector: "mark" })).not.toBeInTheDocument();
  });

  it("does not crash on a query containing regex special characters (security/boundary case)", () => {
    expect(() => render(<SourcePreview passage={passage()} query="clock (40MHz)?" />)).not.toThrow();
  });
});
