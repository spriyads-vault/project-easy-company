"use client";

// UX-04: a minimal, premium sign-in page consistent with the rest of the
// product — no application rail here deliberately (there's nothing to
// navigate to before you're signed in), but the same neutral canvas,
// card surface, and control styling as every authenticated route (see
// src/lib/design/tokens.ts). A quiet dot-grid behind the card is the
// only decoration — no gradient, no glassmorphism, no glow.
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";
import { canvasBackground, focusRing, radius, surface, text } from "@/lib/design/tokens";

const initialState: AuthFormState = {};

const inputClass = `w-full ${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;

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
    <div className={`flex flex-1 items-center justify-center px-6 py-24 ${surface.page} ${canvasBackground}`}>
      <div className={`flex w-full max-w-sm flex-col gap-7 p-8 ${surface.card}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary"
          >
            C
          </span>
          <div className="flex flex-col gap-1">
            <p className={text.kicker}>Crado</p>
            <h1 className="text-xl font-semibold tracking-tight text-[#f5f6f7]">
              Sign in to your workspace
            </h1>
          </div>
        </div>

        <form action={signInAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              className={inputClass}
            />
          </label>

          {signInState.error ? (
            <p role="alert" className={`rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm text-[#f59e0b]`}>
              {signInState.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signInPending}
            className={`mt-1 ${radius.control} border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {signInPending ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="submit"
            formAction={signUpAction}
            disabled={signUpPending}
            className={`${radius.control} border border-[#232933] px-4 py-2 text-sm font-medium text-[#f5f6f7] transition-colors hover:bg-[#151a21] disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {signUpPending ? "Creating account…" : "Create an account"}
          </button>

          {signUpState.error ? (
            <p role="alert" className="text-sm text-[#f59e0b]">
              {signUpState.error}
            </p>
          ) : null}
          {signUpState.message ? (
            <p role="status" className={`text-sm ${text.muted}`}>
              {signUpState.message}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
