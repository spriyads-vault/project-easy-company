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

  it("shows the headline and the 5-row investigation chain in the right panel — not the reference's 3D render, an icon, or invented copy (UX-11)", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("Regulation, inside the engineering loop.")).toBeInTheDocument();
    // Each label/value pair is real product/domain output — see
    // auth-shell.tsx's own comment for exactly where each one comes
    // from (seed data, the deterministic harmonic-correlation utility,
    // and the deterministic compare-measurements utility).
    expect(screen.getByText("Measurement")).toBeInTheDocument();
    expect(screen.getByText("200 MHz · +7.4 dB · Rev17")).toBeInTheDocument();
    expect(screen.getByText("Calculated")).toBeInTheDocument();
    expect(screen.getByText("40 MHz × 5 = 200 MHz")).toBeInTheDocument();
    expect(screen.getByText("Hypothesis")).toBeInTheDocument();
    expect(screen.getByText("Consistent with 5th harmonic of system clock")).toBeInTheDocument();
    expect(screen.getByText("Next test")).toBeInTheDocument();
    expect(screen.getByText("Disconnect display path, re-measure")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("Rev18 · 3.6 dB below limit · 11 dB better")).toBeInTheDocument();
  });

  it("gives only the Result row the accent (success) colour — the one accent colour the panel is allowed (UX-11)", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("Rev18 · 3.6 dB below limit · 11 dB better")).toHaveClass("text-success");
    expect(screen.getByText("200 MHz · +7.4 dB · Rev17")).not.toHaveClass("text-success");
    expect(screen.getByText("Consistent with 5th harmonic of system clock")).not.toHaveClass("text-success");
  });

  it("sets numeric/equation/revision values in the monospace face and prose values in the body face (UX-11)", () => {
    render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    expect(screen.getByText("200 MHz · +7.4 dB · Rev17")).toHaveClass("font-mono");
    expect(screen.getByText("40 MHz × 5 = 200 MHz")).toHaveClass("font-mono");
    expect(screen.getByText("Rev18 · 3.6 dB below limit · 11 dB better")).toHaveClass("font-mono");
    expect(screen.getByText("Consistent with 5th harmonic of system clock")).not.toHaveClass("font-mono");
    expect(screen.getByText("Disconnect display path, re-measure")).not.toHaveClass("font-mono");
  });

  it("renders full bleed — no outer floating container, radius or shadow (UX-11)", () => {
    const { container } = render(
      <AuthShell mode="sign-in" next="/investigations">
        <div>form content</div>
      </AuthShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).not.toMatch(/rounded/);
    expect(root.className).not.toMatch(/shadow/);
    expect(root.className).not.toMatch(/max-w-\[1240px\]/);
  });
});
