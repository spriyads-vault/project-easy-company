import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordEngineeringChangeForm } from "./record-engineering-change-form";
import * as actions from "./actions";

vi.mock("./actions", () => ({
  recordEngineeringChange: vi.fn(),
}));

const mockedAction = vi.mocked(actions.recordEngineeringChange);

const defaultProps = {
  caseId: "case-1",
  productId: "product-1",
  fromRevisionId: "revision-17",
  currentRevisionLabel: "Rev17",
};

describe("RecordEngineeringChangeForm", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("starts collapsed behind an obvious action (not an open chatbot textarea)", () => {
    render(<RecordEngineeringChangeForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Record engineering change" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("exposes the structured fields the ticket asks for, with a suggested next revision label", () => {
    render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    expect(screen.getByLabelText("Title")).toBeRequired();
    expect(screen.getByLabelText("Description")).toBeRequired();
    expect(screen.getByLabelText("Affected subsystem")).toBeInTheDocument();
    expect(screen.getByLabelText(/Previous value/)).toBeInTheDocument();
    expect(screen.getByLabelText(/New value/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/)).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    // Rev17 -> Rev18 is suggested, never silently assumed.
    expect(screen.getByLabelText("New revision label")).toHaveValue("Rev18");
  });

  it("submits the bound action with caseId/productId/fromRevisionId, and shows the new revision on success", async () => {
    mockedAction.mockResolvedValue({ success: true, newRevisionLabel: "Rev18" });
    render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Display termination changed" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Terminated the display data line to reduce coupling." },
    });
    fireEvent.change(screen.getByLabelText("Affected subsystem"), {
      target: { value: "Display path" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    await waitFor(() =>
      expect(screen.getByText(/Rev17.*Rev18.*created/)).toBeInTheDocument(),
    );
    expect(mockedAction).toHaveBeenCalledTimes(1);
    // .bind(null, caseId, productId, fromRevisionId) — the mock still
    // receives all five arguments: (caseId, productId, fromRevisionId,
    // prevState, formData).
    expect(mockedAction.mock.calls[0][0]).toBe("case-1");
    expect(mockedAction.mock.calls[0][1]).toBe("product-1");
    expect(mockedAction.mock.calls[0][2]).toBe("revision-17");
    const formDataArg = mockedAction.mock.calls[0][4] as FormData;
    expect(formDataArg.get("title")).toBe("Display termination changed");
    expect(formDataArg.get("affectedSubsystem")).toBe("Display path");
    expect(formDataArg.get("newRevisionLabel")).toBe("Rev18");
  });

  it("shows a server-reported error without losing the form", async () => {
    mockedAction.mockResolvedValue({ error: "Could not create the new revision." });
    render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test." } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test." } });
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not create the new revision.");
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("disables the submit button while pending, protecting against a duplicate submission", async () => {
    let resolveAction!: (value: { success: boolean; newRevisionLabel: string }) => void;
    mockedAction.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test." } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test." } });

    const submitButton = screen.getByRole("button", { name: "Record engineering change" });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));

    resolveAction({ success: true, newRevisionLabel: "Rev18" });
    await waitFor(() => expect(screen.getByText(/created/)).toBeInTheDocument());
  });

  it("keeps showing the pre-submission from-label in the success message even after revalidatePath refreshes currentRevisionLabel to the new revision (regression: caught live)", async () => {
    mockedAction.mockResolvedValue({ success: true, newRevisionLabel: "Rev18" });
    const { rerender } = render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Test." } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test." } });
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    // Simulates the parent server component re-rendering after
    // revalidatePath, before this component's own success state settles —
    // the exact ordering that produced "Rev18 → Rev18" in a live walkthrough.
    rerender(<RecordEngineeringChangeForm {...defaultProps} currentRevisionLabel="Rev18" />);

    await waitFor(() =>
      expect(screen.getByText("Engineering change recorded. Rev17 → Rev18 created.")).toBeInTheDocument(),
    );
  });

  it("lets the engineer cancel back to the collapsed state without submitting", () => {
    render(<RecordEngineeringChangeForm {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));
    expect(screen.getByLabelText("Title")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(mockedAction).not.toHaveBeenCalled();
  });
});
