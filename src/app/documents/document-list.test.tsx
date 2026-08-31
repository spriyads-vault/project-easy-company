import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DocumentListItem } from "@/lib/documents/queries";
import { DocumentList } from "./document-list";

function doc(overrides: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "Gateway-X-Schematic.pdf",
    documentType: "schematic",
    status: "indexed",
    pageCount: 12,
    uploadedAt: "2026-08-31T00:00:00.000Z",
    indexedAt: "2026-08-31T00:01:00.000Z",
    failureReason: null,
    productId: null,
    productRevisionId: null,
    isCurrent: true,
    ...overrides,
  };
}

describe("DocumentList", () => {
  it("shows an empty state with no fabricated count when there are no documents (missing-data / refresh state case)", () => {
    render(<DocumentList documents={[]} page={1} pageSize={25} totalCount={0} />);
    expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument();
  });

  it("renders each of the four real statuses distinctly (UPLOADING/PROCESSING/INDEXED/FAILED)", () => {
    render(
      <DocumentList
        documents={[
          doc({ id: "1", filename: "a.pdf", status: "uploading" }),
          doc({ id: "2", filename: "b.pdf", status: "processing" }),
          doc({ id: "3", filename: "c.pdf", status: "indexed" }),
          doc({ id: "4", filename: "d.pdf", status: "failed", failureReason: "No extractable text." }),
        ]}
        page={1}
        pageSize={25}
        totalCount={4}
      />,
    );

    expect(screen.getByText("UPLOADING")).toBeInTheDocument();
    expect(screen.getByText("PROCESSING")).toBeInTheDocument();
    expect(screen.getByText("INDEXED")).toBeInTheDocument();
    expect(screen.getByText("FAILED")).toBeInTheDocument();
    expect(screen.getByText("No extractable text.")).toBeInTheDocument();
  });

  it("shows the real page count where available, and omits it where it isn't", () => {
    render(
      <DocumentList
        documents={[
          doc({ id: "1", filename: "with-pages.pdf", pageCount: 5 }),
          doc({ id: "2", filename: "no-pages.txt", pageCount: null }),
        ]}
        page={1}
        pageSize={25}
        totalCount={2}
      />,
    );
    expect(screen.getByText(/schematic · 5 pages/i)).toBeInTheDocument();
    expect(screen.queryByText(/no-pages.*pages/i)).not.toBeInTheDocument();
  });

  it("shows pagination controls only when there is more than one page, with real page numbers", () => {
    const { rerender } = render(
      <DocumentList documents={[doc()]} page={1} pageSize={25} totalCount={1} />,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    rerender(<DocumentList documents={[doc()]} page={2} pageSize={25} totalCount={60} />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/documents?page=1",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/documents?page=3",
    );
  });

  it("disables Previous on the first page and Next on the last page (boundary cases)", () => {
    const { rerender } = render(
      <DocumentList documents={[doc()]} page={1} pageSize={25} totalCount={60} />,
    );
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();

    rerender(<DocumentList documents={[doc()]} page={3} pageSize={25} totalCount={60} />);
    expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
  });

  it("marks a superseded document as historical", () => {
    render(
      <DocumentList
        documents={[doc({ isCurrent: false })]}
        page={1}
        pageSize={25}
        totalCount={1}
      />,
    );
    expect(screen.getByText(/historical/i)).toBeInTheDocument();
  });
});
