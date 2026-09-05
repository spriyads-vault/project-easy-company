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
  it("shows a Sign up prompt and switch button on sign-in mode, preserving next (UX-10: moved here from SignInForm)", () => {
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

  it("shows a Sign in prompt and switch button on sign-up mode, preserving next (UX-10: moved here from SignUpForm)", () => {
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

  it("shows real, already-existing product content in the right panel — not the reference's 3D render, an icon, or invented copy", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    // Each of these is a real string produced elsewhere in this app
    // (see auth-shell.tsx's own comment for exactly where each one
    // comes from) — asserting they render verbatim here is asserting
    // nothing was invented for this panel.
    expect(
      screen.getByText("200 MHz emission is the 5th harmonic of the 40 MHz system clock"),
    ).toBeInTheDocument();
    expect(screen.getByText("Radiated emissions — Gateway X Rev17")).toBeInTheDocument();
    expect(screen.getByText("Radiated emissions case opened.")).toBeInTheDocument();
    expect(screen.getByText("Regulation, inside the engineering loop.")).toBeInTheDocument();
  });
});
