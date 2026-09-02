import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as caseComposerActions from "./actions";
import * as measurementActions from "../actions";
import { CaseComposer } from "./case-composer";
import type { MeasurementRow } from "@/lib/cases/queries";

vi.mock("./actions", () => ({
  recordInvestigationObservation: vi.fn(),
  recordEngineeringChange: vi.fn(),
}));
vi.mock("../actions", () => ({
  createMeasurement: vi.fn(),
}));

const mockedObservation = vi.mocked(caseComposerActions.recordInvestigationObservation);
const mockedChange = vi.mocked(caseComposerActions.recordEngineeringChange);
const mockedMeasurement = vi.mocked(measurementActions.createMeasurement);

const priorMeasurement: MeasurementRow = {
  id: "measurement-1",
  label: null,
  operatingMode: "WiFi TX + display active",
  notes: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  productRevisionId: "revision-17",
  revisionLabel: "Rev17",
  peaks: [{ id: "peak-1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
};

const defaultProps = {
  caseId: "case-1",
  productId: "product-1",
  revisionId: "revision-17",
  currentRevisionLabel: "Rev17",
  measurement: priorMeasurement,
};

async function typeAndSend(text: string) {
  const input = screen.getByLabelText("Tell Crado what changed, attach a result, or ask about this case");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("CaseComposer — intent classification", () => {
  beforeEach(() => {
    mockedObservation.mockReset();
    mockedChange.mockReset();
    mockedMeasurement.mockReset();
  });

  it("classifies the ticket's engineering-change worked example and shows the editable change fields (successful classification)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Changed the display termination and created Rev18.");

    const group = screen.getByRole("group", { name: "Crado understood this as" });
    expect(within(group).getByRole("button", { name: "Engineering change" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Title")).toHaveValue("Changed the display termination");
    expect(screen.getByLabelText("New revision label")).toHaveValue("Rev18");
  });

  it("classifies the ticket's measurement worked example and shows the editable measurement fields (successful classification)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Retested Rev18. 200 MHz is now 3.6 dB below the limit.");

    const group = screen.getByRole("group", { name: "Crado understood this as" });
    expect(within(group).getByRole("button", { name: "Measurement" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Frequency (MHz)")).toHaveValue(200);
    expect(screen.getByLabelText("Margin (dB vs. limit)")).toHaveValue(-3.6);
  });

  it("classifies a delta-phrased sentence as an observation, not a measurement (successful classification)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Disconnected the display cable. The 200 MHz peak dropped 9 dB.");

    const group = screen.getByRole("group", { name: "Crado understood this as" });
    expect(within(group).getByRole("button", { name: "Observation" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("The 200 MHz peak dropped 9 dB.", { exact: false })).toBeInTheDocument();
  });

  it("still shows a full 3-way switcher for a low-confidence classification, and lets the engineer switch it (ambiguous input)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Retested. 200 MHz, -3.6 dB.");

    const group = screen.getByRole("group", { name: "Crado understood this as" });
    expect(within(group).getByRole("button", { name: "Measurement" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(group).getByRole("button", { name: "Observation" }));
    expect(within(group).getByRole("button", { name: "Observation" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Retested. 200 MHz, -3.6 dB.")).toBeInTheDocument();
  });

  it("requires title, description, and new revision label for an engineering change (missing-data case)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Replaced the ferrite on the display cable, creating Rev18.");

    expect(screen.getByLabelText("Title")).toBeRequired();
    expect(screen.getByLabelText("Description")).toBeRequired();
    expect(screen.getByLabelText("New revision label")).toBeRequired();
    // No revision named in the text — a suggestion is shown, not left blank
    // or silently assumed, and the engineer can still edit it.
    expect(screen.getByLabelText("New revision label")).toHaveValue("Rev18");
  });

  it("requires frequency, margin, and operating mode for a measurement, leaving an unread field empty rather than guessed (missing-data case)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Retested Rev18. 200 MHz is now 3.6 dB below the limit.");

    expect(screen.getByLabelText("Frequency (MHz)")).toBeRequired();
    expect(screen.getByLabelText("Margin (dB vs. limit)")).toBeRequired();
    // Operating mode was never mentioned in the text — left empty, not
    // invented, but still a required field before submitting.
    expect(screen.getByLabelText("Operating mode")).toBeRequired();
    expect(screen.getByLabelText("Operating mode")).toHaveValue("");
  });

  it("does not submit anything for empty/whitespace-only input (missing-data case)", () => {
    render(<CaseComposer {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("returns to compose without losing the typed draft when the engineer cancels (cancellation)", async () => {
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Changed the display termination and created Rev18.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByLabelText("Tell Crado what changed, attach a result, or ask about this case"),
    ).toHaveValue("Changed the display termination and created Rev18.");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});

describe("CaseComposer — confirmation and persistence", () => {
  beforeEach(() => {
    mockedObservation.mockReset();
    mockedChange.mockReset();
    mockedMeasurement.mockReset();
  });

  it("confirms an observation, calling the bound action and the live-update callback with the verbatim text", async () => {
    mockedObservation.mockResolvedValue({ success: true });
    const onObservationRecorded = vi.fn();
    render(<CaseComposer {...defaultProps} onObservationRecorded={onObservationRecorded} />);
    await typeAndSend("Disconnected the display cable. The 200 MHz peak dropped 9 dB.");
    fireEvent.click(screen.getByRole("button", { name: "Add to investigation" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added to the investigation."));
    expect(mockedObservation).toHaveBeenCalledTimes(1);
    expect(mockedObservation.mock.calls[0][0]).toBe("case-1");
    expect(onObservationRecorded).toHaveBeenCalledWith({
      observation: "Disconnected the display cable. The 200 MHz peak dropped 9 dB.",
      measurementChange: "-9 dB",
    });
  });

  it("confirms a measurement, submits it against the current revision, and reports a real before/after delta (confirmation)", async () => {
    mockedMeasurement.mockResolvedValue({ success: true });
    const onMeasurementRecorded = vi.fn();
    render(<CaseComposer {...defaultProps} onMeasurementRecorded={onMeasurementRecorded} />);
    await typeAndSend("Retested Rev18. 200 MHz is now 3.6 dB below the limit.");
    fireEvent.change(screen.getByLabelText("Operating mode"), { target: { value: "WiFi TX + display active" } });
    fireEvent.click(screen.getByRole("button", { name: "Add measurement" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Measurement added — 11.0 dB improvement."),
    );
    expect(mockedMeasurement).toHaveBeenCalledTimes(1);
    // .bind(null, caseId, revisionId) — the current revision, matching
    // AddMeasurementForm's own binding.
    expect(mockedMeasurement.mock.calls[0][0]).toBe("case-1");
    expect(mockedMeasurement.mock.calls[0][1]).toBe("revision-17");
    const formData = mockedMeasurement.mock.calls[0][3] as FormData;
    expect(formData.get("frequencyMhz")).toBe("200");
    expect(formData.get("marginDb")).toBe("-3.6");
    expect(onMeasurementRecorded).toHaveBeenCalledWith(
      expect.objectContaining({ deltaDb: 11, improved: true, sameFrequency: true }),
    );
  });

  it("confirms an engineering change and calls the action with caseId/productId/fromRevisionId (confirmation)", async () => {
    mockedChange.mockResolvedValue({ success: true, newRevisionLabel: "Rev18" });
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Changed the display termination and created Rev18.");
    fireEvent.click(screen.getByRole("button", { name: "Record engineering change" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Engineering change recorded. Rev17 → Rev18 created."),
    );
    expect(mockedChange).toHaveBeenCalledTimes(1);
    expect(mockedChange.mock.calls[0][0]).toBe("case-1");
    expect(mockedChange.mock.calls[0][1]).toBe("product-1");
    expect(mockedChange.mock.calls[0][2]).toBe("revision-17");
    const formData = mockedChange.mock.calls[0][4] as FormData;
    expect(formData.get("title")).toBe("Changed the display termination");
    expect(formData.get("newRevisionLabel")).toBe("Rev18");
  });

  it("shows a server-reported error without discarding the form (failure state)", async () => {
    mockedObservation.mockResolvedValue({ error: "Could not save the observation." });
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Disconnected the display cable. The 200 MHz peak dropped 9 dB.");
    fireEvent.click(screen.getByRole("button", { name: "Add to investigation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not save the observation.");
    expect(screen.getByRole("button", { name: "Add to investigation" })).toBeInTheDocument();
  });

  it("disables the submit and intent-switcher controls while a submission is pending (duplicate-submission protection)", async () => {
    let resolveAction: (value: { success: boolean }) => void = () => {};
    mockedObservation.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    render(<CaseComposer {...defaultProps} />);
    await typeAndSend("Disconnected the display cable. The 200 MHz peak dropped 9 dB.");
    fireEvent.click(screen.getByRole("button", { name: "Add to investigation" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());
    const group = screen.getByRole("group", { name: "Crado understood this as" });
    expect(within(group).getByRole("button", { name: "Measurement" })).toBeDisabled();

    resolveAction({ success: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added to the investigation."));
  });

  it("never shows a stale success acknowledgment for a second, not-yet-submitted message under the same intent (duplicate/stale-state protection)", async () => {
    mockedObservation.mockResolvedValue({ success: true });
    render(<CaseComposer {...defaultProps} />);

    // First message: submit and confirm successfully.
    await typeAndSend("Disconnected the display cable. The 200 MHz peak dropped 9 dB.");
    fireEvent.click(screen.getByRole("button", { name: "Add to investigation" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Added to the investigation."));

    // Start a second message, also classified as an observation. Because
    // useActionState's state object doesn't reset on its own, this must
    // show the fresh confirmation form, not a stale "Added to the
    // investigation" carried over from the first submission.
    fireEvent.click(screen.getByRole("button", { name: "New message" }));
    await typeAndSend("Re-terminated the cable with a ferrite. The peak dropped 3 dB.");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to investigation" })).toBeInTheDocument();
    expect(mockedObservation).toHaveBeenCalledTimes(1);
  });
});
