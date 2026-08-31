import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SearchDocumentsFormState } from "./actions";

const { searchDocumentsAction } = vi.hoisted(() => ({
  searchDocumentsAction: vi.fn<
    (prevState: SearchDocumentsFormState, formData: FormData) => Promise<SearchDocumentsFormState>
  >(),
}));

vi.mock("./actions", () => ({ searchDocumentsAction }));

const { SearchPanel } = await import("./search-panel");

const clockResult = {
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
};

async function submitQuery(query: string) {
  fireEvent.change(screen.getByPlaceholderText(/40 mhz clock shielding/i), {
    target: { value: query },
  });
  fireEvent.click(screen.getByRole("button", { name: /search/i }));
}

describe("SearchPanel", () => {
  it("renders a search box with no results before any query is run", () => {
    render(<SearchPanel />);
    expect(screen.getByPlaceholderText(/40 mhz clock shielding/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /searching/i })).not.toBeInTheDocument();
  });

  it("shows results after a search (hybrid retrieval surfaced in the UI)", async () => {
    searchDocumentsAction.mockResolvedValueOnce({
      query: "40 MHz clock",
      results: [clockResult],
    });
    render(<SearchPanel />);

    await submitQuery("40 MHz clock");

    await waitFor(() => {
      expect(screen.getByText("EMC-Test-04.pdf")).toBeInTheDocument();
    });
  });

  it("shows the source preview only after a result is selected (source preview)", async () => {
    searchDocumentsAction.mockResolvedValueOnce({
      query: "40 MHz clock",
      results: [clockResult],
    });
    render(<SearchPanel />);
    await submitQuery("40 MHz clock");
    await waitFor(() => expect(screen.getByText("EMC-Test-04.pdf")).toBeInTheDocument());

    expect(screen.queryByLabelText("Source preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /EMC-Test-04\.pdf/i }));

    expect(screen.getByLabelText("Source preview")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) => el?.tagName.toLowerCase() === "p" && el.textContent === clockResult.passage,
      ),
    ).toBeInTheDocument();
  });

  it("shows a clear empty-results message for a query with no matches (negative case)", async () => {
    searchDocumentsAction.mockResolvedValueOnce({ query: "quantum blockchain", results: [] });
    render(<SearchPanel />);

    await submitQuery("quantum blockchain");

    await waitFor(() => {
      expect(screen.getByText(/no matching passages found/i)).toBeInTheDocument();
    });
  });

  it("clears a stale preview when a new search no longer includes the previously selected result (state handling)", async () => {
    searchDocumentsAction.mockResolvedValueOnce({
      query: "40 MHz clock",
      results: [clockResult],
    });
    render(<SearchPanel />);
    await submitQuery("40 MHz clock");
    await waitFor(() => expect(screen.getByText("EMC-Test-04.pdf")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /EMC-Test-04\.pdf/i }));
    expect(screen.getByLabelText("Source preview")).toBeInTheDocument();

    searchDocumentsAction.mockResolvedValueOnce({ query: "cable shielding", results: [] });
    await submitQuery("cable shielding");

    await waitFor(() => {
      expect(screen.queryByLabelText("Source preview")).not.toBeInTheDocument();
    });
  });
});
