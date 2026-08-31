// Unit tests for the thin HTTP wrapper's request-parsing only — these run
// before the handler ever builds a Supabase client, so no local Supabase
// instance is needed. Auth gating (which does need a reachable Supabase
// Auth endpoint to conclusively answer "no user") is covered by
// route.integration.test.ts instead. The substantial logic (persistence,
// correlation, hypothesis merge) is covered by
// src/lib/analysis/run-analysis.test.ts (no DB) and
// create-analysis-run.integration.test.ts (real local Supabase).
import { describe, expect, it } from "vitest";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import { handleCreateAnalysisRun } from "./route";

function unusedAdapter(): HypothesisModelAdapter {
  return {
    generateHypotheses: async () => {
      throw new Error("should never be called for a request that fails before this point");
    },
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/analysis-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleCreateAnalysisRun", () => {
  it("returns 400 for a malformed JSON body", async () => {
    const request = new Request("http://localhost:3000/api/analysis-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    const response = await handleCreateAnalysisRun(request, unusedAdapter());

    expect(response.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await handleCreateAnalysisRun(
      jsonRequest({ failureCaseId: "case-1" }),
      unusedAdapter(),
    );

    expect(response.status).toBe(400);
  });

});
