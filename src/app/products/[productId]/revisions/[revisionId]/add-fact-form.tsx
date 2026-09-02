"use client";

import { useActionState, useState } from "react";
import { createFact, type FactFormState } from "./actions";
import type { ProductFactCategory } from "@/lib/domain/schema";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: FactFormState = {};

const CATEGORY_LABELS: Record<ProductFactCategory, string> = {
  clock: "Clock",
  radio: "Radio",
  power: "Power",
  cable: "Cable / connector",
  other: "Other",
};

interface AddFactFormProps {
  productId: string;
  revisionId: string;
}

const inputClass = `${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;

export function AddFactForm({ productId, revisionId }: AddFactFormProps) {
  const [category, setCategory] = useState<ProductFactCategory>("clock");
  const boundAction = createFact.bind(null, productId, revisionId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        Category
        <select
          name="category"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as ProductFactCategory)
          }
          className={inputClass}
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
        Label
        <input
          name="label"
          required
          placeholder={
            category === "clock"
              ? "e.g. system clock"
              : category === "radio"
                ? "e.g. WiFi module"
                : category === "power"
                  ? "e.g. 5V rail"
                  : category === "cable"
                    ? "e.g. display ribbon cable"
                    : "e.g. enclosure seam"
          }
          className={inputClass}
        />
      </label>

      {category === "clock" && (
        <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
          Frequency (MHz)
          <input
            name="frequencyMhz"
            type="number"
            step="any"
            min="0"
            required
            className={inputClass}
          />
        </label>
      )}

      {category === "radio" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Technology
            <input
              name="technology"
              required
              placeholder="e.g. WiFi 2.4GHz"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Frequency (MHz, optional)
            <input
              name="frequencyMhz"
              type="number"
              step="any"
              min="0"
              className={inputClass}
            />
          </label>
        </>
      )}

      {category === "power" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Topology
            <input
              name="topology"
              required
              placeholder="e.g. switching regulator"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
            Switching frequency (MHz, optional)
            <input
              name="switchingFrequencyMhz"
              type="number"
              step="any"
              min="0"
              className={inputClass}
            />
          </label>
        </>
      )}

      {category === "cable" && (
        <label className="flex items-center gap-2 text-sm text-[#f5f6f7]">
          <input name="shielded" type="checkbox" className="h-4 w-4" />
          Shielded
        </label>
      )}

      {category === "other" && (
        <label className="flex flex-col gap-1 text-sm text-[#f5f6f7]">
          Notes (optional)
          <input name="notes" className={inputClass} />
        </label>
      )}

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
        {pending ? "Saving…" : "Add fact"}
      </button>
    </form>
  );
}
