// The one part of the route handler that genuinely needs a reachable
// Supabase Auth endpoint to answer conclusively: "is there a signed-in
// user?" Requires `supabase start`; run with `pnpm test:integration`.
import { describe, expect, it } from "vitest";
import type { HypothesisModelAdapter } from "@/lib/ai/provider";
import { handleCreateAnalysisRun } from "./route";

function unusedAdapter(): HypothesisModelAdapter {
  return {
    generateHypotheses: async () => {
      throw new Error("should never be called for an unauthenticated request");
    },
  };
}

describe("handleCreateAnalysisRun — auth", () => {
  it("returns 401 for a request with no session cookie", async () => {
    const request = new Request("http://localhost:3000/api/analysis-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failureCaseId: "case-1", measurementId: "measurement-1" }),
    });

    const response = await handleCreateAnalysisRun(request, unusedAdapter());

    expect(response.status).toBe(401);
  });
});
