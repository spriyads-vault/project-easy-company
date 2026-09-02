"use client";

import { useActionState } from "react";
import { createRevision, type RevisionFormState } from "./actions";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: RevisionFormState = {};

const inputClass = `${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] ${focusRing}`;

export function NewRevisionForm({ productId }: { productId: string }) {
  const boundAction = createRevision.bind(null, productId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
        Revision label
        <input
          name="label"
          required
          placeholder="e.g. Rev18"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
        Notes (optional)
        <input name="notes" className={inputClass} />
      </label>

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
        {pending ? "Creating…" : "Create revision"}
      </button>
    </form>
  );
}
