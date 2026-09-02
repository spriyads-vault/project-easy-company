"use client";

import { useActionState } from "react";
import { createProduct, type ProductFormState } from "@/app/products/actions";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: ProductFormState = {};

const inputClass = `${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(
    createProduct,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        Product name
        <input
          name="name"
          required
          placeholder="e.g. Gateway X"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        First revision label
        <input
          name="revisionLabel"
          required
          placeholder="e.g. Rev17"
          className={inputClass}
        />
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
        {pending ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
