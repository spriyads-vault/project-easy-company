// Shared setup for this module's integration tests (search, ingestion,
// pagination, workspace isolation) — mirrors the pattern in
// src/lib/analysis/create-analysis-run.integration.test.ts. Not itself a
// test file (doesn't match *.integration.test.ts), so it's never picked up
// by the test runner on its own.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const API_URL = "http://127.0.0.1:54321";
export const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(API_URL, SERVICE_ROLE_KEY);
}

export async function createConfirmedUser(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<{ id: string; client: SupabaseClient<Database> }> {
  const password = "correct-horse-battery-staple";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user returned");

  const client = createClient<Database>(API_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

/** A minimal product + revision, for tests that need documents scoped to
 * one. Not every document needs this — many are workspace-level. */
export async function seedProductRevision(
  db: SupabaseClient<Database>,
  productName = "Gateway X",
): Promise<{ productId: string; revisionId: string }> {
  const { data: product, error: productError } = await db
    .from("products")
    .insert({ name: productName })
    .select("id")
    .single();
  if (productError || !product) throw productError ?? new Error("no product");

  const { data: revision, error: revisionError } = await db
    .from("product_revisions")
    .insert({ product_id: product.id, label: "Rev1" })
    .select("id")
    .single();
  if (revisionError || !revision) throw revisionError ?? new Error("no revision");

  return { productId: product.id, revisionId: revision.id };
}
