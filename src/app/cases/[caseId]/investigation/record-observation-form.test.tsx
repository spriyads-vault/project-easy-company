import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordObservationForm } from "./record-observation-form";
import * as actions from "./actions";

vi.mock("./actions", () => ({
  recordInvestigationObservation: vi.fn(),
}));

const mockedAction = vi.mocked(actions.recordInvestigationObservation);

describe("RecordObservationForm", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("starts collapsed behind an obvious 'Record result' action (not an open chatbot textarea)", () => {
    render(<RecordObservationForm caseId="case-1" />);
    expect(screen.getByRole("button", { name: "Record result" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Observation")).not.toBeInTheDocument();
  });

  it("exposes the four structured fields the ticket asks for, with labels (accessibility)", () => {
    render(<RecordObservationForm caseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    expect(screen.getByLabelText("Observation")).toBeRequired();
    expect(screen.getByLabelText(/Measurement change/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Operating mode/)).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("submits the bound action with caseId, and shows a confirmation on success", async () => {
    mockedAction.mockResolvedValue({ success: true });
    render(<RecordObservationForm caseId="case-42" />);
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    fireEvent.change(screen.getByLabelText("Observation"), {
      target: { value: "Display path disconnected." },
    });
    fireEvent.change(screen.getByLabelText(/Measurement change/), {
      target: { value: "Peak dropped 9 dB." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    await waitFor(() => expect(screen.getByText("Observation recorded.")).toBeInTheDocument());
    expect(mockedAction).toHaveBeenCalledTimes(1);
    // .bind(null, caseId) means the mock itself still receives all three
    // arguments: (caseId, prevState, formData).
    expect(mockedAction.mock.calls[0][0]).toBe("case-42");
    const formDataArg = mockedAction.mock.calls[0][2] as FormData;
    expect(formDataArg.get("observation")).toBe("Display path disconnected.");
    expect(formDataArg.get("measurementChange")).toBe("Peak dropped 9 dB.");
  });

  it("shows a server-reported error without losing the form (e.g. not signed in)", async () => {
    mockedAction.mockResolvedValue({ error: "Could not save the observation." });
    render(<RecordObservationForm caseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    fireEvent.change(screen.getByLabelText("Observation"), { target: { value: "Test." } });
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not save the observation.");
    // The form itself is still there — no destructive collapse on error.
    expect(screen.getByLabelText("Observation")).toBeInTheDocument();
  });

  it("disables the submit button while pending, protecting against a duplicate submission", async () => {
    let resolveAction!: (value: { success: boolean }) => void;
    mockedAction.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    render(<RecordObservationForm caseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    fireEvent.change(screen.getByLabelText("Observation"), { target: { value: "Test." } });

    const submitButton = screen.getByRole("button", { name: "Record result" });
    fireEvent.click(submitButton);
    // A disabled button doesn't dispatch a second click in a real browser
    // (and jsdom matches that behavior) — this is what actually prevents
    // the duplicate submission, not just a visual affordance.
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));

    resolveAction({ success: true });
    await waitFor(() => expect(screen.getByText("Observation recorded.")).toBeInTheDocument());
  });

  it("lets the engineer cancel back to the collapsed state without submitting", () => {
    render(<RecordObservationForm caseId="case-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    expect(screen.getByLabelText("Observation")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Observation")).not.toBeInTheDocument();
    expect(mockedAction).not.toHaveBeenCalled();
  });
});
