"use client";

import { useActionState } from "react";
import { submitExpertScore, type ScoreFormState } from "./actions";

const initialState: ScoreFormState = {};

const labelClass = "flex flex-col gap-2 text-sm";
const radioRowClass = "flex flex-wrap gap-3 text-sm";

interface ExpertScoreFormProps {
  benchmarkCaseId: string;
  analysisRunId: string;
}

export function ExpertScoreForm({ benchmarkCaseId, analysisRunId }: ExpertScoreFormProps) {
  const boundAction = submitExpertScore.bind(null, benchmarkCaseId, analysisRunId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className={labelClass}>
        Next action useful? (1–5)
        <div className={radioRowClass}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input type="radio" name="nextActionUseful" value={n} required /> {n}
            </label>
          ))}
        </div>
      </label>

      <label className={labelClass}>
        Hypotheses useful? (1–5)
        <div className={radioRowClass}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input type="radio" name="hypothesesUseful" value={n} required /> {n}
            </label>
          ))}
        </div>
      </label>

      <label className={labelClass}>
        Misleading?
        <div className={radioRowClass}>
          <label className="flex items-center gap-1">
            <input type="radio" name="misleading" value="yes" required /> Yes
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="misleading" value="no" required /> No
          </label>
        </div>
      </label>

      <label className={labelClass}>
        Would this have changed your next action?
        <div className={radioRowClass}>
          <label className="flex items-center gap-1">
            <input type="radio" name="wouldChangeNextAction" value="yes" required /> Yes
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="wouldChangeNextAction" value="no" required /> No
          </label>
        </div>
      </label>

      <label className={labelClass}>
        Comments
        <textarea
          name="comments"
          rows={4}
          className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-foreground/40 focus:border-foreground/40"
          placeholder="Anything notable about this run, before ground truth is revealed…"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save score"}
      </button>
    </form>
  );
}
