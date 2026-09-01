// Creates and streams an analysis run. Not a chat endpoint: the response is
// a Server-Sent Events stream of typed Crado analysis events (see
// src/lib/analysis/events.ts), persisted to analysis_events as they're
// produced (src/lib/analysis/create-analysis-run.ts). This file owns only
// HTTP concerns — request parsing, auth, SSE framing; the actual pipeline
// and persistence logic is fully unit/integration-tested independently of
// Next.js's request lifecycle.
import { NextResponse } from "next/server";
import { JsonToSseTransformStream } from "ai";
import { z } from "zod";
import {
  createAnthropicHypothesisAdapter,
  resolveInvestigationAgentModel,
  type HypothesisModelAdapter,
} from "@/lib/ai/provider";
import { createClientFromRequest } from "@/lib/supabase/route-client";
import { createAnalysisRunForFailureCase } from "@/lib/analysis/create-analysis-run";
import type { AnalysisEvent } from "@/lib/analysis/events";

const requestBodySchema = z.object({
  failureCaseId: z.string().trim().min(1),
  measurementId: z.string().trim().min(1),
});

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
} as const;

/**
 * The real endpoint. Always uses the real Anthropic-backed adapter — never
 * a fake one. Tests exercise `handleCreateAnalysisRun` directly with a fake
 * adapter instead of calling this.
 */
export async function POST(request: Request): Promise<Response> {
  return handleCreateAnalysisRun(request, createAnthropicHypothesisAdapter());
}

export async function handleCreateAnalysisRun(
  request: Request,
  adapter: HypothesisModelAdapter,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "failureCaseId and measurementId are required." },
      { status: 400 },
    );
  }

  const supabase = createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // The Investigation Agent (MVP-10B) needs the same key the plain adapter
  // does — when it's not configured, omit agentModel entirely rather than
  // let resolveInvestigationAgentModel() throw here; the plain fallback
  // path already turns a missing key into a clean run.failed event.
  const agentModel = process.env.ANTHROPIC_API_KEY
    ? resolveInvestigationAgentModel()
    : undefined;

  const result = await createAnalysisRunForFailureCase(
    parsed.data,
    adapter,
    supabase,
    { agentModel },
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const stream = new ReadableStream<AnalysisEvent>({
    async start(controller) {
      for await (const event of result.events) {
        controller.enqueue(event);
      }
      controller.close();
    },
  });

  return new Response(
    stream.pipeThrough(new JsonToSseTransformStream()).pipeThrough(new TextEncoderStream()),
    { status: 200, headers: SSE_HEADERS },
  );
}
