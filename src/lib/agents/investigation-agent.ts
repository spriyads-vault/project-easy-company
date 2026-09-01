// The Investigation Agent (MVP-10B): a ToolLoopAgent (Vercel AI SDK 7) that
// decides what additional context it needs — documents, previous
// revisions, previous investigations — before proposing hypotheses. The
// deterministic pipeline (measurement load, MVP-06 correlation) always runs
// first and is never something the agent decides whether to do; this
// module only starts once correlation candidates already exist (see
// run-analysis.ts).
//
// createInvestigationAgent is a factory, not a module-level singleton: a
// fresh agent (and a fresh tool set, closed over one already-authenticated,
// workspace-scoped Supabase client) is built per investigation run, so
// nothing here can leak one workspace's request into another's.
import { Output, ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { agentOutputSchema } from "./schema";
import {
  createInvestigationTools,
  type InvestigationToolsContext,
} from "./tools";
import {
  createEmptyRegistry,
  validateAgentOutput,
  buildAgentCompletedPayload,
  type RetrievedRegistry,
} from "./validate-agent-output";
import type { FinalHypothesis } from "@/lib/hypotheses/schema";
import type { MeasurementForHypotheses } from "@/lib/hypotheses/generate-hypotheses";
import type {
  AgentCompletedPayload,
  AgentToolCompletedPayload,
} from "@/lib/analysis/events";

// Target ~8-10 steps (CLAUDE.md/ticket): each tool call plus the model's
// reply is one step, so this bounds the agent to a handful of targeted
// lookups (context, correlations, a few document searches) rather than the
// SDK's default 20-step allowance. Nothing in testing has shown a need for
// more; raise this only with a demonstrated reason.
const MAX_AGENT_STEPS = 9;

const SYSTEM_PROMPT = `
You are assisting a hardware engineer investigating a radiated-emissions test failure. You have no access to the physical device — only the tools below, which read this workspace's own stored data.

Use tools to gather what you need before answering:
- getMeasurementContext and getDeterministicCorrelations ground you in the failing measurement and the already-computed harmonic candidates. Never invent a correlation yourself — only use candidates this tool actually returns.
- getProductContext gives you the product's structured facts (clocks, radios, power rails, cables).
- searchEngineeringDocuments lets you look up relevant passages from indexed documents. Call it more than once with different, specific queries (e.g. a component, then a signal path, then a frequency) rather than one broad query. It returns exact passages, never a whole document — cite only the chunkId/documentId you actually received back.
- getPreviousRevisions and getPreviousInvestigations tell you about related history, when relevant.

Then propose up to 5 ranked investigation hypotheses. Rules:
- Every hypothesis's productFactId must exactly match one of the productFactId values from getDeterministicCorrelations. Never invent one.
- Every evidenceRef must point to an id (chunkId+documentId, productFactId, or investigationEventId) you actually received back from a tool call this run. Never invent one, and never cite a document you did not search for.
- Your reasoning is an inference, never a certainty claim. Never say a hypothesis is confirmed, proven, verified, or the definitive root cause.
- missingEvidence lists what an engineer would need to check to support or rule out the hypothesis.
- nextInvestigation is a suggestion for a qualified engineer's next physical measurement or check — never an instruction to certify, ship, or declare compliance.
- Only set clarificationQuestion if one missing fact would materially change the ranking; otherwise it must be null.
- Keep reasoning and nextInvestigation concise — a few sentences, not a full report.
- Set investigationStatus to "clarification_needed" if you set a clarificationQuestion, "insufficient_evidence" if you found no sound candidate to build a hypothesis from, otherwise "hypotheses_ready".
- State conclusions and evidence, not your own step-by-step deliberation.
`.trim();

const TASK_PROMPT =
  "Investigate this radiated-emissions failure. Start by loading the measurement context and the deterministic correlation candidates, then decide what else you need.";

export interface CreateInvestigationAgentParams {
  supabase: SupabaseClient<Database>;
  model: LanguageModel;
  caseContext: InvestigationToolsContext;
}

export interface RunInvestigationAgentResult {
  activity: AgentToolCompletedPayload[];
  hypotheses: FinalHypothesis[];
  clarificationQuestion: string | null;
  metrics: AgentCompletedPayload;
}

function toolActivityLabel(
  toolName: string,
  resultCount: number | null,
  failed: boolean,
): string {
  if (failed) {
    return `${TOOL_DISPLAY_NAMES[toolName] ?? toolName} — unavailable`;
  }
  const name = TOOL_DISPLAY_NAMES[toolName] ?? toolName;
  const noun = TOOL_RESULT_NOUNS[toolName] ?? { singular: "result", suffix: "" };
  if (resultCount === null) return name;
  const nounText = resultCount === 1 ? noun.singular : `${noun.singular}s`;
  const label = noun.suffix ? `${nounText} ${noun.suffix}` : nounText;
  return `${name} / ${resultCount} ${label}`;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  getProductContext: "Loaded product context",
  getMeasurementContext: "Loaded measurement context",
  getDeterministicCorrelations: "Checked deterministic relationships",
  searchEngineeringDocuments: "Searched engineering documents",
  getPreviousRevisions: "Reviewed previous revisions",
  getPreviousInvestigations: "Reviewed previous investigations",
};

// Pluralizing splits singular/suffix so "1 candidate found" -> "2
// candidates found", never the naive-concatenation "2 candidate founds".
const TOOL_RESULT_NOUNS: Record<string, { singular: string; suffix: string }> = {
  getProductContext: { singular: "structured fact", suffix: "" },
  getMeasurementContext: { singular: "peak", suffix: "" },
  getDeterministicCorrelations: { singular: "candidate", suffix: "found" },
  searchEngineeringDocuments: { singular: "passage", suffix: "retrieved" },
  getPreviousRevisions: { singular: "revision", suffix: "found" },
  getPreviousInvestigations: { singular: "event", suffix: "found" },
};

function extractResultCount(toolName: string, output: unknown): number | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  switch (toolName) {
    case "getProductContext":
      return Array.isArray(record.facts) ? record.facts.length : null;
    case "getMeasurementContext": {
      const measurement = record.measurement as { peaks?: unknown[] } | undefined;
      return Array.isArray(measurement?.peaks) ? measurement.peaks.length : null;
    }
    case "getDeterministicCorrelations":
      return Array.isArray(record.candidates) ? record.candidates.length : null;
    case "searchEngineeringDocuments":
      return Array.isArray(record.passages) ? record.passages.length : null;
    case "getPreviousRevisions":
      return Array.isArray(record.revisions) ? record.revisions.length : null;
    case "getPreviousInvestigations":
      return Array.isArray(record.events) ? record.events.length : null;
    default:
      return null;
  }
}

/**
 * Feeds one completed tool call into the retrieved-IDs registry (for
 * citation validation) and the documents-searched/passages-retrieved
 * counters (for the truthful agent.completed metrics). Never touches
 * anything the model said about itself — only the tool's actual output.
 */
function absorbToolResult(
  registry: RetrievedRegistry,
  toolName: string,
  output: unknown,
): void {
  if (!output || typeof output !== "object") return;
  const record = output as Record<string, unknown>;
  switch (toolName) {
    case "getProductContext": {
      const facts = record.facts as { id: string }[] | undefined;
      for (const fact of facts ?? []) registry.productFactIds.add(fact.id);
      break;
    }
    case "searchEngineeringDocuments": {
      const passages = record.passages as
        | {
            chunkId: string;
            documentId: string;
            filename: string;
            pageNumber: number | null;
            section: string | null;
            passage: string;
          }[]
        | undefined;
      registry.documentSearchCount += 1;
      for (const passage of passages ?? []) {
        registry.passagesRetrievedCount += 1;
        registry.documentPassagesByChunkId.set(passage.chunkId, passage);
      }
      break;
    }
    case "getPreviousInvestigations": {
      const events = record.events as
        | { id: string; eventType: string; description: string }[]
        | undefined;
      for (const event of events ?? []) {
        registry.investigationEventsById.set(event.id, event);
      }
      break;
    }
    default:
      break;
  }
}

export function createInvestigationAgent(params: CreateInvestigationAgentParams) {
  const tools = createInvestigationTools(params.caseContext);
  return new ToolLoopAgent({
    model: params.model,
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    output: Output.object({ schema: agentOutputSchema }),
  });
}

/**
 * Runs one investigation: builds a fresh agent+tools, executes the tool
 * loop, and independently validates the result before returning it. Never
 * throws for a model/tool failure that the SDK already turned into a
 * tool-error or a step-limit finish — those surface as an
 * investigationStatus/empty-hypotheses outcome, not a crash; only a truly
 * unrecoverable error (e.g. no output at all) propagates, matching
 * MVP-08's runAnalysis convention of letting the caller turn it into
 * run.failed.
 */
export async function runInvestigationAgent(
  params: CreateInvestigationAgentParams,
  documentsAvailable: number,
  measurement: MeasurementForHypotheses,
): Promise<RunInvestigationAgentResult> {
  const agent = createInvestigationAgent(params);
  const registry = createEmptyRegistry(documentsAvailable);
  const activity: AgentToolCompletedPayload[] = [];

  const result = await agent.generate({
    prompt: TASK_PROMPT,
    onToolExecutionEnd: (event) => {
      const toolName = event.toolCall.toolName;
      const failed = event.toolOutput.type === "tool-error";
      const output = event.toolOutput.type === "tool-result" ? event.toolOutput.output : null;
      if (!failed) absorbToolResult(registry, toolName, output);

      const resultCount = failed ? null : extractResultCount(toolName, output);
      const query =
        toolName === "searchEngineeringDocuments" &&
        event.toolCall.input &&
        typeof event.toolCall.input === "object"
          ? ((event.toolCall.input as { query?: string }).query ?? null)
          : null;

      activity.push({
        toolName,
        label: toolActivityLabel(toolName, resultCount, failed),
        resultCount,
        durationMs: Math.round(event.toolExecutionMs),
        query,
      });
    },
  });

  const agentOutput = agentOutputSchema.parse(result.output);

  const validated = validateAgentOutput({
    agentOutput,
    registry,
    correlationCandidates: params.caseContext.correlationCandidates,
    productFacts: params.caseContext.productFacts,
    measurement,
  });

  if (validated.rejectedHypothesisCount > 0 || validated.droppedCitationCount > 0) {
    // Never logged with content — see generate-hypotheses.ts's identical
    // count-only convention.
    console.warn(
      `[investigation-agent] rejected ${validated.rejectedHypothesisCount} hypothesis(es), dropped ${validated.droppedCitationCount} citation(s) (hallucinated id or certainty language)`,
    );
  }

  const metrics = buildAgentCompletedPayload(
    registry,
    params.caseContext.correlationCandidates,
    validated.passagesUsedAsEvidence,
    validated.hypotheses.length,
  );

  return {
    activity,
    hypotheses: validated.hypotheses,
    clarificationQuestion: validated.clarificationQuestion,
    metrics,
  };
}
