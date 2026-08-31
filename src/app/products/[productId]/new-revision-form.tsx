"use client";

import { useActionState } from "react";
import { createRevision, type RevisionFormState } from "./actions";

const initialState: RevisionFormState = {};

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

export function NewRevisionForm({ productId }: { productId: string }) {
  const boundAction = createRevision.bind(null, productId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Revision label
        <input
          name="label"
          required
          placeholder="e.g. Rev18"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes (optional)
        <input name="notes" className={inputClass} />
      </label>

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
        {pending ? "Creating…" : "Create revision"}
      </button>
    </form>
  );
}
