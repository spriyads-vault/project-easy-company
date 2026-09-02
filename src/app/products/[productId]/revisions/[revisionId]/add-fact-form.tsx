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

const inputClass = `${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#a1a1aa] ${focusRing}`;

export function AddFactForm({ productId, revisionId }: AddFactFormProps) {
  const [category, setCategory] = useState<ProductFactCategory>("clock");
  const boundAction = createFact.bind(null, productId, revisionId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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

      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
        <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
            Technology
            <input
              name="technology"
              required
              placeholder="e.g. WiFi 2.4GHz"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
            Topology
            <input
              name="topology"
              required
              placeholder="e.g. switching regulator"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
        <label className="flex items-center gap-2 text-sm text-[#18181b]">
          <input name="shielded" type="checkbox" className="h-4 w-4" />
          Shielded
        </label>
      )}

      {category === "other" && (
        <label className="flex flex-col gap-1 text-sm text-[#18181b]">
          Notes (optional)
          <input name="notes" className={inputClass} />
        </label>
      )}

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
        {pending ? "Saving…" : "Add fact"}
      </button>
    </form>
  );
}
