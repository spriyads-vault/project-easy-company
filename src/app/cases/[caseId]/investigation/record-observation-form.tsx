"use client";

// The "RECORD RESULT" action (MVP-11) — structured engineer input, never a
// chatbot textarea. Placed directly under the hypotheses/Next investigation
// area so recording what happened after following a recommended test is an
// obvious, immediate next step. useActionState's `pending` disables the
// submit button for the duration of the action, which is what gives this
// its duplicate-submission protection — the same pattern already used by
// src/app/cases/[caseId]/add-measurement-form.tsx.
import { useActionState, useId, useState } from "react";
import { recordInvestigationObservation, type RecordObservationFormState } from "./actions";
import { accent, focusRing, surface, text } from "./theme";

const initialState: RecordObservationFormState = {};

const inputClass = `w-full border border-[#3a3d34] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#6f6d65] ${focusRing}`;

interface RecordObservationFormProps {
  caseId: string;
}

export function RecordObservationForm({ caseId }: RecordObservationFormProps) {
  const boundAction = recordInvestigationObservation.bind(null, caseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [isOpen, setIsOpen] = useState(false);
  const formId = useId();

  // Closing on success is a direct response to the user's own click on
  // "Done" below — never an effect synchronizing to `state.success`, which
  // would fire on every render where it's true (including a later
  // re-render for an unrelated reason) rather than exactly once.
  function closeAfterSuccess() {
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`self-start border border-[#3a3d34] px-3 py-2 text-xs font-medium uppercase tracking-wide text-[#c8c6bb] transition-colors hover:border-[#3ecf6e]/50 hover:text-[#5fdb87] ${focusRing}`}
      >
        Record result
      </button>
    );
  }

  if (state.success) {
    return (
      <div className={`flex flex-col gap-2 border border-[#3ecf6e]/40 p-4 ${surface.panelElevated}`}>
        <p role="status" className={`text-sm ${accent.greenText}`}>
          Observation recorded.
        </p>
        <button
          type="button"
          onClick={closeAfterSuccess}
          className={`self-start text-xs ${text.muted} hover:text-[#f3f1e8] ${focusRing}`}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      aria-labelledby={`${formId}-heading`}
      className={`flex flex-col gap-3 border border-[#3a3d34] p-4 ${surface.panelElevated}`}
    >
      <div className="flex items-center justify-between">
        <span id={`${formId}-heading`} className={text.kicker}>
          Record result
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={`text-xs ${text.muted} hover:text-[#f3f1e8] ${focusRing}`}
        >
          Cancel
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-observation`}>
        Observation
        <input
          id={`${formId}-observation`}
          name="observation"
          required
          placeholder="e.g. Display path disconnected"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-measurementChange`}>
        Measurement change (if known)
        <input
          id={`${formId}-measurementChange`}
          name="measurementChange"
          placeholder="e.g. Peak dropped 9 dB"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-operatingMode`}>
          Operating mode (if changed)
          <input id={`${formId}-operatingMode`} name="operatingMode" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-notes`}>
          Notes
          <input id={`${formId}-notes`} name="notes" className={inputClass} />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className={`border border-[#e0916a]/40 bg-[#e0916a]/10 p-2 text-sm ${accent.warnText}`}>
          {state.error}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Saving observation…" : ""}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-[#3ecf6e]/50 bg-[#3ecf6e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#5fdb87] transition-colors hover:bg-[#3ecf6e]/20 disabled:cursor-not-allowed disabled:border-[#3a3d34] disabled:bg-transparent disabled:text-[#6f6d65]"
      >
        {pending ? "Saving…" : "Record result"}
      </button>
    </form>
  );
}
