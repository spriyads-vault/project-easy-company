"use client";

import { useActionState } from "react";
import { uploadEngineeringDocument, type UploadDocumentFormState } from "./actions";
import { surface, text } from "./theme";

const initialState: UploadDocumentFormState = {};

const DOCUMENT_TYPES = [
  { value: "schematic", label: "Schematic" },
  { value: "pcb", label: "PCB" },
  { value: "test_report", label: "Test report" },
  { value: "datasheet", label: "Datasheet" },
  { value: "regulatory", label: "Regulatory" },
  { value: "mechanical", label: "Mechanical" },
  { value: "engineering_note", label: "Engineering note" },
  { value: "other", label: "Other" },
] as const;

const inputClass =
  "border border-[#2c2f27] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3ecf6e]/60";

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadEngineeringDocument, initialState);

  return (
    <form
      action={formAction}
      noValidate
      className={`flex flex-col gap-3 p-4 ${surface.panel}`}
    >
      <span className={text.kicker}>Upload document</span>

      <label className="flex flex-col gap-1 text-sm">
        File (PDF, TXT, or Markdown)
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          className="text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Document type
        <select name="documentType" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a type…
          </option>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      {state.error ? (
        <p role="alert" className={`text-sm ${text.mono} ${text.muted}`}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[#5fdb87]">
          Uploaded. See its status below.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-[#3ecf6e]/50 bg-[#3ecf6e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#5fdb87] transition-colors hover:bg-[#3ecf6e]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
