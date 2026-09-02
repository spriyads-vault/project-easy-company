"use client";

// BOTTOM AGENT INPUT (UX-03): a floating composer centered over the
// canvas, not a full-width bar bolted to the bottom — its one real
// capability is recording an engineer observation (optionally with a
// measurement change), the same investigation_events write
// RecordObservationForm originally made (UX-02). What's new here is the
// shape: free text in, a floating "OBSERVATION DETECTED" confirmation
// artifact shown before anything is persisted (see parse-engineer-input.ts
// — a deterministic split, never a model paraphrase), confirm or cancel.
//
// The "+ Attach" control offers exactly two real actions — Observation
// (focuses this input, the default path) and Measurement (a real link to
// the case page's add-measurement form) — never a file-upload affordance
// with no backend behind it.
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
import { useActionState, useState } from "react";
import Link from "next/link";
import { recordInvestigationObservation, type RecordObservationFormState } from "./actions";
import { parseEngineerInput } from "./parse-engineer-input";
import { accent, focusRing, radius, surface, text } from "./theme";

const initialState: RecordObservationFormState = {};

// A stable (not useId-generated) id: exactly one CaseComposer is ever
// mounted per investigation page, and NextActionNode's "Record result"
// button (canvas-nodes.tsx, via investigation-workspace.tsx's
// onRecordResult) needs a real DOM target to focus — "opens the agent
// composer, not a traditional form" only holds if there's something
// concrete to focus.
export const CASE_COMPOSER_INPUT_ID = "case-composer-input";

interface CaseComposerProps {
  caseId: string;
}

export function CaseComposer({ caseId }: CaseComposerProps) {
  const boundAction = recordInvestigationObservation.bind(null, caseId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const inputId = CASE_COMPOSER_INPUT_ID;

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
    // instead of re-showing the (now stale) confirmation artifact.
    return (
      <div className={`mx-auto flex w-full max-w-[900px] items-center justify-between gap-3 px-4 py-3 ${surface.floating}`}>
        <p role="status" className={`text-sm ${accent.greenText}`}>
          Added to the investigation.
        </p>
        <button
          type="button"
          onClick={handleStartNew}
          className={`text-xs ${text.muted} hover:text-[#f5f6f7] ${focusRing}`}
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
        className={`mx-auto flex w-full max-w-[900px] flex-col gap-3 p-4 ${surface.floating}`}
      >
        <span className={text.kicker}>Observation detected</span>

        <div className="flex flex-col gap-2">
          <div className={`flex flex-col gap-0.5 rounded-lg border-l-2 border-l-[#22c55e] bg-[#22c55e]/[0.03] py-1.5 pl-2.5`}>
            <span className={`${text.kicker} text-[10px]`}>Observation</span>
            <p className="text-sm">{parsed.observation}</p>
          </div>
          {parsed.measurementChange ? (
            <div className="flex flex-col gap-0.5 rounded-lg border-l-2 border-l-[#f5f6f7]/60 py-1.5 pl-2.5">
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
          <p role="alert" className={`rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm ${accent.warnText}`}>
            {state.error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`${radius.control} border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:border-[#2d3440] disabled:bg-transparent disabled:text-[#6b7684]`}
          >
            {pending ? "Adding…" : "Add to investigation"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={pending}
            className={`${radius.control} px-4 py-2 text-xs font-medium uppercase tracking-wide ${text.muted} hover:text-[#f5f6f7] ${focusRing}`}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleReview}
      className={`relative mx-auto flex w-full max-w-[900px] items-center gap-2 p-2 ${surface.floating}`}
    >
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setAttachOpen((prev) => !prev)}
          aria-expanded={attachOpen}
          aria-haspopup="menu"
          className={`flex h-9 items-center gap-1 ${radius.control} px-2.5 text-xs font-medium ${text.muted} hover:text-[#f5f6f7] ${focusRing}`}
        >
          <span aria-hidden="true">+</span> Attach
        </button>
        {attachOpen ? (
          <div
            role="menu"
            className={`absolute bottom-full left-0 mb-2 flex w-44 flex-col gap-0.5 p-1.5 ${surface.floating}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                document.getElementById(inputId)?.focus();
              }}
              className={`rounded-[7px] px-2.5 py-1.5 text-left text-sm hover:bg-[#151a21] ${focusRing}`}
            >
              Observation
            </button>
            <Link
              href={`/cases/${caseId}`}
              role="menuitem"
              onClick={() => setAttachOpen(false)}
              className="rounded-[7px] px-2.5 py-1.5 text-left text-sm hover:bg-[#151a21]"
            >
              Measurement
            </Link>
          </div>
        ) : null}
      </div>

      <label htmlFor={inputId} className="sr-only">
        Tell Crado what changed, attach a result, or ask about this case
      </label>
      <input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Tell Crado what changed, attach a result, or ask about this case…"
        className={`flex-1 border-0 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`}
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className={`shrink-0 ${radius.control} border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:border-[#2d3440] disabled:bg-transparent disabled:text-[#6b7684]`}
      >
        Send
      </button>
    </form>
  );
}
