"use client";

import { useActionState } from "react";
import { createRevision, type RevisionFormState } from "./actions";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: RevisionFormState = {};

const inputClass = `${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;

export function NewRevisionForm({ productId }: { productId: string }) {
  const boundAction = createRevision.bind(null, productId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        Revision label
        <input
          name="label"
          required
          placeholder="e.g. Rev18"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        Notes (optional)
        <input name="notes" className={inputClass} />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm text-[#f59e0b]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`self-start ${radius.control} border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-sm font-medium text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {pending ? "Creating…" : "Create revision"}
      </button>
    </form>
  );
}
