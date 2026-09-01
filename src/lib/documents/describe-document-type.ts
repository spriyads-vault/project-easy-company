// One shared human-readable label per DocumentType — used by the Sources
// page (src/app/documents) and the investigation workspace's Sources panel
// (src/app/cases/[caseId]/investigation), so the two never drift.
import type { DocumentType } from "@/lib/domain/schema";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  schematic: "Schematic",
  pcb: "PCB",
  test_report: "Test report",
  datasheet: "Datasheet",
  regulatory: "Regulatory",
  mechanical: "Mechanical",
  engineering_note: "Engineering note",
  other: "Other",
};

export function describeDocumentType(documentType: string): string {
  return DOCUMENT_TYPE_LABEL[documentType as DocumentType] ?? documentType;
}

/** Coarse groupings for the Sources page's filter tabs — a handful of
 * concrete DocumentTypes map to each. "other" and "engineering_note" fall
 * under "notes"; nothing is invented, every group only ever contains real
 * DocumentType values. */
export const DOCUMENT_TYPE_GROUPS: Record<string, DocumentType[]> = {
  product: ["schematic", "pcb", "mechanical"],
  testing: ["test_report"],
  regulatory: ["regulatory"],
  datasheets: ["datasheet"],
  notes: ["engineering_note", "other"],
};
