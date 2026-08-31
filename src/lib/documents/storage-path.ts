// The private Storage path convention for uploaded documents. RLS on
// storage.objects (see the MVP-10A migration) keys off the first path
// segment matching the caller's own workspace id — this function is the
// single place that convention is encoded, so storage RLS and the
// application never drift apart.
export function buildDocumentStoragePath(
  workspaceId: string,
  documentId: string,
  filename: string,
): string {
  // Never trust a filename as a path component outright — strip anything
  // that could traverse directories or collide with the id segments.
  const safeName = filename.replace(/[/\\]/g, "_").trim() || "document";
  return `${workspaceId}/${documentId}/${safeName}`;
}
