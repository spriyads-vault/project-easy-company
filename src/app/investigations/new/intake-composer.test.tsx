import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeComposer } from "./intake-composer";
import * as actions from "./actions";

vi.mock("./actions", () => ({
  createInvestigationIntake: vi.fn(),
}));

const mockedAction = vi.mocked(actions.createInvestigationIntake);

const products = [{ id: "product-1", name: "Gateway X" }];

function continueFrom(draft: string) {
  fireEvent.change(screen.getByPlaceholderText(/describe the failure/i), {
    target: { value: draft },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
}

describe("IntakeComposer — product fact extraction (FIX-02 Defect 2)", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("shows an extracted clock fact as an editable, removable row on the confirmation panel", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    expect(screen.getByDisplayValue("System clock")).toBeInTheDocument();
    expect(screen.getByLabelText("Fact 1 frequency in MHz")).toHaveValue(40);
    expect(screen.getByLabelText("Remove fact 1")).toBeInTheDocument();
  });

  it("removes a fact row without submitting anything (no extraction is persisted before confirmation)", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    fireEvent.click(screen.getByLabelText("Remove fact 1"));

    expect(screen.queryByDisplayValue("System clock")).not.toBeInTheDocument();
    expect(mockedAction).not.toHaveBeenCalled();
  });

  it("lets the engineer edit an extracted fact's label before submitting", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    fireEvent.change(screen.getByDisplayValue("System clock"), {
      target: { value: "Main system clock" },
    });

    expect(screen.getByDisplayValue("Main system clock")).toBeInTheDocument();
  });

  it("names what to add when no frequency-bearing fact was found", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz, 7.4 dB above the limit.");

    expect(
      screen.getByText(/no clock, radio, or switching-rail frequency was found/i),
    ).toBeInTheDocument();
  });

  it("never calls the server action just from reaching the confirmation stage (no extraction is persisted before confirmation)", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    expect(mockedAction).not.toHaveBeenCalled();
  });
});

describe("IntakeComposer — required fields (FIX-04)", () => {
  beforeEach(() => {
    mockedAction.mockReset();
  });

  it("does not require Operating mode — the correlation engine never reads it (docs/CAPABILITY_AUDIT.md section 5), so blocking submission on it was wrong", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    expect(screen.getByPlaceholderText(/wifi tx \+ display active/i)).not.toBeRequired();
  });

  it("still requires the fields the pipeline genuinely cannot proceed without: product, revision, observed peak, margin", () => {
    render(<IntakeComposer products={products} />);
    continueFrom("Gateway X Rev17 failed at 200 MHz. 40 MHz system clock.");

    expect(screen.getByPlaceholderText(/rev17/i)).toBeRequired();
    expect(screen.getByPlaceholderText(/7\.4 or -3\.6/i)).toBeRequired();
    // Observed peak has no placeholder (it's pre-filled from extraction) —
    // found by its label's associated metadata text instead.
    const peakLabel = screen.getByText("Observed peak (MHz)");
    const peakInput = peakLabel.parentElement?.querySelector("input");
    expect(peakInput).toBeRequired();
  });
});
