// Regression test for the Enterprise Investigation UI Revamp's root-cause
// fix: react-resizable-panels' <Panel> renders a plain display:block div,
// so a consumer's flex-1/min-h-0/overflow-y-auto content classes were
// inert inside it — the child grew to its full content height and the
// panel's own overflow:hidden (set by the library for resize clipping)
// silently clipped whatever didn't fit, with nothing to scroll. Proven
// live via chrome-devtools MCP DOM-geometry measurement (see
// docs/PROGRESS.md); jsdom does not run real CSS layout so scrollHeight/
// clientHeight are always 0 there — this test instead locks in the
// actual code-level fix (ResizablePanel always establishing its own flex
// column context) as a regression guard.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

describe("ResizablePanel", () => {
  it("establishes its own flex column context so flex-1/min-h-0 children can actually be constrained", () => {
    const { container } = render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={70} data-testid="panel">
          <div>content</div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={30}>
          <div>rail</div>
        </ResizablePanel>
      </ResizablePanelGroup>,
    );
    const panel = container.querySelector('[data-panel-id]') ?? container.querySelector("[data-panel]");
    expect(panel).toBeTruthy();
    expect(panel).toHaveClass("flex", "h-full", "min-h-0", "flex-col");
  });

  it("merges a caller-supplied className instead of replacing the flex-column contract", () => {
    const { container } = render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={100} className="py-5 pr-4">
          <div>content</div>
        </ResizablePanel>
      </ResizablePanelGroup>,
    );
    const panel = container.querySelector("[data-panel-id], [data-panel]");
    expect(panel).toHaveClass("flex", "h-full", "min-h-0", "flex-col", "py-5", "pr-4");
  });
});
