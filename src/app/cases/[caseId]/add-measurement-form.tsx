"use client";

import { useActionState } from "react";
import { createMeasurement, type MeasurementFormState } from "./actions";
import { accent, focusRing } from "./investigation/theme";

const initialState: MeasurementFormState = {};

const inputClass = `border border-[#3a3d34] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#6f6d65] ${focusRing}`;
const labelClass = "flex flex-col gap-1 text-sm";

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
      <label className={labelClass}>
        Operating mode
        <input
          name="operatingMode"
          required
          placeholder="e.g. WiFi TX + display active"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
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
        <label className={labelClass}>
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

      <label className={labelClass}>
        Label (optional)
        <input
          name="label"
          placeholder="e.g. baseline, after display change"
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Detector (optional)
          <input name="detector" className={inputClass} />
        </label>
        <label className={labelClass}>
          Limit line (optional)
          <input name="limitLine" className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Notes (optional)
        <input name="notes" className={inputClass} />
      </label>

      {state.error ? (
        <p role="alert" className={`border border-[#e0916a]/40 bg-[#e0916a]/10 p-2 text-sm ${accent.warnText}`}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`self-start border border-[#3ecf6e]/50 bg-[#3ecf6e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#5fdb87] transition-colors hover:bg-[#3ecf6e]/20 disabled:cursor-not-allowed disabled:border-[#3a3d34] disabled:bg-transparent disabled:text-[#6f6d65]`}
      >
        {pending ? "Saving…" : "Add measurement"}
      </button>
    </form>
  );
}
