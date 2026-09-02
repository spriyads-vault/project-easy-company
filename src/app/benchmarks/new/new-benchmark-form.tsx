"use client";

import { useActionState } from "react";
import { registerBenchmarkCase, type NewBenchmarkFormState } from "../actions";
import type { FailureCaseOption } from "@/lib/benchmarks/queries";
import { focusRing, radius, surface, typography } from "@/lib/design/tokens";
import { EmptyState } from "@/lib/design/empty-state";

const initialState: NewBenchmarkFormState = {};

const inputClass = `${radius.control} border border-[#232933] bg-card px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;
const labelClass = "flex flex-col gap-1 text-sm text-[#f5f6f7]";

interface NewBenchmarkFormProps {
  cases: FailureCaseOption[];
}

export function NewBenchmarkForm({ cases }: NewBenchmarkFormProps) {
  const [state, formAction, pending] = useActionState(registerBenchmarkCase, initialState);

  if (cases.length === 0) {
    return (
      <EmptyState message="No unregistered failure cases in this workspace yet. Build a product, revision, failure case, and first measurement through the normal workflow first, then come back here to register it as a benchmark." />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
        <h2 className={typography.sectionHeading}>Visible to Crado</h2>
        <p className={typography.body}>
          The historical case Crado will investigate blind — its product
          state, first failed measurement, and documents are exactly what
          the linked failure case already contains.
        </p>

        <label className={labelClass}>
          Failure case to investigate blind
          <select name="failureCaseId" required className={inputClass}>
            <option value="">Choose a case…</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {c.productName} / {c.revisionLabel} (
                {c.measurementCount} measurement{c.measurementCount === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Benchmark name
          <input
            name="name"
            required
            placeholder="e.g. 2024 gateway radiated-emissions field failure"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Where this case came from
          <textarea
            name="sourceDescription"
            required
            rows={2}
            placeholder="e.g. Pilot customer field return, closed out Q2 2024"
            className={inputClass}
          />
        </label>
      </section>

      <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
        <h2 className={typography.sectionHeading}>Hidden ground truth</h2>
        <p className={typography.body}>
          Recorded now, sealed until you explicitly reveal it after scoring.
          No investigation code path ever reads this — see the benchmark
          harness migration for why.
        </p>

        <label className={labelClass}>
          Actual root cause
          <textarea name="rootCause" required rows={2} className={inputClass} />
        </label>
        <label className={labelClass}>
          Diagnostic actions actually taken
          <textarea name="diagnosticActionsTaken" required rows={2} className={inputClass} />
        </label>
        <label className={labelClass}>
          Successful engineering change
          <textarea name="successfulEngineeringChange" required rows={2} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Final frequency (MHz, optional)
            <input name="finalFrequencyMhz" type="number" step="any" min="0" className={inputClass} />
          </label>
          <label className={labelClass}>
            Final margin (dB, optional)
            <input name="finalMarginDb" type="number" step="any" className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>
          Final outcome notes (optional)
          <textarea name="finalOutcomeNotes" rows={2} className={inputClass} />
        </label>
      </section>

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
        {pending ? "Registering…" : "Register benchmark case"}
      </button>
    </form>
  );
}
