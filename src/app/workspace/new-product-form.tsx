"use client";

import { useActionState } from "react";
import { createProduct, type ProductFormState } from "@/app/products/actions";

const initialState: ProductFormState = {};

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

export function NewProductForm() {
  const [state, formAction, pending] = useActionState(
    createProduct,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Product name
        <input
          name="name"
          required
          placeholder="e.g. Gateway X"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        First revision label
        <input
          name="revisionLabel"
          required
          placeholder="e.g. Rev17"
          className={inputClass}
        />
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
        {pending ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
