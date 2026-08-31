// Integration test: exercises real Postgres RLS against a local Supabase
// instance (`supabase start`). Not part of `pnpm test` — run explicitly with
// `pnpm test:integration` once the local stack is running, since it needs
// Docker and is too slow/environment-dependent for the default unit run.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

async function createConfirmedUser(
  admin: SupabaseClient,
  email: string,
): Promise<TestUser> {
  const password = "correct-horse-battery-staple";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("createUser returned no user");
  }

  const client = createClient(API_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, email, password, client };
}

describe("workspaces RLS", () => {
  const admin = createClient(API_URL, SERVICE_ROLE_KEY);
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    const suffix = Date.now();
    userA = await createConfirmedUser(admin, `rls-a-${suffix}@example.com`);
    userB = await createConfirmedUser(admin, `rls-b-${suffix}@example.com`);
  }, 20_000);

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("auto-provisions a private workspace on sign-up", async () => {
    const { data, error } = await userA.client
      .from("workspaces")
      .select("id, owner_id")
      .single();

    expect(error).toBeNull();
    expect(data?.owner_id).toBe(userA.id);
  });

  it("does not let a user read another user's workspace", async () => {
    // Look up B's workspace id via the admin (service-role) client, then try
    // to read that exact row as A. RLS must filter it out silently — the
    // request should succeed with zero rows, not error.
    const { data: workspaceB } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", userB.id)
      .single();
    expect(workspaceB).toBeTruthy();

    const { data, error } = await userA.client
      .from("workspaces")
      .select("id")
      .eq("id", workspaceB!.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not let a user update another user's workspace", async () => {
    const { data: workspaceB } = await admin
      .from("workspaces")
      .select("id, name")
      .eq("owner_id", userB.id)
      .single();

    const { data, error } = await userA.client
      .from("workspaces")
      .update({ name: "hijacked" })
      .eq("id", workspaceB!.id)
      .select();

    // RLS blocks the row from matching at all: no error, no rows affected.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: unchanged } = await admin
      .from("workspaces")
      .select("name")
      .eq("owner_id", userB.id)
      .single();
    expect(unchanged?.name).toBe(workspaceB!.name);
  });
});
