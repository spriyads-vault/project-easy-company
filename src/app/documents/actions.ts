"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  documentTypeSchema,
  uploadDocumentInputSchema,
} from "@/lib/domain/schema";
import { buildDocumentStoragePath } from "@/lib/documents/storage-path";
import { ingestDocument } from "@/lib/documents/ingest-document";
import {
  searchEngineeringDocuments,
  type EngineeringDocumentPassage,
} from "@/lib/documents/search";

export interface UploadDocumentFormState {
  error?: string;
  success?: boolean;
}

const STORAGE_BUCKET = "engineering-documents";

export async function uploadEngineeringDocument(
  _prevState: UploadDocumentFormState,
  formData: FormData,
): Promise<UploadDocumentFormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const documentTypeRaw = formData.get("documentType");
  const productIdRaw = formData.get("productId");
  const productRevisionIdRaw = formData.get("productRevisionId");

  const parsed = uploadDocumentInputSchema.safeParse({
    filename: file.name,
    // Browsers sometimes send an empty/absent MIME type for .md files —
    // fall back to sniffing the extension rather than rejecting a
    // perfectly valid Markdown upload.
    mimeType: file.type || sniffMimeTypeFromFilename(file.name),
    byteSize: file.size,
    documentType: documentTypeSchema.safeParse(documentTypeRaw).success
      ? documentTypeRaw
      : undefined,
    productId: typeof productIdRaw === "string" && productIdRaw ? productIdRaw : undefined,
    productRevisionId:
      typeof productRevisionIdRaw === "string" && productRevisionIdRaw
        ? productRevisionIdRaw
        : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid upload." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: workspaceId, error: workspaceError } = await supabase.rpc(
    "current_workspace_id",
  );
  if (workspaceError || !workspaceId) {
    return { error: "Could not resolve your workspace." };
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath(workspaceId, documentId, parsed.data.filename);

  const { error: insertError } = await supabase.from("engineering_documents").insert({
    id: documentId,
    filename: parsed.data.filename,
    document_type: parsed.data.documentType,
    mime_type: parsed.data.mimeType,
    byte_size: parsed.data.byteSize,
    product_id: parsed.data.productId ?? null,
    product_revision_id: parsed.data.productRevisionId ?? null,
    storage_path: storagePath,
    status: "uploading",
  });
  if (insertError) {
    return { error: "Could not start the upload." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: parsed.data.mimeType, upsert: false });
  if (uploadError) {
    await supabase
      .from("engineering_documents")
      .update({ status: "failed", failure_reason: "Could not upload the file to storage." })
      .eq("id", documentId);
    revalidatePath("/documents");
    return { error: "Upload failed." };
  }

  await supabase.from("engineering_documents").update({ status: "processing" }).eq("id", documentId);

  const result = await ingestDocument(supabase, {
    documentId,
    buffer: bytes,
    mimeType: parsed.data.mimeType,
  });

  revalidatePath("/documents");

  if (result.status === "failed") {
    // Not a form error — the upload itself succeeded. The document row
    // (now status: failed, with result.failureReason) carries the honest
    // outcome, visible in the list.
    return { success: true };
  }
  return { success: true };
}

export interface SearchDocumentsFormState {
  query?: string;
  results?: EngineeringDocumentPassage[];
  error?: string;
}

export async function searchDocumentsAction(
  _prevState: SearchDocumentsFormState,
  formData: FormData,
): Promise<SearchDocumentsFormState> {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) {
    return { query, results: [] };
  }

  const productId = String(formData.get("productId") ?? "").trim() || undefined;
  const productRevisionId =
    String(formData.get("productRevisionId") ?? "").trim() || undefined;

  const supabase = await createClient();
  const results = await searchEngineeringDocuments(supabase, {
    query,
    productId,
    productRevisionId,
    limit: 10,
  });

  return { query, results };
}

function sniffMimeTypeFromFilename(filename: string): string {
  if (filename.endsWith(".md") || filename.endsWith(".markdown")) return "text/markdown";
  if (filename.endsWith(".txt")) return "text/plain";
  if (filename.endsWith(".pdf")) return "application/pdf";
  return "";
}
