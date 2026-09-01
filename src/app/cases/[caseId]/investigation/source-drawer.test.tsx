import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { SourceDrawer } from "./source-drawer";

const citation: EvidenceCitation = {
  documentId: "doc-1",
  chunkId: "chunk-1",
  filename: "Gateway-X-Schematic-Rev17.pdf",
  documentType: "schematic",
  pageNumber: 8,
  section: null,
  passage: "Display interface is driven from the 40 MHz subsystem.",
};

const sectionCitation: EvidenceCitation = {
  ...citation,
  chunkId: "chunk-2",
  filename: "EMC-Test-04.md",
  documentType: "test_report",
  pageNumber: null,
  section: "Suspected Source",
};

describe("SourceDrawer", () => {
  it("renders nothing when no citation is open", () => {
    const { container } = render(
      <SourceDrawer
        citation={null}
        hypothesisTitle={null}
        hypothesisIndex={null}
        evidenceCategory={null}
        onClose={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the document, page/section, exact stored passage, used-in, and evidence type — as a real dialog", () => {
    render(
      <SourceDrawer
        citation={citation}
        hypothesisTitle="5th harmonic of the system clock"
        hypothesisIndex={0}
        evidenceCategory="known"
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Gateway-X-Schematic-Rev17.pdf")).toBeInTheDocument();
    expect(screen.getByText("Page 8")).toBeInTheDocument();
    expect(
      screen.getByText("Display interface is driven from the 40 MHz subsystem."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hypothesis 01/)).toBeInTheDocument();
    expect(screen.getByText("Known evidence")).toBeInTheDocument();
  });

  it("shows the section (missing page/section case handled distinctly for Markdown-sourced passages)", () => {
    render(
      <SourceDrawer
        citation={sectionCitation}
        hypothesisTitle="A hypothesis"
        hypothesisIndex={1}
        evidenceCategory="known"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Suspected Source")).toBeInTheDocument();
    expect(screen.getByText(/Hypothesis 02/)).toBeInTheDocument();
  });

  it("closes on Escape and moves focus back to the previously focused element", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <SourceDrawer
        citation={citation}
        hypothesisTitle="A hypothesis"
        hypothesisIndex={0}
        evidenceCategory="known"
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Simulate the parent actually closing (citation -> null).
    rerender(
      <SourceDrawer
        citation={null}
        hypothesisTitle={null}
        hypothesisIndex={null}
        evidenceCategory={null}
        onClose={onClose}
      />,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <SourceDrawer
        citation={citation}
        hypothesisTitle="A hypothesis"
        hypothesisIndex={0}
        evidenceCategory="known"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close source" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the drawer (to the close button) when it opens", () => {
    render(
      <SourceDrawer
        citation={citation}
        hypothesisTitle="A hypothesis"
        hypothesisIndex={0}
        evidenceCategory="known"
        onClose={() => {}}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });
});
