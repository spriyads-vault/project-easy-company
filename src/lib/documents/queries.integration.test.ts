// Integration test: pagination, filtering, and workspace isolation for the
// Documents/Sources list, against real Postgres/RLS. The "scale" test
// below is the realistic programmatic dataset CLAUDE.md section 9 asks
// for — 120 document rows inserted directly (no real PDFs, no real
// extraction; this layer is about listing/pagination, not ingestion) to
// prove pagination and counting stay correct and bounded at a volume well
// past "a workspace has only 5 documents." Run with `pnpm test:integration`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { countDocumentCitationsByWorkspace, listEngineeringDocuments } from "./queries";
import {
  createAdminClient,
  createConfirmedUser,
  seedProductRevision,
} from "./integration-test-helpers";

function documentRow(index: number, overrides: Partial<{ productId: string }> = {}) {
  return {
    filename: `doc-${String(index).padStart(3, "0")}.txt`,
    document_type: "engineering_note" as const,
    mime_type: "text/plain",
    byte_size: 100,
    storage_path: `x/x/doc-${index}.txt`,
    status: "indexed" as const,
    product_id: overrides.productId ?? null,
    // Explicit, strictly increasing timestamps — real `now()` defaults
    // for 120 near-simultaneous inserts wouldn't reliably order.
    uploaded_at: new Date(2026_01_01_000_000 + index * 1000).toISOString(),
  };
}

describe("listEngineeringDocuments", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `docs-list-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `docs-list-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it(
    "paginates a realistic 120-document workspace correctly, with a real total count (scale test)",
    async () => {
      const rows = Array.from({ length: 120 }, (_, i) => documentRow(i));
      const { error } = await userA.client.from("engineering_documents").insert(rows);
      expect(error).toBeNull();

      const page1 = await listEngineeringDocuments(userA.client, { page: 1, pageSize: 25 });
      expect(page1.documents).toHaveLength(25);
      expect(page1.totalCount).toBe(120);
      // Most recently uploaded first — doc-119 has the latest uploaded_at.
      expect(page1.documents[0].filename).toBe("doc-119.txt");

      const page5 = await listEngineeringDocuments(userA.client, { page: 5, pageSize: 25 });
      // 120 documents / 25 per page = 5 full pages (120 = 4*25 + 20), so
      // page 5 holds the remaining 20 — never fetches all 120 to get there.
      expect(page5.documents).toHaveLength(20);
      expect(page5.totalCount).toBe(120);

      const pastTheEnd = await listEngineeringDocuments(userA.client, { page: 6, pageSize: 25 });
      expect(pastTheEnd.documents).toEqual([]);
      expect(pastTheEnd.totalCount).toBe(120);
    },
    20_000,
  );

  it("filters the list to a specific product", async () => {
    const productA = await seedProductRevision(userA.client, "Filter Product A");
    const productB = await seedProductRevision(userA.client, "Filter Product B");

    await userA.client.from("engineering_documents").insert([
      { ...documentRow(9001, { productId: productA.productId }), filename: "product-a-doc.txt" },
      { ...documentRow(9002, { productId: productB.productId }), filename: "product-b-doc.txt" },
    ]);

    const result = await listEngineeringDocuments(userA.client, { productId: productA.productId });
    expect(result.documents.map((d) => d.filename)).toContain("product-a-doc.txt");
    expect(result.documents.map((d) => d.filename)).not.toContain("product-b-doc.txt");
  });

  it("never lists another workspace's documents or counts them in the total (workspace isolation)", async () => {
    await userB.client.from("engineering_documents").insert(
      documentRow(9999, {}),
    );

    const asA = await listEngineeringDocuments(userA.client, { page: 1, pageSize: 5 });
    expect(asA.documents.every((d) => d.filename !== "doc-9999.txt")).toBe(true);

    const asB = await listEngineeringDocuments(userB.client, { page: 1, pageSize: 5 });
    expect(asB.totalCount).toBe(1);
    expect(asB.documents[0].filename).toBe("doc-9999.txt");
  });

  it("returns an empty list with a real zero count for a workspace with no documents (missing-data case)", async () => {
    const freshUser = await createConfirmedUser(admin, `docs-list-empty-${Date.now()}@example.com`);
    try {
      const result = await listEngineeringDocuments(freshUser.client, {});
      expect(result).toMatchObject({ documents: [], totalCount: 0 });
    } finally {
      await admin.auth.admin.deleteUser(freshUser.id);
    }
  });
});

describe("countDocumentCitationsByWorkspace", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `docs-cite-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `docs-cite-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  async function seedCitedDocument(
    db: SupabaseClient<Database>,
    filename: string,
  ): Promise<{ documentId: string; runId: string }> {
    const { data: doc, error: docError } = await db
      .from("engineering_documents")
      .insert({
        filename,
        document_type: "schematic",
        mime_type: "application/pdf",
        byte_size: 100,
        storage_path: `x/x/${filename}`,
        status: "indexed",
      })
      .select("id")
      .single();
    if (docError || !doc) throw docError ?? new Error("no document");

    const { data: product } = await db.from("products").insert({ name: `Cite Test ${filename}` }).select("id").single();
    const { data: revision } = await db
      .from("product_revisions")
      .insert({ product_id: product!.id, label: "Rev1" })
      .select("id")
      .single();
    const { data: failureCase } = await db
      .from("failure_cases")
      .insert({ product_revision_id: revision!.id, title: `Case for ${filename}` })
      .select("id")
      .single();
    const { data: run } = await db
      .from("analysis_runs")
      .insert({ failure_case_id: failureCase!.id, status: "completed" })
      .select("id")
      .single();
    return { documentId: doc.id, runId: run!.id };
  }

  async function insertCitationEvent(
    db: SupabaseClient<Database>,
    runId: string,
    sequence: number,
    documentId: string,
    chunkId: string,
  ) {
    await db.from("analysis_events").insert({
      analysis_run_id: runId,
      sequence,
      event_type: "hypothesis.created",
      payload: {
        productFactId: "fact-x",
        title: "Test hypothesis",
        confidenceBand: "medium",
        recommendedNextStep: "Re-measure.",
        evidence: [
          {
            category: "known",
            description: "Cited passage.",
            citation: {
              documentId,
              chunkId,
              filename: "irrelevant.pdf",
              documentType: "schematic",
              pageNumber: null,
              section: null,
              passage: "irrelevant",
            },
          },
        ],
      },
    });
  }

  it("counts real, distinct citations for a document across multiple hypotheses/runs (real, not fabricated)", async () => {
    const { documentId, runId } = await seedCitedDocument(userA.client, `cited-${Date.now()}.pdf`);
    await insertCitationEvent(userA.client, runId, 0, documentId, "chunk-1");
    await insertCitationEvent(userA.client, runId, 1, documentId, "chunk-2");

    const counts = await countDocumentCitationsByWorkspace(userA.client);
    expect(counts.get(documentId)).toBe(2);
  });

  it("never counts another workspace's citations toward this workspace's documents (workspace isolation)", async () => {
    const { documentId, runId } = await seedCitedDocument(userB.client, `isolated-${Date.now()}.pdf`);
    await insertCitationEvent(userB.client, runId, 0, documentId, "chunk-1");

    const asA = await countDocumentCitationsByWorkspace(userA.client);
    expect(asA.has(documentId)).toBe(false);

    const asB = await countDocumentCitationsByWorkspace(userB.client);
    expect(asB.get(documentId)).toBe(1);
  });

  it("returns an empty map, not a fabricated zero-count entry, for a document that was never cited (missing-data case)", async () => {
    const { documentId } = await seedCitedDocument(userA.client, `uncited-${Date.now()}.pdf`);
    const counts = await countDocumentCitationsByWorkspace(userA.client);
    expect(counts.has(documentId)).toBe(false);
  });
});
