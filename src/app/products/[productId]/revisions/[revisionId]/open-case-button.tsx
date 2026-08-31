"use client";

import { useActionState } from "react";
import { createFailureCase, type FailureCaseFormState } from "./actions";

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
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open radiated-emissions case"}
      </button>
    </form>
  );
}
