import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authActions from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/actions";
import { SignInForm } from "./sign-in-form";

vi.mock("@/lib/auth/actions", () => ({
  signIn: vi.fn(),
}));

const mockedSignIn = vi.mocked(authActions.signIn);

beforeEach(() => {
  mockedSignIn.mockReset();
});

// Both required fields must have a value before a submit-button click
// fires at all — jsdom enforces native HTML5 constraint validation on
// submit, same as a real browser, and blocks it silently otherwise.
function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "engineer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
}

describe("SignInForm", () => {
  it("renders the real supported fields with correct autocomplete and no fabricated forgot-password link", () => {
    mockedSignIn.mockResolvedValue({});
    render(<SignInForm next="/investigations" />);

    expect(screen.getByRole("heading", { name: "Sign in to Crado" })).toBeInTheDocument();
    expect(screen.getByText("Continue to your engineering workspace.")).toBeInTheDocument();

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("autoComplete", "email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toBeRequired();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("autoComplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    // No password-reset flow exists in this codebase — a fabricated
    // link would point nowhere.
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();

    // UX-10: the "Create account" switch link moved out of this
    // component into AuthShell's shared top bar — no longer rendered
    // here at all. See auth-shell.test.tsx for its coverage.
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("preserves the intended post-auth destination through a hidden field", () => {
    mockedSignIn.mockResolvedValue({});
    const { container } = render(<SignInForm next="/cases/abc-123" />);

    const hidden = container.querySelector('input[name="next"]') as HTMLInputElement;
    expect(hidden.value).toBe("/cases/abc-123");
  });

  it("toggles password visibility with an accessible, keyboard-operable control", () => {
    mockedSignIn.mockResolvedValue({});
    render(<SignInForm next="/investigations" />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });

  it("disables the submit button and shows a submitting label while the action is pending", async () => {
    // A resolvable deferred, not a promise that never settles — an
    // action left permanently pending was observed to leak a scheduled
    // transition into the next test in this file (React's internal
    // transition tracking, not this component), so every test resolves
    // what it starts.
    let resolveAction: (state: AuthFormState) => void = () => {};
    mockedSignIn.mockImplementation(
      () => new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<SignInForm next="/investigations" />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const pendingButton = await screen.findByRole("button", { name: "Signing in…" });
    expect(pendingButton).toBeDisabled();

    resolveAction({});
    await screen.findByRole("button", { name: "Sign in" });
  });

  it("renders a server-returned credential error without disclosing account existence", async () => {
    mockedSignIn.mockResolvedValue({ error: "Could not sign in. Check your email and password." });
    render(<SignInForm next="/investigations" />);
    fillCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not sign in. Check your email and password.",
    );
  });

  it("preserves the entered email after a recoverable error (live-verified real defect: React resets uncontrolled form fields once a form action settles)", async () => {
    mockedSignIn.mockResolvedValue({ error: "Could not sign in. Check your email and password." });
    render(<SignInForm next="/investigations" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "engineer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever-was-typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email")).toHaveValue("engineer@example.com");
  });

  it("renders a page-level notice passed in from the server (e.g. an invalid confirmation link)", () => {
    mockedSignIn.mockResolvedValue({});
    render(
      <SignInForm
        next="/investigations"
        notice={{ tone: "error", message: "That confirmation link is invalid or has expired." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("That confirmation link is invalid or has expired.");
  });
});
