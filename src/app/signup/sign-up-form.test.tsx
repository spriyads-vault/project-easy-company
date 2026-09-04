import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authActions from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/actions";
import { SignUpForm } from "./sign-up-form";

vi.mock("@/lib/auth/actions", () => ({
  signUp: vi.fn(),
}));

const mockedSignUp = vi.mocked(authActions.signUp);

beforeEach(() => {
  mockedSignUp.mockReset();
});

// Both required fields must have a value before a submit-button click
// fires at all — jsdom enforces native HTML5 constraint validation on
// submit, same as a real browser, and blocks it silently otherwise.
function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "engineer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
}

describe("SignUpForm", () => {
  it("asks only for what the real schema needs — no name, company, phone or confirm-password field", () => {
    mockedSignUp.mockResolvedValue({});
    render(<SignUpForm next="/investigations" />);

    expect(screen.getByRole("heading", { name: "Create your Crado account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autoComplete", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("autoComplete", "new-password");
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();

    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/company/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("preserves the intended destination in the Sign in link", () => {
    mockedSignUp.mockResolvedValue({});
    render(<SignUpForm next="/cases/abc-123" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/cases/abc-123")}`,
    );
  });

  it("disables the submit button while the action is pending", async () => {
    // A resolvable deferred, not a promise that never settles — see the
    // matching sign-in test for why (a permanently-pending action was
    // observed to leak React's internal transition tracking into the
    // next test in this file).
    let resolveAction: (state: AuthFormState) => void = () => {};
    mockedSignUp.mockImplementation(
      () => new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<SignUpForm next="/investigations" />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const pendingButton = await screen.findByRole("button", { name: "Creating account…" });
    expect(pendingButton).toBeDisabled();

    resolveAction({});
    await screen.findByRole("button", { name: "Create account" });
  });

  it("renders a server error without claiming an account was created", async () => {
    mockedSignUp.mockResolvedValue({ error: "Could not create an account with those details." });
    render(<SignUpForm next="/investigations" />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create an account with those details.",
    );
  });

  it("preserves the entered email after a recoverable error", async () => {
    mockedSignUp.mockResolvedValue({ error: "Could not create an account with those details." });
    render(<SignUpForm next="/investigations" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "engineer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever-was-typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email")).toHaveValue("engineer@example.com");
  });

  it("shows the verification-sent state and hides the form once signUp reports no session yet", async () => {
    mockedSignUp.mockResolvedValue({ message: "Check your email to confirm your account." });
    render(<SignUpForm next="/investigations" />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Check your email to confirm your account.");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});
