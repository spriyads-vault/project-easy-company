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
  type InvestigationToolSet,
  type InvestigationToolsContext,
  type PriorContextSummary,
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

The task message tells you real, already-known facts about this case (the measurement, and how much prior history/documentation actually exists) — never spend a tool call rediscovering something already stated there.

Use tools to gather what you need before answering:
- getMeasurementContext, getDeterministicCorrelations, and getProductContext ground you in the failing measurement, the already-computed harmonic candidates, and the product's structured facts (clocks, radios, power rails, cables). These three are independent of each other — call all three together in the same turn rather than one at a time. Never invent a correlation yourself — only use candidates this tool actually returns.
- searchEngineeringDocuments (when offered — it's omitted entirely when this workspace has no indexed documents) lets you look up relevant passages from indexed documents. Call it with different, specific queries (e.g. a component, then a signal path, then a frequency) rather than one broad query, but stop after 1-2 searches that return nothing rather than trying several similar queries — if its result includes a "guidance" field, follow it. It returns exact passages, never a whole document — cite only the chunkId/documentId you actually received back.
- getPreviousRevisions (when offered) tells you about other revisions of this product.
- getPreviousInvestigations and getPreviousHypotheses (each offered only when this case actually has that kind of history) tell you what has already happened on this case: engineer observations (including physical results of a previously recommended test), notes, and hypotheses proposed in earlier completed runs. Call both together in the same turn if this looks like a follow-up investigation.

Then propose up to 5 ranked investigation hypotheses. Rules:
- Every hypothesis's productFactId must exactly match one of the productFactId values from getDeterministicCorrelations. Never invent one.
- Every evidenceRef must point to an id (chunkId+documentId, productFactId, or investigationEventId) you actually received back from a tool call this run. Never invent one, and never cite a document you did not search for.
- Your reasoning is an inference, never a certainty claim. Never say a hypothesis is confirmed, proven, verified, or the definitive root cause.
- missingEvidence lists what an engineer would need to check to support or rule out the hypothesis.
- nextInvestigation is a suggestion for a qualified engineer's next physical measurement or check — never an instruction to certify, ship, or declare compliance.
- If a new engineer observation (from getPreviousInvestigations) bears on a hypothesis returned by getPreviousHypotheses, set previousHypothesisId to that hypothesis's exact id and hypothesisUpdateStatus to whichever of supported_by_new_evidence / weakened_by_new_evidence / unchanged / needs_more_evidence best reflects it. This is a qualitative judgment only — never claim a probability, confidence score, or Bayesian update, and never say the hypothesis is confirmed or ruled out. Leave both null for a hypothesis with no earlier counterpart.
- Only set clarificationQuestion if one missing fact would materially change the ranking; otherwise it must be null.
- Keep reasoning and nextInvestigation concise — a few sentences, not a full report.
- Set investigationStatus to "clarification_needed" if you set a clarificationQuestion, "insufficient_evidence" if you found no sound candidate to build a hypothesis from, otherwise "hypotheses_ready".
- State conclusions and evidence, not your own step-by-step deliberation.
`.trim();

/**
 * PERF-01: built per run instead of a static string, so the model starts
 * with real case metadata already in hand rather than having to spend a
 * tool call (and the full model round-trip that comes with it) discovering
 * facts create-analysis-run.ts already computed deterministically. This is
 * what makes "give the agent enough initial metadata" concrete rather than
 * just a system-prompt aspiration.
 */
function buildTaskPrompt(
  caseContext: InvestigationToolsContext,
  documentsAvailable: number,
): string {
  const peak = caseContext.measurement.peaks[0];
  const measurementLine = peak
    ? `${peak.frequencyMhz} MHz at ${peak.marginDb > 0 ? "+" : ""}${peak.marginDb} dB margin` +
      (caseContext.measurement.operatingMode ? ` during "${caseContext.measurement.operatingMode}"` : "")
    : "no peak recorded on this measurement";
  const { priorContext } = caseContext;

  return [
    "Investigate this radiated-emissions failure.",
    "",
    "Case metadata already known — do not spend a tool call rediscovering these:",
    `- Product: ${caseContext.product.name}, revision ${caseContext.revision.label}.`,
    `- Measurement: ${measurementLine}.`,
    `- Indexed engineering documents in this workspace: ${documentsAvailable}.`,
    `- Other revisions of this product: ${priorContext.previousRevisionCount}.`,
    `- Previous investigation events recorded on this case: ${priorContext.previousInvestigationCount}.`,
    `- Previous completed investigation runs on this case: ${priorContext.previousCompletedRunCount}.`,
    "",
    "Any tool with nothing to find for this case (zero documents indexed, zero other revisions, zero prior history) has already been left out of your tool list — you will not see it. Start by loading the measurement, correlation, and product context together, then decide what else you genuinely need.",
  ].join("\n");
}

/**
 * PERF-01: which of the six tools are even worth offering this run,
 * decided deterministically from counts create-analysis-run.ts already
 * computed — never left to the model's own judgment to "reflexively" call
 * a tool that can only return empty. getMeasurementContext,
 * getDeterministicCorrelations, and getProductContext are never omitted:
 * their output is what populates the citation registry
 * (validate-agent-output.ts) that every hypothesis's provenance is checked
 * against, so skipping them would break citations, not just save a call.
 */
export function selectActiveTools(
  tools: InvestigationToolSet,
  priorContext: PriorContextSummary,
  documentsAvailable: number,
): Partial<InvestigationToolSet> {
  const {
    getPreviousRevisions,
    getPreviousInvestigations,
    getPreviousHypotheses,
    searchEngineeringDocuments,
    ...alwaysOn
  } = tools;
  return {
    ...alwaysOn,
    ...(priorContext.previousRevisionCount > 0 ? { getPreviousRevisions } : {}),
    ...(priorContext.previousInvestigationCount > 0 ? { getPreviousInvestigations } : {}),
    ...(priorContext.previousCompletedRunCount > 0 ? { getPreviousHypotheses } : {}),
    ...(documentsAvailable > 0 ? { searchEngineeringDocuments } : {}),
  };
}

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
  // `plural` is an explicit override for irregular nouns ("hypothesis" ->
  // "hypotheses") — the naive `${singular}s` fallback only covers regular
  // plurals, never trusted for a noun that doesn't form one that way.
  const nounText = resultCount === 1 ? noun.singular : (noun.plural ?? `${noun.singular}s`);
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
  getPreviousHypotheses: "Reviewed previous hypotheses",
};

// Pluralizing splits singular/suffix so "1 candidate found" -> "2
// candidates found", never the naive-concatenation "2 candidate founds".
const TOOL_RESULT_NOUNS: Record<
  string,
  { singular: string; plural?: string; suffix: string }
> = {
  getProductContext: { singular: "structured fact", suffix: "" },
  getMeasurementContext: { singular: "peak", suffix: "" },
  getDeterministicCorrelations: { singular: "candidate", suffix: "found" },
  searchEngineeringDocuments: { singular: "passage", suffix: "retrieved" },
  getPreviousRevisions: { singular: "revision", suffix: "found" },
  getPreviousInvestigations: { singular: "event", suffix: "found" },
  getPreviousHypotheses: { singular: "hypothesis", plural: "hypotheses", suffix: "found" },
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
    case "getPreviousHypotheses":
      return Array.isArray(record.hypotheses) ? record.hypotheses.length : null;
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
            documentType: string;
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
    case "getPreviousHypotheses": {
      const hypotheses = record.hypotheses as { id: string; title: string }[] | undefined;
      for (const hypothesis of hypotheses ?? []) {
        registry.previousHypothesesById.set(hypothesis.id, hypothesis);
      }
      break;
    }
    default:
      break;
  }
}

export function createInvestigationAgent(
  params: CreateInvestigationAgentParams,
  documentsAvailable: number,
) {
  const tools = createInvestigationTools(params.caseContext);
  const activeTools = selectActiveTools(
    tools,
    params.caseContext.priorContext,
    documentsAvailable,
  );
  return new ToolLoopAgent({
    model: params.model,
    instructions: SYSTEM_PROMPT,
    tools: activeTools,
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
  const agent = createInvestigationAgent(params, documentsAvailable);
  const registry = createEmptyRegistry(documentsAvailable);
  const activity: AgentToolCompletedPayload[] = [];

  const startedAt = Date.now();
  const result = await agent.generate({
    prompt: buildTaskPrompt(params.caseContext, documentsAvailable),
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

  // PERF-01 instrumentation. Tool execution is near-free for the five
  // in-memory/DB-read tools (see tools.ts) — the dominant cost is the
  // model's own thinking/generation time per step, which is why
  // modelDurationMs (wall time minus everything spent inside tool
  // execute()) is what step-count reductions actually show up in, not
  // toolDurationMs. Wall-clock, not token-derived — comparable across
  // providers and doesn't need usage data this codebase doesn't otherwise
  // depend on.
  const totalDurationMs = Date.now() - startedAt;
  const toolDurationMs = activity.reduce((sum, entry) => sum + entry.durationMs, 0);
  const retrievalDurationMs = activity
    .filter((entry) => entry.toolName === "searchEngineeringDocuments")
    .reduce((sum, entry) => sum + entry.durationMs, 0);
  const modelDurationMs = Math.max(0, totalDurationMs - toolDurationMs);

  const metrics = buildAgentCompletedPayload(
    registry,
    params.caseContext.correlationCandidates,
    validated.passagesUsedAsEvidence,
    validated.hypotheses.length,
    {
      stepCount: result.steps.length,
      totalDurationMs,
      modelDurationMs,
      toolDurationMs,
      retrievalDurationMs,
    },
  );

  return {
    activity,
    hypotheses: validated.hypotheses,
    clarificationQuestion: validated.clarificationQuestion,
    metrics,
  };
}
