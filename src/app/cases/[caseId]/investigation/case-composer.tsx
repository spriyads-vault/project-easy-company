"use client";

// BOTTOM AGENT INPUT (UX-02): a persistent natural-language composer, not a
// generic chatbot — its one real capability is recording an engineer
// observation (optionally with a measurement change), the same
// investigation_events write RecordObservationForm already made. What's
// new here is the shape of the interaction: free text in, a confirmation
// object shown back before anything is persisted (see
// parse-engineer-input.ts — a deterministic split, never a model
// paraphrase), confirm or discard.
//
// Scope note: the ticket also lists "questions about evidence" and
// "requesting another investigation" as things this composer could route.
// Those aren't wired here — reliably classifying free text into "record an
// observation" vs "answer a question" vs "start a new run" needs either a
// model call (a new, undisclosed capability this ticket didn't ask for) or
// unreliable keyword guessing, either of which risks silently doing the
// wrong thing with what the engineer typed. The existing RE-EVALUATE
// INVESTIGATION button and the Evidence tab's citations already cover
// those two needs explicitly; this composer stays honest about doing the
// one thing it actually does.
import { useActionState, useId, useState } from "react";
import { recordInvestigationObservation, type RecordObservationFormState } from "./actions";
import { parseEngineerInput } from "./parse-engineer-input";
import { accent, focusRing, surface, text } from "./theme";

const initialState: RecordObservationFormState = {};

interface CaseComposerProps {
  caseId: string;
}

export function CaseComposer({ caseId }: CaseComposerProps) {
  const boundAction = recordInvestigationObservation.bind(null, caseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const inputId = useId();

  const parsed = confirming ? parseEngineerInput(draft) : null;

  function handleReview(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setConfirming(true);
  }

  function handleDiscard() {
    setConfirming(false);
  }

  function handleStartNew() {
    setDraft("");
    setConfirming(false);
  }

  if (state.success && confirming) {
    // The confirm form just succeeded — show a brief acknowledgement
    // instead of re-showing the (now stale) confirmation card.
    return (
      <div className={`flex items-center justify-between gap-3 p-4 ${surface.panelElevated}`}>
        <p role="status" className={`text-sm ${accent.greenText}`}>
          Added to the investigation.
        </p>
        <button
          type="button"
          onClick={handleStartNew}
          className={`text-xs ${text.muted} hover:text-[#1c1a15] ${focusRing}`}
        >
          New message
        </button>
      </div>
    );
  }

  if (confirming && parsed) {
    return (
      <form
        action={formAction}
        className={`flex flex-col gap-3 p-4 ${surface.panelElevated}`}
      >
        <span className={text.kicker}>Confirm before adding to the investigation</span>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className={`${text.kicker} text-[10px]`}>Observation</span>
            <p className="text-sm">{parsed.observation}</p>
          </div>
          {parsed.measurementChange ? (
            <div className="flex flex-col gap-0.5">
              <span className={`${text.kicker} text-[10px]`}>Measurement change</span>
              <p className={`text-sm font-medium ${text.mono}`}>{parsed.measurementChange}</p>
            </div>
          ) : null}
        </div>

        <input type="hidden" name="observation" value={parsed.observation} />
        {parsed.measurementChange ? (
          <input type="hidden" name="measurementChange" value={parsed.measurementChange} />
        ) : null}

        {state.error ? (
          <p role="alert" className={`border border-[#a15a17]/40 bg-[#a15a17]/10 p-2 text-sm ${accent.warnText}`}>
            {state.error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#177a3f] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:border-[#ddd7c8] disabled:bg-transparent disabled:text-[#847c6a]"
          >
            {pending ? "Adding…" : "Confirm and add"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={pending}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${text.muted} hover:text-[#1c1a15] ${focusRing}`}
          >
            Edit
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleReview} className={`flex items-center gap-2 p-3 ${surface.panel}`}>
      <label htmlFor={inputId} className="sr-only">
        Tell Crado what changed, attach a result, or ask about this case
      </label>
      <input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Tell Crado what changed, attach a result, or ask about this case…"
        className={`flex-1 border border-[#ddd7c8] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#847c6a] ${focusRing}`}
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="shrink-0 border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#177a3f] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:border-[#ddd7c8] disabled:bg-transparent disabled:text-[#847c6a]"
      >
        Send
      </button>
    </form>
  );
}
