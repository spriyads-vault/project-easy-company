"use client";

// Auth enterprise redesign: the actual Sign in form — a client component
// because it needs useActionState (pending/duplicate-submit guard) and
// the password-visibility toggle. Page-level notices (expired session,
// invalid confirmation link) are derived from the request's own search
// params on the server and passed in as `notice`; this component only
// owns the action-result error/message state useActionState gives it.
import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/lib/design/password-input";
import { AuthBanner } from "@/lib/design/auth-banner";
import { focusRing } from "@/lib/design/tokens";
import { authHeading, authInput, authLabel, authPrimaryButton, authSupportingLine } from "@/lib/design/auth-tokens";

const initialState: AuthFormState = {};

interface SignInFormProps {
  /** Sanitized post-auth destination — carried as a hidden field so the
   * server action redirects somewhere real after success. The matching
   * "Sign up" switch button (which also needs this to survive a deep
   * link across the Sign in <-> Sign up hop) is owned by AuthShell now
   * (UX-10 moved it into the shared top bar), not this component. */
  next: string;
  notice?: { tone: "error" | "info"; message: string };
}

export function SignInForm({ next, notice }: SignInFormProps) {
  const [state, action, pending] = useActionState(signIn, initialState);
  // React resets a form's uncontrolled fields once its action settles
  // (the same "similar to a native form reset" behavior a plain
  // <form> gets after a normal submit) — a plain `defaultValue` only
  // covers first mount, so it doesn't survive that reset either. Email
  // is tracked as real component state instead, which does survive it;
  // password deliberately is not (never re-populate a submitted
  // password, and password managers don't need it preserved).
  const [email, setEmail] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className={authHeading}>Sign in to Crado</h1>
        <p className={authSupportingLine}>Continue to your engineering workspace.</p>
      </div>

      {notice ? <AuthBanner tone={notice.tone}>{notice.message}</AuthBanner> : null}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-email" className={authLabel}>
            Email
          </label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={authInput}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signin-password" className={authLabel}>
            Password
          </label>
          {/* No "Forgot password" link here — no password-reset flow
              exists in this codebase (no resetPasswordForEmail call, no
              reset route). Recorded as absent in docs/PROGRESS.md rather
              than linking to a page that doesn't exist. */}
          <PasswordInput
            id="signin-password"
            name="password"
            required
            autoComplete="current-password"
            minLength={8}
            className={authInput}
          />
        </div>

        {state.error ? <AuthBanner tone="error">{state.error}</AuthBanner> : null}

        <button type="submit" disabled={pending} className={`mt-1 ${authPrimaryButton} ${focusRing}`}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
