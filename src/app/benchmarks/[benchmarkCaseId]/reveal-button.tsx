"use client";

import { useActionState } from "react";
import { revealGroundTruthAction, type RevealFormState } from "./actions";
import { radius, text } from "@/lib/design/tokens";

const initialState: RevealFormState = {};

interface RevealButtonProps {
  benchmarkCaseId: string;
  disabled: boolean;
  disabledReason?: string;
}

export function RevealButton({ benchmarkCaseId, disabled, disabledReason }: RevealButtonProps) {
  const boundAction = revealGroundTruthAction.bind(null, benchmarkCaseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={disabled || pending}
        className={`${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:border-[#e4e4e7] disabled:bg-transparent disabled:text-[#a1a1aa]`}
      >
        {pending ? "Revealing…" : "Reveal ground truth"}
      </button>
      {disabled && disabledReason ? (
        <p className={`text-xs ${text.muted}`}>{disabledReason}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-xs text-[#b45309]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
