import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked before importing the module under test so updateSession never
// touches a real Supabase project. getUserResult is mutated per-test —
// simplest way to control what auth.getUser() resolves to without
// re-mocking the module for every case.
let getUserResult: { data: { user: { id: string } | null } } = { data: { user: null } };

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: () => Promise.resolve(getUserResult),
    },
  })),
}));

vi.mock("./env", () => ({
  getPublicSupabaseEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }),
}));

import { updateSession } from "./middleware";

function makeRequest(pathname: string, cookieHeader?: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

describe("updateSession", () => {
  beforeEach(() => {
    getUserResult = { data: { user: null } };
  });

  it("lets an authenticated visitor through to a private route", async () => {
    getUserResult = { data: { user: { id: "user-1" } } };
    const response = await updateSession(makeRequest("/investigations"));
    expect(response.status).not.toBe(307);
  });

  it("redirects an unauthenticated visitor away from a private route to /login with next set", async () => {
    const response = await updateSession(makeRequest("/cases/abc-123"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/cases/abc-123");
    expect(location.searchParams.has("expired")).toBe(false);
  });

  it("marks the redirect as an expired session when a stale Supabase auth cookie was present", async () => {
    const response = await updateSession(
      makeRequest("/investigations", "sb-myproject-auth-token=stale-value"),
    );
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("expired")).toBe("1");
  });

  it("does not mark expired when there was never a Supabase auth cookie at all", async () => {
    const response = await updateSession(makeRequest("/investigations", "unrelated=1"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.has("expired")).toBe(false);
  });

  it("never redirects a public path even when unauthenticated", async () => {
    for (const path of ["/", "/login", "/signup", "/auth/confirm"]) {
      const response = await updateSession(makeRequest(path));
      expect(response.status).not.toBe(307);
    }
  });
});
