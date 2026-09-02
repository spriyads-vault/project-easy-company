"use client";

import { useActionState } from "react";
import { uploadEngineeringDocument, type UploadDocumentFormState } from "./actions";
import { surface } from "./theme";
import { focusRing, radius, typography } from "@/lib/design/tokens";

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

const inputClass = `${radius.control} border border-[#e4e4e7] bg-white px-3 py-2 text-sm outline-none ${focusRing}`;

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadEngineeringDocument, initialState);

  return (
    <form
      action={formAction}
      noValidate
      className={`flex flex-col gap-3 p-5 ${surface.card}`}
    >
      <h2 className={typography.sectionHeading}>Upload document</h2>

      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
        File (PDF, TXT, or Markdown)
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          className="text-sm text-[#18181b]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-[#18181b]">
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
        <p role="alert" className="rounded-lg border border-[#b45309]/40 bg-[#b45309]/10 p-2 text-sm text-[#b45309]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-[#15803d]">
          Uploaded. See its status below.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`self-start ${radius.control} border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
