import { describe, expect, it } from "vitest";
import { buildDocumentStoragePath } from "./storage-path";

describe("buildDocumentStoragePath", () => {
  it("builds a workspace/document/filename path (positive case)", () => {
    expect(buildDocumentStoragePath("ws-1", "doc-1", "Gateway-X-Schematic.pdf")).toBe(
      "ws-1/doc-1/Gateway-X-Schematic.pdf",
    );
  });

  it("keys the first path segment on the workspace id — the RLS policy's contract", () => {
    const path = buildDocumentStoragePath("ws-A", "doc-1", "file.pdf");
    expect(path.split("/")[0]).toBe("ws-A");
  });

  it("strips path separators from the filename so it can't traverse directories (security case)", () => {
    const path = buildDocumentStoragePath("ws-1", "doc-1", "../../etc/passwd.txt");
    expect(path).toBe("ws-1/doc-1/.._.._etc_passwd.txt");
    expect(path.split("/")).toHaveLength(3);
  });

  it("falls back to a placeholder name for an empty/whitespace filename (boundary case)", () => {
    expect(buildDocumentStoragePath("ws-1", "doc-1", "   ")).toBe("ws-1/doc-1/document");
  });
});
