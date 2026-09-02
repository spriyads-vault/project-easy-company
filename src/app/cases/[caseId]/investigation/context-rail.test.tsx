import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextRail } from "./context-rail";

const baseProps = {
  selection: null,
  onClear: vi.fn(),
  onOpenFullSource: vi.fn(),
  productName: "Gateway X",
  revisionLabel: "Rev17",
  productFacts: [],
  measurement: null,
  agentMetrics: null,
};

describe("ContextRail (UX-04: controlled collapse)", () => {
  it("renders the reveal button, not the panel, when collapsed is true", () => {
    render(<ContextRail {...baseProps} collapsed onCollapse={vi.fn()} onExpand={vi.fn()} />);
    expect(screen.queryByLabelText("Case context")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show case panel" })).toBeInTheDocument();
  });

  it("calls onExpand (never manages its own state) when the reveal button is clicked", () => {
    const onExpand = vi.fn();
    render(<ContextRail {...baseProps} collapsed onCollapse={vi.fn()} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole("button", { name: "Show case panel" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("renders the full panel and calls onCollapse (never manages its own state) when Collapse is clicked", () => {
    const onCollapse = vi.fn();
    render(<ContextRail {...baseProps} collapsed={false} onCollapse={onCollapse} onExpand={vi.fn()} />);
    expect(screen.getByLabelText("Case context")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse panel" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("omits the Collapse button when showCollapseButton is false (the mobile Sheet embedding, which has its own Close)", () => {
    render(
      <ContextRail {...baseProps} collapsed={false} onCollapse={vi.fn()} onExpand={vi.fn()} showCollapseButton={false} />,
    );
    expect(screen.queryByRole("button", { name: "Collapse panel" })).not.toBeInTheDocument();
  });

  it("stays expanded across re-renders that don't change the collapsed prop (a caller like the mobile Sheet can pass collapsed={false} unconditionally)", () => {
    const { rerender } = render(<ContextRail {...baseProps} collapsed={false} onCollapse={vi.fn()} onExpand={vi.fn()} />);
    expect(screen.getByLabelText("Case context")).toBeInTheDocument();
    rerender(<ContextRail {...baseProps} collapsed={false} onCollapse={vi.fn()} onExpand={vi.fn()} productName="Gateway X (renamed)" />);
    expect(screen.getByLabelText("Case context")).toBeInTheDocument();
  });
});
