// The Investigation Agent's six tools (MVP-10B) — small, bounded, and each
// scoped to a single already-authenticated Supabase client captured by
// closure at creation time (see createInvestigationAgent in
// investigation-agent.ts). No global state: a fresh tool set is built per
// investigation run, so there is nothing here for one workspace's request
// to leak into another's.
//
// Every tool returns bounded, structured data — never a raw table dump,
// never a whole document. searchEngineeringDocuments in particular wraps
// MVP-10A's searchEngineeringDocuments() and returns exact passages with
// their provenance (chunkId/documentId/filename/page/section) intact, which
// is what src/lib/agents/validate-agent-output.ts checks a citation against.
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HarmonicCorrelationCandidate } from "@/lib/correlation/harmonic-correlation";
import type { ProductFactForHypotheses } from "@/lib/hypotheses/generate-hypotheses";
import type { MeasurementPeakRow } from "@/lib/cases/queries";
import type { ConfidenceBand } from "@/lib/domain/schema";
import { analysisEventSchema } from "@/lib/analysis/events";
import {
  searchEngineeringDocuments,
  type EngineeringDocumentPassage,
} from "@/lib/documents/search";

export interface InvestigationToolsContext {
  supabase: SupabaseClient<Database>;
  product: { id: string; name: string };
  revision: { id: string; label: string };
  failureCase: { id: string; title: string; status: string };
  measurement: {
    id: string;
    label: string | null;
    operatingMode: string | null;
    peaks: MeasurementPeakRow[];
  };
  productFacts: ProductFactForHypotheses[];
  correlationCandidates: HarmonicCorrelationCandidate[];
}

export interface PreviousRevisionSummary {
  id: string;
  label: string;
  notes: string | null;
  factCount: number;
}

export interface PreviousInvestigationSummary {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
}

// MVP-11: a hypothesis proposed in an earlier *completed* run of this same
// failure case (never the run currently in flight — see the `status =
// "completed"` filter below, which is what excludes it without needing to
// know this run's own id). `id` is synthetic (`${runId}:${sequence}`) since
// hypotheses have no dedicated table/primary key yet (they live only in
// analysis_events payloads — see docs/PROGRESS.md's MVP-10B entry); it's
// stable and derivable identically here and in
// src/lib/agents/validate-agent-output.ts's registry.
export interface PreviousHypothesisSummary {
  id: string;
  title: string;
  confidenceBand: ConfidenceBand;
  recommendedNextStep: string;
  createdAt: string;
}

const MAX_DOCUMENT_SEARCH_RESULTS = 8;
const MAX_PREVIOUS_REVISIONS = 5;
const MAX_PREVIOUS_INVESTIGATIONS = 10;
const MAX_PREVIOUS_HYPOTHESES = 10;
const MAX_PREVIOUS_RUNS_FOR_HYPOTHESES = 5;

const emptyInputSchema = z.object({});

export function createInvestigationTools(context: InvestigationToolsContext) {
  return {
    getProductContext: tool({
      description:
        "Returns the product, revision, and structured product facts (clocks, radios, power rails, cables) for the case under investigation.",
      inputSchema: emptyInputSchema,
      execute: async () => ({
        product: context.product,
        revision: context.revision,
        facts: context.productFacts,
      }),
    }),

    getMeasurementContext: tool({
      description:
        "Returns the failure case and the failing measurement: its known peaks and operating mode.",
      inputSchema: emptyInputSchema,
      execute: async () => ({
        failureCase: context.failureCase,
        measurement: context.measurement,
      }),
    }),

    getDeterministicCorrelations: tool({
      description:
        "Returns the deterministic frequency/harmonic correlation candidates already computed for this measurement. Does not recompute them — these are the authoritative candidates.",
      inputSchema: emptyInputSchema,
      execute: async () => ({
        candidates: context.correlationCandidates,
      }),
    }),

    searchEngineeringDocuments: tool({
      description:
        "Searches this workspace's indexed engineering documents (schematics, test reports, datasheets, regulatory notes) and returns bounded, exact passages with their source (document, page/section) — never a whole document. Call it multiple times with different targeted queries to improve recall (e.g. a component name, then a signal path, then a frequency) rather than one broad query.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("A specific, targeted search query — not the whole case."),
      }),
      execute: async ({ query }): Promise<{ passages: EngineeringDocumentPassage[] }> => {
        const passages = await searchEngineeringDocuments(context.supabase, {
          query,
          productId: context.product.id,
          productRevisionId: context.revision.id,
          limit: MAX_DOCUMENT_SEARCH_RESULTS,
        });
        return { passages };
      },
    }),

    getPreviousRevisions: tool({
      description:
        "Returns other revisions of the same product (excluding the current one under investigation), most recent first, with how many structured facts each has recorded.",
      inputSchema: emptyInputSchema,
      execute: async (): Promise<{ revisions: PreviousRevisionSummary[] }> => {
        const { data: revisionRows } = await context.supabase
          .from("product_revisions")
          .select("id, label, notes")
          .eq("product_id", context.product.id)
          .neq("id", context.revision.id)
          .order("created_at", { ascending: false })
          .limit(MAX_PREVIOUS_REVISIONS);
        const rows = revisionRows ?? [];
        if (rows.length === 0) return { revisions: [] };

        // One bulk query for fact counts rather than one per revision.
        const { data: factRows } = await context.supabase
          .from("product_facts")
          .select("product_revision_id")
          .in(
            "product_revision_id",
            rows.map((row) => row.id),
          );
        const factCountByRevision = new Map<string, number>();
        for (const fact of factRows ?? []) {
          factCountByRevision.set(
            fact.product_revision_id,
            (factCountByRevision.get(fact.product_revision_id) ?? 0) + 1,
          );
        }

        const revisions: PreviousRevisionSummary[] = rows.map((row) => ({
          id: row.id,
          label: row.label,
          notes: row.notes,
          factCount: factCountByRevision.get(row.id) ?? 0,
        }));
        return { revisions };
      },
    }),

    getPreviousInvestigations: tool({
      description:
        "Returns previous investigation events (observations, engineering changes, notes) recorded for this failure case, most recent first.",
      inputSchema: emptyInputSchema,
      execute: async (): Promise<{
        events: PreviousInvestigationSummary[];
      }> => {
        const { data } = await context.supabase
          .from("investigation_events")
          .select("id, event_type, description, created_at")
          .eq("failure_case_id", context.failureCase.id)
          .order("created_at", { ascending: false })
          .limit(MAX_PREVIOUS_INVESTIGATIONS);

        const events: PreviousInvestigationSummary[] = (data ?? []).map((row) => ({
          id: row.id,
          eventType: row.event_type,
          description: row.description,
          createdAt: row.created_at,
        }));
        return { events };
      },
    }),

    getPreviousHypotheses: tool({
      description:
        "Returns hypotheses proposed in previous completed investigation runs for this failure case (most recent first) — their title, confidence, and recommended next step. Use this together with getPreviousInvestigations to judge whether new evidence supports, weakens, or leaves each one unchanged.",
      inputSchema: emptyInputSchema,
      execute: async (): Promise<{ hypotheses: PreviousHypothesisSummary[] }> => {
        // status = "completed" is what excludes the run currently in
        // flight (it's still "running" at the moment the agent calls this
        // tool) without needing to know its own runId.
        const { data: runRows } = await context.supabase
          .from("analysis_runs")
          .select("id")
          .eq("failure_case_id", context.failureCase.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(MAX_PREVIOUS_RUNS_FOR_HYPOTHESES);
        const runIds = (runRows ?? []).map((row) => row.id);
        if (runIds.length === 0) return { hypotheses: [] };

        const { data: eventRows } = await context.supabase
          .from("analysis_events")
          .select("analysis_run_id, sequence, created_at, payload")
          .in("analysis_run_id", runIds)
          .eq("event_type", "hypothesis.created")
          .order("created_at", { ascending: false })
          .limit(MAX_PREVIOUS_HYPOTHESES);

        const hypotheses: PreviousHypothesisSummary[] = [];
        for (const row of eventRows ?? []) {
          // Re-validated against the same schema used to stream/reconstruct
          // this event elsewhere — the network isn't the only trust
          // boundary; a row this app itself wrote earlier is still
          // revalidated, not assumed.
          const parsed = analysisEventSchema.safeParse({
            type: "hypothesis.created",
            runId: row.analysis_run_id,
            sequence: row.sequence,
            createdAt: row.created_at,
            payload: row.payload,
          });
          if (!parsed.success || parsed.data.type !== "hypothesis.created") continue;
          hypotheses.push({
            id: `${row.analysis_run_id}:${row.sequence}`,
            title: parsed.data.payload.title,
            confidenceBand: parsed.data.payload.confidenceBand,
            recommendedNextStep: parsed.data.payload.recommendedNextStep,
            createdAt: row.created_at,
          });
        }
        return { hypotheses };
      },
    }),
  };
}

export type InvestigationToolSet = ReturnType<typeof createInvestigationTools>;
