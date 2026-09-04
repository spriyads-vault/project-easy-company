"use client";

// The "RECORD ENGINEERING CHANGE" action (MVP-11) — structured fields, never
// a chatbot textarea, matching RecordObservationForm's precedent. Recording
// the change is what creates the new revision (REV17 -> REV18): the engineer
// never types a revision id, they just confirm the suggested label
// (suggestNextRevisionLabel) before submitting. useActionState's `pending`
// disables the submit button for the duration of the action, the same
// duplicate-submission protection RecordObservationForm relies on.
import { useActionState, useId, useState } from "react";
import {
  recordEngineeringChange,
  type RecordEngineeringChangeFormState,
} from "./actions";
import { suggestNextRevisionLabel } from "@/lib/products/suggest-next-revision-label";
import { accent, focusRing, surface, text } from "./theme";

const initialState: RecordEngineeringChangeFormState = {};

const inputClass = `w-full border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground ${focusRing}`;

interface RecordEngineeringChangeFormProps {
  caseId: string;
  productId: string;
  fromRevisionId: string;
  currentRevisionLabel: string;
}

export function RecordEngineeringChangeForm({
  caseId,
  productId,
  fromRevisionId,
  currentRevisionLabel,
}: RecordEngineeringChangeFormProps) {
  const boundAction = recordEngineeringChange.bind(null, caseId, productId, fromRevisionId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [isOpen, setIsOpen] = useState(false);
  const formId = useId();
  // Captured once, not read live from the `currentRevisionLabel` prop, for
  // the success message below: a successful submission triggers
  // revalidatePath, which re-renders this component's parent with the new
  // *post-change* currentRevisionLabel (now Rev18) before the success state
  // is shown — reading the live prop there would print "Rev18 → Rev18"
  // instead of "Rev17 → Rev18".
  const [fromLabel] = useState(currentRevisionLabel);
  const suggestedLabel = suggestNextRevisionLabel(currentRevisionLabel);

  function closeAfterSuccess() {
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`self-start border border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${focusRing}`}
      >
        Record engineering change
      </button>
    );
  }

  if (state.success) {
    return (
      <div className={`flex flex-col gap-2 border border-primary/40 p-4 ${surface.panelElevated}`}>
        <p role="status" className={`text-sm ${accent.greenText}`}>
          Engineering change recorded. {fromLabel} → {state.newRevisionLabel}
          {" "}created.
        </p>
        <p className={`text-xs ${text.muted}`}>
          Add the follow-up measurement for {state.newRevisionLabel} from the case page.
        </p>
        <button
          type="button"
          onClick={closeAfterSuccess}
          className={`self-start text-xs ${text.muted} hover:text-foreground ${focusRing}`}
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
      className={`flex flex-col gap-3 border border-border p-4 ${surface.panelElevated}`}
    >
      <div className="flex items-center justify-between">
        <span id={`${formId}-heading`} className={text.kicker}>
          Record engineering change
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
        >
          Cancel
        </button>
      </div>

      <p className={`text-xs ${text.muted}`}>
        This creates a new product revision from {currentRevisionLabel}. The
        current revision stays exactly as it is — nothing is overwritten.
      </p>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-title`}>
        Title
        <input
          id={`${formId}-title`}
          name="title"
          required
          placeholder="e.g. Display termination changed"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-description`}>
        Description
        <input
          id={`${formId}-description`}
          name="description"
          required
          placeholder="What was changed, and how"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-affectedSubsystem`}>
        Affected subsystem
        <input
          id={`${formId}-affectedSubsystem`}
          name="affectedSubsystem"
          placeholder="e.g. Display path"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-previousValue`}>
          Previous value (if known)
          <input id={`${formId}-previousValue`} name="previousValue" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-newValue`}>
          New value (if known)
          <input id={`${formId}-newValue`} name="newValue" className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-reason`}>
        Reason / linked investigation
        <input
          id={`${formId}-reason`}
          name="reason"
          placeholder="e.g. Follow-up to investigation where disconnecting the display path reduced the 200 MHz peak by 9 dB."
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-notes`}>
        Notes
        <input id={`${formId}-notes`} name="notes" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor={`${formId}-newRevisionLabel`}>
        New revision label
        <input
          id={`${formId}-newRevisionLabel`}
          name="newRevisionLabel"
          required
          defaultValue={suggestedLabel}
          className={inputClass}
        />
      </label>

      {state.error ? (
        <p role="alert" className={`border border-warning/40 bg-warning/10 p-2 text-sm ${accent.warnText}`}>
          {state.error}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Recording engineering change…" : ""}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
      >
        {pending ? "Recording…" : "Record engineering change"}
      </button>
    </form>
  );
}
