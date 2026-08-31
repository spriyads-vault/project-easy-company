"use client";

import { useActionState } from "react";
import { createMeasurement, type MeasurementFormState } from "./actions";

const initialState: MeasurementFormState = {};

const inputClass =
  "rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40";

interface AddMeasurementFormProps {
  caseId: string;
  productRevisionId: string;
}

export function AddMeasurementForm({
  caseId,
  productRevisionId,
}: AddMeasurementFormProps) {
  const boundAction = createMeasurement.bind(null, caseId, productRevisionId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Operating mode
        <input
          name="operatingMode"
          required
          placeholder="e.g. WiFi TX + display active"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
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
        <label className="flex flex-col gap-1 text-sm">
          Margin (dB vs. limit)
          <input
            name="marginDb"
            type="number"
            step="any"
            required
            placeholder="e.g. 7.4 or -3.6"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Label (optional)
        <input
          name="label"
          placeholder="e.g. baseline, after display change"
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Detector (optional)
          <input name="detector" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Limit line (optional)
          <input name="limitLine" className={inputClass} />
        </label>
      </div>
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
        {pending ? "Saving…" : "Add measurement"}
      </button>
    </form>
  );
}
