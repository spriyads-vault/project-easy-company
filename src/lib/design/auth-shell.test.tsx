import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthShell, switchHref } from "./auth-shell";

describe("switchHref", () => {
  it("omits the next param when it's already the default destination", () => {
    expect(switchHref("/signup", "/investigations")).toBe("/signup");
    expect(switchHref("/login", "/investigations")).toBe("/login");
  });

  it("carries a non-default next destination across the switch", () => {
    expect(switchHref("/signup", "/cases/abc-123")).toBe("/signup?next=%2Fcases%2Fabc-123");
  });
});

describe("AuthShell", () => {
  it("shows a Sign up prompt and switch button on sign-in mode, preserving next", () => {
    render(
      <AuthShell mode="sign-in" next="/cases/abc-123">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      `/signup?next=${encodeURIComponent("/cases/abc-123")}`,
    );
  });

  it("shows a Sign in prompt and switch button on sign-up mode, preserving next", () => {
    render(
      <AuthShell mode="sign-up" next="/cases/abc-123">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/cases/abc-123")}`,
    );
  });

  it("omits the next query param on the switch link when next is already the default destination", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });

  it("renders the passed-in form content and the copyright line", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>the real form</div>
      </AuthShell>,
    );
    expect(screen.getByText("the real form")).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} Crado`)).toBeInTheDocument();
  });

  it("renders no Google/Apple sign-in button, no 'Or' divider, no language switcher, and no Privacy Policy link (deliberately not built, per the ticket)", () => {
    const { container } = render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/privacy/i)).not.toBeInTheDocument();
    // No language-switcher control (e.g. "ENG") anywhere in the shell.
    expect(container.textContent).not.toMatch(/\bENG\b/);
  });

  it("shows the real marketing panel content — headline, the trace-chain nodes, and the status rows", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("Regulation, inside the engineering loop.")).toBeInTheDocument();
    expect(screen.getByText("Rev17")).toBeInTheDocument();
    // "Verified" appears twice — the node-02 value and the row-02 state
    // chip both legitimately use this same honest word.
    expect(screen.getAllByText("Verified").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Linked")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Deterministic checks kept separate from AI inference")).toBeInTheDocument();
  });

  it("does not claim a compliance approval on the marketing panel (Crado records decisions, it does not certify them)", () => {
    const { container } = render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(container.textContent).not.toMatch(/approved/i);
  });

  it("shows the marketing panel's pill badge", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText(/engineering assurance/i)).toBeInTheDocument();
    expect(screen.getByText(/continuous traceability/i)).toBeInTheDocument();
  });

  it("renders no theme toggle — these pages are frozen to one fixed look, not theme-reactive (UX-13)", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.queryByRole("button", { name: /theme/i })).not.toBeInTheDocument();
  });

  it("always renders the white Crado mark, regardless of the app's theme (UX-15: left region is now dark)", () => {
    const { container } = render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    const mark = container.querySelector("img");
    expect(mark).toHaveAttribute("src", expect.stringContaining("crado-mark-white.png"));
  });

  it("does not claim a live per-visitor status on the marketing panel (Crado is not tracing anything for a signed-out visitor)", () => {
    const { container } = render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(container.textContent).not.toMatch(/tracing/i);
  });
});
