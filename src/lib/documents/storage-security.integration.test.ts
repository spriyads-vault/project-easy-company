// Integration test: private Storage RLS (CLAUDE.md section 10 — "Workspace
// A cannot: retrieve/download Workspace B documents, search Workspace B
// chunks, guess file paths/UUIDs"). Real local Supabase Storage, real
// sign-in as two separate users, no service-role shortcuts. Run with
// `pnpm test:integration`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildDocumentStoragePath } from "./storage-path";
import { createAdminClient, createConfirmedUser } from "./integration-test-helpers";

const BUCKET = "engineering-documents";

describe("engineering-documents storage isolation", () => {
  const admin = createAdminClient();
  let userA: { id: string; client: SupabaseClient<Database>; workspaceId: string };
  let userB: { id: string; client: SupabaseClient<Database>; workspaceId: string };

  beforeAll(async () => {
    const suffix = Date.now();
    const a = await createConfirmedUser(admin, `storage-a-${suffix}@example.com`);
    const b = await createConfirmedUser(admin, `storage-b-${suffix}@example.com`);
    const { data: wsA } = await admin.from("workspaces").select("id").eq("owner_id", a.id).single();
    const { data: wsB } = await admin.from("workspaces").select("id").eq("owner_id", b.id).single();
    userA = { ...a, workspaceId: wsA!.id };
    userB = { ...b, workspaceId: wsB!.id };
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("bucket is private — never publicly readable", async () => {
    const { data: bucket } = await admin.storage.getBucket(BUCKET);
    expect(bucket?.public).toBe(false);
  });

  it("the owning workspace can upload and download its own file (positive case)", async () => {
    const path = buildDocumentStoragePath(userA.workspaceId, crypto.randomUUID(), "own-file.txt");
    const { error: uploadError } = await userA.client.storage
      .from(BUCKET)
      .upload(path, new TextEncoder().encode("Gateway X schematic notes."), {
        contentType: "text/plain",
      });
    expect(uploadError).toBeNull();

    const { data, error: downloadError } = await userA.client.storage.from(BUCKET).download(path);
    expect(downloadError).toBeNull();
    expect(await data?.text()).toBe("Gateway X schematic notes.");
  });

  it("a workspace cannot download another workspace's file, even knowing its exact path (workspace isolation)", async () => {
    const path = buildDocumentStoragePath(
      userB.workspaceId,
      crypto.randomUUID(),
      "workspace-b-secret.txt",
    );
    const { error: uploadError } = await userB.client.storage
      .from(BUCKET)
      .upload(path, new TextEncoder().encode("Workspace B confidential content."), {
        contentType: "text/plain",
      });
    expect(uploadError).toBeNull();

    // userA knows the exact real path (simulating a leaked/guessed
    // reference) and still cannot read it.
    const { data, error } = await userA.client.storage.from(BUCKET).download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("a workspace cannot list another workspace's folder by guessing its UUID prefix", async () => {
    const { data, error } = await userA.client.storage.from(BUCKET).list(userB.workspaceId);
    // RLS makes this look like an empty/nonexistent folder, not a
    // permission error that would confirm the workspace id is valid.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a workspace cannot upload into another workspace's path prefix", async () => {
    const path = buildDocumentStoragePath(userB.workspaceId, crypto.randomUUID(), "planted.txt");
    const { error } = await userA.client.storage
      .from(BUCKET)
      .upload(path, new TextEncoder().encode("should never land here"), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });

  it("a workspace cannot delete another workspace's file", async () => {
    const path = buildDocumentStoragePath(
      userB.workspaceId,
      crypto.randomUUID(),
      "do-not-delete.txt",
    );
    await userB.client.storage
      .from(BUCKET)
      .upload(path, new TextEncoder().encode("content"), { contentType: "text/plain" });

    const { error } = await userA.client.storage.from(BUCKET).remove([path]);
    // storage-js reports a no-op removal as success with an empty data
    // array rather than an error when RLS silently excludes the row —
    // the meaningful assertion is that the file is still there after.
    void error;
    const { data: stillThere } = await userB.client.storage.from(BUCKET).download(path);
    expect(await stillThere?.text()).toBe("content");
  });
});
