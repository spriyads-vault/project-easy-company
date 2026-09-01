import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypeFilterTabs } from "./type-filter-tabs";

describe("TypeFilterTabs", () => {
  it("marks the active tab and links every tab to a real filter URL", () => {
    render(<TypeFilterTabs active="testing" />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/documents");
    expect(screen.getByRole("link", { name: "Testing" })).toHaveAttribute(
      "href",
      "/documents?type=testing",
    );
    expect(screen.getByRole("link", { name: "Testing" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Regulatory" })).not.toHaveAttribute("aria-current");
  });

  it("marks 'All' active when no filter is applied", () => {
    render(<TypeFilterTabs active={null} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
  });
});
