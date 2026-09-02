import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdvancedDisclosure } from "./advanced-disclosure";

describe("AdvancedDisclosure", () => {
  it("starts closed by default, with its content not visible", () => {
    render(
      <AdvancedDisclosure label="Manual entry (advanced)">
        <p>Manual form content</p>
      </AdvancedDisclosure>,
    );
    expect(screen.getByText("Manual entry (advanced)")).toBeInTheDocument();
    // Native <details>: the content is still in the DOM (never unmounted),
    // just not visible — toBeVisible() checks the closed <details>' CSS,
    // not presence.
    expect(screen.getByText("Manual form content")).not.toBeVisible();
  });

  it("opens on click, revealing its content (keyboard/pointer-operable native <details>)", () => {
    render(
      <AdvancedDisclosure label="Manual entry (advanced)">
        <p>Manual form content</p>
      </AdvancedDisclosure>,
    );
    fireEvent.click(screen.getByText("Manual entry (advanced)"));
    expect(screen.getByText("Manual form content")).toBeVisible();
  });

  it("respects defaultOpen, starting expanded", () => {
    render(
      <AdvancedDisclosure label="Add a fact" defaultOpen>
        <p>Fact form content</p>
      </AdvancedDisclosure>,
    );
    expect(screen.getByText("Fact form content")).toBeVisible();
  });

  it("never unmounts its children when toggled closed, so typed-but-unsubmitted form state survives (does not lose entered data)", () => {
    function FormInsideDisclosure() {
      const [value, setValue] = useState("");
      return (
        <AdvancedDisclosure label="Manual entry (advanced)">
          <input aria-label="Notes" value={value} onChange={(event) => setValue(event.target.value)} />
        </AdvancedDisclosure>
      );
    }
    render(<FormInsideDisclosure />);

    fireEvent.click(screen.getByText("Manual entry (advanced)"));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Draft note" } });
    expect(screen.getByLabelText("Notes")).toHaveValue("Draft note");

    // Close it again.
    fireEvent.click(screen.getByText("Manual entry (advanced)"));
    expect(screen.getByLabelText("Notes")).not.toBeVisible();

    // Reopen — the same input, same React component instance, same value.
    fireEvent.click(screen.getByText("Manual entry (advanced)"));
    expect(screen.getByLabelText("Notes")).toHaveValue("Draft note");
  });
});
