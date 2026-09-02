"use client";

import { useActionState } from "react";
import { createProduct, type ProductFormState } from "@/app/products/actions";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: ProductFormState = {};

const inputClass = `${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] ${focusRing}`;

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(
    createProduct,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
        Product name
        <input
          name="name"
          required
          placeholder="e.g. Gateway X"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
        First revision label
        <input
          name="revisionLabel"
          required
          placeholder="e.g. Rev17"
          className={inputClass}
        />
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
        {pending ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
