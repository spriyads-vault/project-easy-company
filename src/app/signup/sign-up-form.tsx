"use client";

// Auth enterprise redesign: the Sign up form. Fields are limited to
// exactly what credentialsSchema (and the underlying workspaces trigger)
// actually needs — email + password. No name, job title, company size,
// phone number or marketing-attribution field: the schema has none of
// them, and the ticket is explicit about not asking for fields the
// product doesn't need at account creation. No password-confirmation
// field either — the existing security design (a single Supabase
// signUp call) never required one.
import { useActionState, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/lib/design/password-input";
import { AuthBanner } from "@/lib/design/auth-banner";
import { switchHref } from "@/lib/design/auth-shell";
import { focusRing } from "@/lib/design/tokens";

const initialState: AuthFormState = {};

interface SignUpFormProps {
  next: string;
}

export function SignUpForm({ next }: SignUpFormProps) {
  const [state, action, pending] = useActionState(signUp, initialState);
  // See the matching comment in sign-in-form.tsx: React resets a form's
  // uncontrolled fields once its action settles, so email is tracked as
  // real component state to survive a recoverable error; password
  // deliberately is not.
  const [email, setEmail] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">
          Create your Crado account
        </h1>
        <p className="text-sm text-muted-foreground">Set up secure access to your engineering workspace.</p>
      </div>

      {state.message ? <AuthBanner tone="success">{state.message}</AuthBanner> : null}

      {!state.message ? (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-email" className="text-[13px] font-medium text-foreground">
              Email
            </label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-password" className="text-[13px] font-medium text-foreground">
              Password
            </label>
            <PasswordInput
              id="signup-password"
              name="password"
              required
              autoComplete="new-password"
              minLength={8}
              aria-describedby="signup-password-requirements"
              className="h-11"
            />
            <p id="signup-password-requirements" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>

          {state.error ? <AuthBanner tone="error">{state.error}</AuthBanner> : null}

          <button
            type="submit"
            disabled={pending}
            className={`mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={switchHref("/login", next)} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
