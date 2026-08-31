import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { UploadDocumentFormState } from "./actions";

const { uploadEngineeringDocument } = vi.hoisted(() => ({
  uploadEngineeringDocument: vi.fn<
    (prevState: UploadDocumentFormState, formData: FormData) => Promise<UploadDocumentFormState>
  >(),
}));

vi.mock("./actions", () => ({ uploadEngineeringDocument }));

const { UploadForm } = await import("./upload-form");

describe("UploadForm", () => {
  it("renders a file input restricted to PDF/TXT/Markdown and a document type selector (upload)", () => {
    render(<UploadForm />);
    const fileInput = screen.getByLabelText(/file \(pdf, txt, or markdown\)/i);
    expect(fileInput).toHaveAttribute("accept", expect.stringContaining("application/pdf"));
    expect(screen.getByLabelText(/document type/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("shows a success status once the action reports success", async () => {
    uploadEngineeringDocument.mockResolvedValueOnce({ success: true });
    render(<UploadForm />);

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/file \(pdf, txt, or markdown\)/i), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText(/document type/i), {
      target: { value: "engineering_note" },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/uploaded/i);
    });
  });

  it("shows the action's error message rather than a generic failure (failed extraction surfaced to the user)", async () => {
    uploadEngineeringDocument.mockResolvedValueOnce({ error: "Choose a file to upload." });
    render(<UploadForm />);

    fireEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Choose a file to upload.");
    });
  });
});
