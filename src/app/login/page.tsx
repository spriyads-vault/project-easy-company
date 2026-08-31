"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";

const initialState: AuthFormState = {};

export default function LoginPage() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-1 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/50">
            Crado
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to your workspace
          </h1>
        </div>

        <form action={signInAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          {signInState.error ? (
            <p role="alert" className="text-sm text-red-600">
              {signInState.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signInPending}
            className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-60"
          >
            {signInPending ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="submit"
            formAction={signUpAction}
            disabled={signUpPending}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {signUpPending ? "Creating account…" : "Create an account"}
          </button>

          {signUpState.error ? (
            <p role="alert" className="text-sm text-red-600">
              {signUpState.error}
            </p>
          ) : null}
          {signUpState.message ? (
            <p role="status" className="text-sm text-foreground/70">
              {signUpState.message}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
