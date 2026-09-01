"use client";

import { useActionState } from "react";
import { revealGroundTruthAction, type RevealFormState } from "./actions";

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
        className="rounded-md border border-foreground/30 bg-foreground/5 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Revealing…" : "Reveal ground truth"}
      </button>
      {disabled && disabledReason ? (
        <p className="text-xs text-foreground/50">{disabledReason}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
