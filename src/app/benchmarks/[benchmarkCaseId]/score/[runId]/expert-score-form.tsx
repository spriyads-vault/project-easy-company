"use client";

import { useActionState } from "react";
import { submitExpertScore, type ScoreFormState } from "./actions";
import { focusRing, radius } from "@/lib/design/tokens";

const initialState: ScoreFormState = {};

const labelClass = "flex flex-col gap-2 text-sm text-[#f5f6f7]";
const radioRowClass = "flex flex-wrap gap-3 text-sm";
const radioLabelClass = "flex items-center gap-1.5 text-[#f5f6f7]";

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
            <label key={n} className={radioLabelClass}>
              <input type="radio" name="nextActionUseful" value={n} required className="accent-[#22c55e]" /> {n}
            </label>
          ))}
        </div>
      </label>

      <label className={labelClass}>
        Hypotheses useful? (1–5)
        <div className={radioRowClass}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={radioLabelClass}>
              <input type="radio" name="hypothesesUseful" value={n} required className="accent-[#22c55e]" /> {n}
            </label>
          ))}
        </div>
      </label>

      <label className={labelClass}>
        Misleading?
        <div className={radioRowClass}>
          <label className={radioLabelClass}>
            <input type="radio" name="misleading" value="yes" required className="accent-[#22c55e]" /> Yes
          </label>
          <label className={radioLabelClass}>
            <input type="radio" name="misleading" value="no" required className="accent-[#22c55e]" /> No
          </label>
        </div>
      </label>

      <label className={labelClass}>
        Would this have changed your next action?
        <div className={radioRowClass}>
          <label className={radioLabelClass}>
            <input type="radio" name="wouldChangeNextAction" value="yes" required className="accent-[#22c55e]" /> Yes
          </label>
          <label className={radioLabelClass}>
            <input type="radio" name="wouldChangeNextAction" value="no" required className="accent-[#22c55e]" /> No
          </label>
        </div>
      </label>

      <label className={labelClass}>
        Comments
        <textarea
          name="comments"
          rows={4}
          className={`${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`}
          placeholder="Anything notable about this run, before ground truth is revealed…"
        />
      </label>

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
        {pending ? "Saving…" : "Save score"}
      </button>
    </form>
  );
}
