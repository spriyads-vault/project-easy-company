import { describe, expect, it, vi, beforeEach } from "vitest";

// UX-09: "/" no longer renders anything itself — it's a pure dispatcher
// (see page.tsx's own comment). redirect() throws a special NEXT_REDIRECT
// error in a real Next.js runtime; mocked here the same way
// app-shell-chrome.test.tsx mocks next/navigation, so the assertion is
// "redirect was called with the right target" rather than trying to
// render past a throw.
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

let getUserResult: { data: { user: { id: string } | null } } = { data: { user: null } };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: () => Promise.resolve(getUserResult) },
  }),
}));

import Home from "./page";

describe("Home (root route dispatcher)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getUserResult = { data: { user: null } };
  });

  it("sends a signed-out visitor straight to /login, never rendering the old placeholder scaffold", async () => {
    await Home();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("sends a signed-in visitor straight to /investigations, not the placeholder", async () => {
    getUserResult = { data: { user: { id: "user-1" } } };
    await Home();
    expect(redirectMock).toHaveBeenCalledWith("/investigations");
  });
});
