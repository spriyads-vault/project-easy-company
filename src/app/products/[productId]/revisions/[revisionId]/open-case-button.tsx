"use client";

import { useActionState } from "react";
import { createFailureCase, type FailureCaseFormState } from "./actions";
import { radius } from "@/lib/design/tokens";

const initialState: FailureCaseFormState = {};

export function OpenCaseButton({ revisionId }: { revisionId: string }) {
  const boundAction = createFailureCase.bind(null, revisionId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error ? (
        <p role="alert" className="rounded-lg border border-[#b45309]/40 bg-[#b45309]/10 p-2 text-sm text-[#b45309]">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`self-start ${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {pending ? "Opening…" : "Open radiated-emissions case"}
      </button>
    </form>
  );
}
