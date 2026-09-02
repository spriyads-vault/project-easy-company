"use client";

// BOTTOM AGENT INPUT (UX-03, intent classification added in UX-04): a
// floating composer centered over the canvas, not a full-width bar bolted
// to the bottom or a chat UI. One free-text box, one confirmation artifact
// before anything is persisted, for THREE actions — Observation (UX-02/
// UX-03), Measurement, and Engineering change (both new in UX-04).
//
// classifyComposerIntent (deterministic, never a model call — see that
// module's own comments) picks which of the three a message most likely
// is; the confirmation card always shows a 3-way switcher so a wrong or
// low-confidence read is one click from being corrected, never silently
// committed. Each intent has its own deterministic parser
// (parse-engineer-input.ts / parse-composer-measurement.ts /
// parse-composer-engineering-change.ts) and its own server action
// (recordInvestigationObservation / createMeasurement /
// recordEngineeringChange) — no new database writes, no new tables, the
// exact same actions the pre-UX-04 forms already called.
//
// Duplicate-submission guard: each flow's own useActionState `pending`
// flag disables its submit button for the duration of the action — the
// same mechanism every other form in this app already relies on. There is
// no URL/query-param state here to go stale (unlike the investigation
// page's ?autorun=1), so there's nothing analogous to guard there.
import { useActionState, useEffect, useState } from "react";
import { recordInvestigationObservation, type RecordObservationFormState } from "./actions";
import { recordEngineeringChange, type RecordEngineeringChangeFormState } from "./actions";
import { createMeasurement, type MeasurementFormState } from "../actions";
import { parseEngineerInput } from "./parse-engineer-input";
import { classifyComposerIntent, type ComposerIntent } from "./classify-composer-intent";
import { parseComposerMeasurement } from "./parse-composer-measurement";
import { parseComposerEngineeringChange } from "./parse-composer-engineering-change";
import { compareMeasurements, type MeasurementComparison } from "@/lib/measurements/compare-measurements";
import type { MeasurementRow } from "@/lib/cases/queries";
import { accent, focusRing, radius, surface, text } from "./theme";

const initialObservationState: RecordObservationFormState = {};
const initialMeasurementState: MeasurementFormState = {};
const initialChangeState: RecordEngineeringChangeFormState = {};

// A stable (not useId-generated) id: exactly one CaseComposer is ever
// mounted per investigation page, and NextActionNode's "Record result"
// button (canvas-nodes.tsx, via investigation-workspace.tsx's
// onRecordResult) needs a real DOM target to focus — "opens the agent
// composer, not a traditional form" only holds if there's something
// concrete to focus.
export const CASE_COMPOSER_INPUT_ID = "case-composer-input";

const INTENT_LABEL: Record<ComposerIntent, string> = {
  observation: "Observation",
  measurement: "Measurement",
  engineering_change: "Engineering change",
};

interface CaseComposerProps {
  caseId: string;
  productId: string;
  revisionId: string;
  currentRevisionLabel: string;
  /** The case's current/latest measurement — used only as the "before"
   * side of a client-computed before/after comparison when a new
   * measurement is confirmed through this composer (see
   * onMeasurementRecorded below). Never mutated here. */
  measurement: MeasurementRow | null;
  /** UX-04 live-update: called right after a Measurement submission
   * succeeds, with a real compareMeasurements() result when there was a
   * prior measurement to compare against (null when this is the case's
   * first-ever measurement, or the two readings aren't at the same
   * frequency) — investigation-workspace.tsx appends this to its local
   * timeline so the outcome node appears without a page refresh, the same
   * live-append precedent already used for hypothesis.created SSE events. */
  onMeasurementRecorded?: (comparison: MeasurementComparison | null) => void;
  /** UX-04 live-update: called right after an Observation submission
   * succeeds, with exactly what was persisted (verbatim), so
   * investigation-workspace.tsx can append the same ObservationNode the
   * canvas would otherwise only show after a refresh. */
  onObservationRecorded?: (entry: { observation: string; measurementChange: string | null }) => void;
}

export function CaseComposer({
  caseId,
  productId,
  revisionId,
  currentRevisionLabel,
  measurement,
  onMeasurementRecorded,
  onObservationRecorded,
}: CaseComposerProps) {
  const observationAction = recordInvestigationObservation.bind(null, caseId);
  const [observationState, observationFormAction, observationPending] = useActionState(
    observationAction,
    initialObservationState,
  );

  const measurementAction = createMeasurement.bind(null, caseId, revisionId);
  const [measurementState, measurementFormAction, measurementPending] = useActionState(
    measurementAction,
    initialMeasurementState,
  );

  const changeAction = recordEngineeringChange.bind(null, caseId, productId, revisionId);
  const [changeState, changeFormAction, changePending] = useActionState(changeAction, initialChangeState);

  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<"compose" | "confirm">("compose");
  const [intent, setIntent] = useState<ComposerIntent>("observation");
  const [attachOpen, setAttachOpen] = useState(false);
  // True only once THIS confirm session's form has actually been
  // submitted — without this, "done" would have to be derived purely from
  // <intent>State.success, which useActionState does NOT reset when a form
  // is submitted again: it stays at its previous value until the new
  // dispatch resolves. Without this flag, opening a second message under
  // the same intent would render the FIRST message's stale "Added to the
  // investigation" acknowledgment for an instant (or longer, if the
  // engineer never actually submits) instead of the confirm form —
  // a false confirmation for something that was never persisted. Reset on
  // every intent switch and every fresh compose→confirm transition, set by
  // each form's own onSubmit (fires synchronously, before the async action
  // dispatches).
  const [submitted, setSubmitted] = useState(false);
  const inputId = CASE_COMPOSER_INPUT_ID;

  // Editable measurement/engineering-change fields — re-derived from
  // `draft` each time the intent switcher lands on that flow, so a
  // reclassification always starts from a fresh, honest read of the text
  // rather than carrying over another flow's stale values.
  const [measFrequency, setMeasFrequency] = useState("");
  const [measMargin, setMeasMargin] = useState("");
  const [measOperatingMode, setMeasOperatingMode] = useState("");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [changeAffectedSubsystem, setChangeAffectedSubsystem] = useState("");
  const [changeNewRevisionLabel, setChangeNewRevisionLabel] = useState("");

  const parsedObservation = intent === "observation" ? parseEngineerInput(draft) : null;

  function applyIntent(nextIntent: ComposerIntent) {
    setIntent(nextIntent);
    setSubmitted(false);
    if (nextIntent === "measurement") {
      const parsed = parseComposerMeasurement(draft);
      setMeasFrequency(parsed.frequencyMhz !== null ? String(parsed.frequencyMhz) : "");
      setMeasMargin(parsed.marginDb !== null ? String(parsed.marginDb) : "");
      setMeasOperatingMode(parsed.operatingMode ?? "");
    } else if (nextIntent === "engineering_change") {
      const parsed = parseComposerEngineeringChange(draft, currentRevisionLabel);
      setChangeTitle(parsed.title);
      setChangeDescription(parsed.description);
      setChangeAffectedSubsystem("");
      setChangeNewRevisionLabel(parsed.newRevisionLabel);
    }
  }

  function handleReview(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    applyIntent(classifyComposerIntent(draft).intent);
    setStage("confirm");
  }

  function handleDiscard() {
    setStage("compose");
  }

  function handleStartNew() {
    setDraft("");
    setStage("compose");
    setSubmitted(false);
  }

  // "done" is derived, never stored: true only once THIS session's form
  // was actually submitted AND that specific action's state came back
  // successful — see the `submitted` flag's own comment above for why
  // <intent>State.success alone isn't sufficient.
  const observationDone = submitted && intent === "observation" && observationState.success === true;
  const measurementDone = submitted && intent === "measurement" && measurementState.success === true;
  const changeDone = submitted && intent === "engineering_change" && changeState.success === true;

  // The measurement before/after comparison is computed once, from data
  // that's fully available at render time — reused by both the
  // acknowledgment text below and the live-update effect, so the two never
  // drift from each other.
  function computeMeasurementComparison(): MeasurementComparison | null {
    const before = measurement?.peaks[0];
    const frequencyMhz = Number(measFrequency);
    const marginDb = Number(measMargin);
    if (!before || !measurement || !Number.isFinite(frequencyMhz) || !Number.isFinite(marginDb)) return null;
    return compareMeasurements(
      { revisionLabel: measurement.revisionLabel, frequencyMhz: before.frequencyMhz, marginDb: before.marginDb },
      { revisionLabel: currentRevisionLabel, frequencyMhz, marginDb },
    );
  }

  // Each action's success notifies the parent in its own effect — a
  // genuine side effect (updating investigation-workspace.tsx's timeline),
  // never a local setState call, which is what the previous version of
  // this component got wrong. `observationDone`/`measurementDone`/
  // `changeDone` only ever transition false→true once per real dispatch
  // (see `submitted` above), so each effect fires exactly once per
  // successful submission, never on a stale re-render.
  useEffect(() => {
    if (!observationDone) return;
    const parsed = parseEngineerInput(draft);
    onObservationRecorded?.({ observation: parsed.observation, measurementChange: parsed.measurementChange });
  }, [observationDone, draft, onObservationRecorded]);

  useEffect(() => {
    if (!measurementDone) return;
    onMeasurementRecorded?.(computeMeasurementComparison());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computeMeasurementComparison is a plain function redefined every render (not memoized); measurementDone transitioning false→true is what gates this effect, so its own inputs (measFrequency/measMargin/measurement/currentRevisionLabel) don't need to be separately tracked as re-triggers.
  }, [measurementDone, onMeasurementRecorded]);

  if (stage === "confirm" && (observationDone || measurementDone || changeDone)) {
    const message = observationDone
      ? "Added to the investigation."
      : measurementDone
        ? (() => {
            const comparison = computeMeasurementComparison();
            return comparison && comparison.sameFrequency
              ? `Measurement added — ${Math.abs(comparison.deltaDb).toFixed(1)} dB ${
                  comparison.improved ? "improvement" : comparison.deltaDb < 0 ? "worse" : "no change"
                }.`
              : "Measurement added to the investigation.";
          })()
        : `Engineering change recorded. ${currentRevisionLabel} → ${changeState.newRevisionLabel} created. Add the follow-up measurement when it's ready.`;

    return (
      <div className={`mx-auto flex w-full max-w-[900px] items-center justify-between gap-3 px-4 py-3 ${surface.floating}`}>
        <p role="status" className={`text-sm ${accent.greenText}`}>
          {message}
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

  if (stage === "confirm") {
    return (
      <div className={`mx-auto flex w-full max-w-[900px] flex-col gap-3 p-4 ${surface.floating}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={text.kicker}>Crado understood this as</span>
          <div role="group" aria-label="Crado understood this as" className="flex gap-1">
            {(Object.keys(INTENT_LABEL) as ComposerIntent[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={intent === option}
                disabled={observationPending || measurementPending || changePending}
                onClick={() => applyIntent(option)}
                className={`${radius.control} px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 ${
                  intent === option
                    ? "border border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]"
                    : `border border-[#2d3440] ${text.muted} hover:text-[#f5f6f7]`
                }`}
              >
                {INTENT_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        {intent === "observation" ? (
          <form action={observationFormAction} onSubmit={() => setSubmitted(true)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5 rounded-lg border-l-2 border-l-[#22c55e] bg-[#22c55e]/[0.03] py-1.5 pl-2.5">
                <span className={`${text.kicker} text-[10px]`}>Observation</span>
                <p className="text-sm">{parsedObservation?.observation}</p>
              </div>
              {parsedObservation?.measurementChange ? (
                <div className="flex flex-col gap-0.5 rounded-lg border-l-2 border-l-[#f5f6f7]/60 py-1.5 pl-2.5">
                  <span className={`${text.kicker} text-[10px]`}>Measurement change</span>
                  <p className={`text-sm font-medium ${text.mono}`}>{parsedObservation.measurementChange}</p>
                </div>
              ) : null}
            </div>
            <input type="hidden" name="observation" value={parsedObservation?.observation ?? ""} />
            {parsedObservation?.measurementChange ? (
              <input type="hidden" name="measurementChange" value={parsedObservation.measurementChange} />
            ) : null}
            {observationState.error ? (
              <p role="alert" className={`rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm ${accent.warnText}`}>
                {observationState.error}
              </p>
            ) : null}
            <ConfirmActions pending={observationPending} onCancel={handleDiscard} submitLabel="Add to investigation" />
          </form>
        ) : null}

        {intent === "measurement" ? (
          <form action={measurementFormAction} onSubmit={() => setSubmitted(true)} className="flex flex-col gap-3">
            {!measurement ? (
              <p className={`text-xs ${text.muted}`}>
                No prior measurement on this case yet — this will be recorded as the first one, with nothing to
                compare it against.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <ComposerField label="Frequency (MHz)">
                <input
                  name="frequencyMhz"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={measFrequency}
                  onChange={(event) => setMeasFrequency(event.target.value)}
                  className={fieldInputClass}
                />
              </ComposerField>
              <ComposerField label="Margin (dB vs. limit)">
                <input
                  name="marginDb"
                  type="number"
                  step="any"
                  required
                  value={measMargin}
                  onChange={(event) => setMeasMargin(event.target.value)}
                  placeholder="e.g. 7.4 or -3.6"
                  className={fieldInputClass}
                />
              </ComposerField>
            </div>
            <ComposerField label="Operating mode">
              <input
                name="operatingMode"
                required
                value={measOperatingMode}
                onChange={(event) => setMeasOperatingMode(event.target.value)}
                placeholder="e.g. WiFi TX + display active"
                className={fieldInputClass}
              />
            </ComposerField>
            <p className={`text-xs ${text.muted}`}>Recorded against {currentRevisionLabel || "the current revision"}.</p>
            {measurementState.error ? (
              <p role="alert" className={`rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm ${accent.warnText}`}>
                {measurementState.error}
              </p>
            ) : null}
            <ConfirmActions pending={measurementPending} onCancel={handleDiscard} submitLabel="Add measurement" />
          </form>
        ) : null}

        {intent === "engineering_change" ? (
          <form action={changeFormAction} onSubmit={() => setSubmitted(true)} className="flex flex-col gap-3">
            <p className={`text-xs ${text.muted}`}>
              This creates a new product revision from {currentRevisionLabel || "the current revision"}. The current
              revision stays exactly as it is — nothing is overwritten.
            </p>
            <ComposerField label="Title">
              <input
                name="title"
                required
                value={changeTitle}
                onChange={(event) => setChangeTitle(event.target.value)}
                className={fieldInputClass}
              />
            </ComposerField>
            <ComposerField label="Description">
              <input
                name="description"
                required
                value={changeDescription}
                onChange={(event) => setChangeDescription(event.target.value)}
                className={fieldInputClass}
              />
            </ComposerField>
            <ComposerField label="Affected subsystem (optional)">
              <input
                name="affectedSubsystem"
                value={changeAffectedSubsystem}
                onChange={(event) => setChangeAffectedSubsystem(event.target.value)}
                placeholder="e.g. Display path"
                className={fieldInputClass}
              />
            </ComposerField>
            <ComposerField label="New revision label">
              <input
                name="newRevisionLabel"
                required
                value={changeNewRevisionLabel}
                onChange={(event) => setChangeNewRevisionLabel(event.target.value)}
                className={`${fieldInputClass} ${text.mono}`}
              />
            </ComposerField>
            {changeState.error ? (
              <p role="alert" className={`rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-sm ${accent.warnText}`}>
                {changeState.error}
              </p>
            ) : null}
            <ConfirmActions pending={changePending} onCancel={handleDiscard} submitLabel="Record engineering change" />
          </form>
        ) : null}
      </div>
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
            className={`absolute bottom-full left-0 mb-2 flex w-48 flex-col gap-0.5 p-1.5 ${surface.floating}`}
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
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                applyIntent("measurement");
                setStage("confirm");
              }}
              className={`rounded-[7px] px-2.5 py-1.5 text-left text-sm hover:bg-[#151a21] ${focusRing}`}
            >
              Measurement
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                applyIntent("engineering_change");
                setStage("confirm");
              }}
              className={`rounded-[7px] px-2.5 py-1.5 text-left text-sm hover:bg-[#151a21] ${focusRing}`}
            >
              Engineering change
            </button>
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

const fieldInputClass = `border border-[#2d3440] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[#6b7684] ${focusRing}`;

function ComposerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className={`${text.kicker} text-[10px]`}>{label}</span>
      {children}
    </label>
  );
}

function ConfirmActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`${radius.control} border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:border-[#2d3440] disabled:bg-transparent disabled:text-[#6b7684]`}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className={`${radius.control} px-4 py-2 text-xs font-medium uppercase tracking-wide ${text.muted} hover:text-[#f5f6f7] ${focusRing}`}
      >
        Cancel
      </button>
    </div>
  );
}
