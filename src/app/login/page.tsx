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

const inputClass = `w-full ${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] ${focusRing}`;

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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1f9d52]/40 bg-[#1f9d52]/10 text-sm font-semibold text-[#15803d]"
          >
            C
          </span>
          <div className="flex flex-col gap-1">
            <p className={text.kicker}>Crado</p>
            <h1 className="text-xl font-semibold tracking-tight text-[#18181b]">
              Sign in to your workspace
            </h1>
          </div>
        </div>

        <form action={signInAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
            <p role="alert" className={`rounded-lg border border-[#b45309]/40 bg-[#b45309]/10 p-2 text-sm text-[#b45309]`}>
              {signInState.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={signInPending}
            className={`mt-1 ${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {signInPending ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="submit"
            formAction={signUpAction}
            disabled={signUpPending}
            className={`${radius.control} border border-[#e4e4e7] px-4 py-2 text-sm font-medium text-[#18181b] transition-colors hover:bg-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {signUpPending ? "Creating account…" : "Create an account"}
          </button>

          {signUpState.error ? (
            <p role="alert" className="text-sm text-[#b45309]">
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
