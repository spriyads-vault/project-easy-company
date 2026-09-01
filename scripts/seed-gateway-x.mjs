#!/usr/bin/env node
// Reproducible local Gateway X demo seed (PERF-01). Creates exactly the
// case the pilot demo/benchmarks describe: Gateway X, Rev17, a 40 MHz
// system clock fact, a radiated-emissions failure case, and its first
// measurement (200 MHz, +7.4 dB, "WiFi TX + display active") — one click
// away from RUN INVESTIGATION. Deterministic and safe to rerun: every step
// checks for the natural-key row it would create first and reuses it
// instead of inserting a duplicate.
//
// Inserts go through a signed-in (anon-key) client, not the service-role
// client directly — current_workspace_id() (see supabase/migrations/
// *_core_domain.sql) resolves from auth.uid(), which a service-role
// request has none of. This mirrors the exact pattern
// src/lib/documents/integration-test-helpers.ts uses for the same reason.
//
// Usage: pnpm seed:gateway-x
// Requires local Supabase running (`supabase start`).
import { createClient } from "@supabase/supabase-js";

// Same well-known local-only demo keys already used by
// src/lib/documents/integration-test-helpers.ts — not secrets, and this
// script only ever runs against a local `supabase start` instance.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DEMO_EMAIL = "gateway-x-demo@crado.local";
const DEMO_PASSWORD = "correct-horse-battery-staple";

const PRODUCT_NAME = "Gateway X";
const REVISION_LABEL = "Rev17";
const FAILURE_CASE_TITLE = "Radiated emissions — Gateway X Rev17";
const CLOCK_FACT = { label: "system clock", frequencyMhz: 40 };
const MEASUREMENT = {
  operatingMode: "WiFi TX + display active",
  frequencyMhz: 200,
  marginDb: 7.4,
};

async function ensureDemoUser(admin) {
  // No admin.auth.getUserByEmail in supabase-js — page through
  // listUsers() instead. The local demo instance has few enough users
  // that one unpaged call is enough; safe to rerun indefinitely.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const found = existing.users.find((user) => user.email === DEMO_EMAIL);
  if (found) return found.id;

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user returned from createUser");
  return data.user.id;
}

async function ensureProduct(db) {
  const { data: existing } = await db.from("products").select("id").eq("name", PRODUCT_NAME).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db.from("products").insert({ name: PRODUCT_NAME }).select("id").single();
  if (error || !data) throw error ?? new Error("no product returned");
  return data.id;
}

async function ensureRevision(db, productId) {
  const { data: existing } = await db
    .from("product_revisions")
    .select("id")
    .eq("product_id", productId)
    .eq("label", REVISION_LABEL)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("product_revisions")
    .insert({ product_id: productId, label: REVISION_LABEL })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("no revision returned");
  return data.id;
}

async function ensureClockFact(db, revisionId) {
  const { count } = await db
    .from("product_facts")
    .select("id", { count: "exact", head: true })
    .eq("product_revision_id", revisionId)
    .eq("category", "clock");
  if (count && count > 0) return;

  const { error } = await db.from("product_facts").insert({
    product_revision_id: revisionId,
    category: "clock",
    fact: CLOCK_FACT,
  });
  if (error) throw error;
}

async function ensureFailureCase(db, revisionId) {
  const { data: existing } = await db
    .from("failure_cases")
    .select("id")
    .eq("product_revision_id", revisionId)
    .eq("title", FAILURE_CASE_TITLE)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("failure_cases")
    .insert({ product_revision_id: revisionId, title: FAILURE_CASE_TITLE })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("no failure case returned");
  return data.id;
}

async function ensureFirstMeasurement(db, failureCaseId, revisionId) {
  const { data: existing } = await db
    .from("measurements")
    .select("id")
    .eq("failure_case_id", failureCaseId)
    .eq("product_revision_id", revisionId)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: measurement, error: measurementError } = await db
    .from("measurements")
    .insert({
      failure_case_id: failureCaseId,
      product_revision_id: revisionId,
      operating_mode: MEASUREMENT.operatingMode,
    })
    .select("id")
    .single();
  if (measurementError || !measurement) throw measurementError ?? new Error("no measurement returned");

  const { error: peakError } = await db.from("measurement_peaks").insert({
    measurement_id: measurement.id,
    frequency_mhz: MEASUREMENT.frequencyMhz,
    margin_db: MEASUREMENT.marginDb,
  });
  if (peakError) throw peakError;
  return measurement.id;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await ensureDemoUser(admin);

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;

  const productId = await ensureProduct(anon);
  const revisionId = await ensureRevision(anon, productId);
  await ensureClockFact(anon, revisionId);
  const failureCaseId = await ensureFailureCase(anon, revisionId);
  await ensureFirstMeasurement(anon, failureCaseId, revisionId);

  console.log("Gateway X demo case ready.");
  console.log(`  Sign in:  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Case:     http://localhost:3000/cases/${failureCaseId}`);
  console.log(`  Workspace: ready for RUN INVESTIGATION — no further setup needed.`);
}

main().catch((error) => {
  console.error("Seeding Gateway X demo case failed:", error);
  process.exitCode = 1;
});
