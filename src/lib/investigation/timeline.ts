// The investigation timeline (MVP-11): a chronological, auditable merge of
// every measurement, hypothesis (across *all* runs, not just the latest),
// engineer observation, engineering change, and revision recorded for a
// failure case — plus one deterministically computed "result" step when a
// before/after comparison is available. This is what makes "the previous
// state must remain auditable" true in the UI, not just in Postgres — old
// analysis_runs/analysis_events/investigation_events/product_revisions rows
// are never rewritten or deleted (see record-observation.ts,
// create-engineering-change.ts, and run-analysis.ts), so this query only
// ever reads; it never mutates anything.
//
// Takes an already-authenticated Supabase client as a parameter — like
// MVP-10A's listEngineeringDocuments/searchEngineeringDocuments, not the
// older cookie-based cases/queries.ts convention — specifically so this is
// directly integration-testable, which "old hypothesis remains historical"
// and "evidence stays on the correct revision" need to prove against real
// Postgres, not a hand-built fixture.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ConfidenceBand } from "@/lib/domain/schema";
import type { HypothesisUpdate } from "@/lib/hypotheses/schema";
import { analysisEventSchema } from "@/lib/analysis/events";
import { compareMeasurements, type MeasurementComparison } from "@/lib/measurements/compare-measurements";

export type TimelineEntry =
  | {
      type: "measurement";
      id: string;
      createdAt: string;
      label: string | null;
      frequencyMhz: number;
      marginDb: number;
      revisionLabel: string;
    }
  | {
      type: "hypothesis";
      id: string;
      createdAt: string;
      title: string;
      confidenceBand: ConfidenceBand;
      recommendedNextStep: string;
      update: HypothesisUpdate | null;
      revisionLabel: string | null;
    }
  | {
      type: "observation";
      id: string;
      createdAt: string;
      observation: string;
      measurementChange: string | null;
    }
  | {
      type: "engineering_change";
      id: string;
      createdAt: string;
      title: string;
      affectedSubsystem: string | null;
      fromRevisionLabel: string | null;
      toRevisionLabel: string;
    }
  | {
      type: "new_revision";
      id: string;
      createdAt: string;
      label: string;
      supersedesLabel: string | null;
    }
  | {
      type: "result";
      id: string;
      createdAt: string;
      comparison: MeasurementComparison;
    };

const MAX_TIMELINE_ENTRIES_PER_SOURCE = 50;

export async function getInvestigationTimeline(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  const { data: measurementRows } = await supabase
    .from("measurements")
    .select(
      "id, label, created_at, product_revision_id, product_revisions(label), measurement_peaks(frequency_mhz, margin_db)",
    )
    .eq("failure_case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);

  // Built once, reused for both measurement entries and (via each analysis
  // run's own measurement_id) hypothesis entries below — one real join,
  // not repeated per hypothesis.
  const revisionLabelByMeasurementId = new Map<string, string>();
  const comparableMeasurements: { revisionLabel: string; frequencyMhz: number; marginDb: number; createdAt: string }[] = [];

  for (const row of measurementRows ?? []) {
    const peak = row.measurement_peaks[0];
    const revisionLabel = row.product_revisions?.label ?? "Unknown revision";
    revisionLabelByMeasurementId.set(row.id, revisionLabel);
    if (!peak) continue;
    entries.push({
      type: "measurement",
      id: row.id,
      createdAt: row.created_at,
      label: row.label,
      frequencyMhz: Number(peak.frequency_mhz),
      marginDb: Number(peak.margin_db),
      revisionLabel,
    });
    comparableMeasurements.push({
      revisionLabel,
      frequencyMhz: Number(peak.frequency_mhz),
      marginDb: Number(peak.margin_db),
      createdAt: row.created_at,
    });
  }

  // Hypotheses across every run for this case — deliberately not scoped to
  // "latest run only" (that's what the main Investigation panel shows).
  // History here is what proves an earlier hypothesis was never rewritten,
  // only ever followed by a new one.
  const { data: runs } = await supabase
    .from("analysis_runs")
    .select("id, measurement_id")
    .eq("failure_case_id", caseId)
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  const runIds = (runs ?? []).map((run) => run.id);
  const revisionLabelByRunId = new Map<string, string | null>(
    (runs ?? []).map((run) => [
      run.id,
      run.measurement_id ? (revisionLabelByMeasurementId.get(run.measurement_id) ?? null) : null,
    ]),
  );
  if (runIds.length > 0) {
    const { data: events } = await supabase
      .from("analysis_events")
      .select("analysis_run_id, sequence, created_at, payload")
      .in("analysis_run_id", runIds)
      .eq("event_type", "hypothesis.created")
      .order("created_at", { ascending: true })
      .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
    for (const row of events ?? []) {
      const parsed = analysisEventSchema.safeParse({
        type: "hypothesis.created",
        runId: row.analysis_run_id,
        sequence: row.sequence,
        createdAt: row.created_at,
        payload: row.payload,
      });
      if (!parsed.success || parsed.data.type !== "hypothesis.created") continue;
      entries.push({
        type: "hypothesis",
        id: `${row.analysis_run_id}:${row.sequence}`,
        createdAt: row.created_at,
        title: parsed.data.payload.title,
        confidenceBand: parsed.data.payload.confidenceBand,
        recommendedNextStep: parsed.data.payload.recommendedNextStep,
        update: parsed.data.payload.update ?? null,
        revisionLabel: revisionLabelByRunId.get(row.analysis_run_id) ?? null,
      });
    }
  }

  const { data: observations } = await supabase
    .from("investigation_events")
    .select("id, created_at, payload, description")
    .eq("failure_case_id", caseId)
    .eq("event_type", "observation")
    .order("created_at", { ascending: true })
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  for (const row of observations ?? []) {
    const payload = row.payload as { observation?: string; measurementChange?: string | null };
    entries.push({
      type: "observation",
      id: row.id,
      createdAt: row.created_at,
      // Falls back to the stored description for a row whose payload
      // predates this structured shape — never blank.
      observation: payload.observation ?? row.description,
      measurementChange: payload.measurementChange ?? null,
    });
  }

  const { data: changes } = await supabase
    .from("engineering_changes")
    .select(
      "id, created_at, title, affected_subsystem, from_product_revision_id, to_product_revision_id, from:product_revisions!engineering_changes_from_product_revision_id_workspace_id_fkey(label), to:product_revisions!engineering_changes_to_product_revision_id_workspace_id_fkey(label)",
    )
    .eq("failure_case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(MAX_TIMELINE_ENTRIES_PER_SOURCE);
  for (const row of changes ?? []) {
    entries.push({
      type: "engineering_change",
      id: row.id,
      createdAt: row.created_at,
      title: row.title,
      affectedSubsystem: row.affected_subsystem,
      fromRevisionLabel: row.from?.label ?? null,
      toRevisionLabel: row.to?.label ?? "Unknown revision",
    });
    entries.push({
      type: "new_revision",
      id: row.to_product_revision_id,
      // One tick after the change itself, so "new revision" always reads
      // as its consequence rather than sorting ambiguously alongside it.
      createdAt: row.created_at,
      label: row.to?.label ?? "Unknown revision",
      supersedesLabel: row.from?.label ?? null,
    });
  }

  // Deterministic before/after result (MVP-11) — never an LLM calculation.
  // "Before" is the earliest measurement on the case's original revision;
  // "after" is the most recent measurement on a *different* (newer)
  // revision. Only added once both genuinely exist.
  if (comparableMeasurements.length >= 2) {
    const before = comparableMeasurements[0];
    const after = [...comparableMeasurements]
      .reverse()
      .find((m) => m.revisionLabel !== before.revisionLabel);
    if (after) {
      // Pass only the fields compareMeasurements' ComparedMeasurement
      // interface actually declares — `before`/`after` on its own record
      // are what the UI (and this file's own consumers) read back, and
      // those should never carry the internal createdAt bookkeeping this
      // module tracks alongside them.
      const comparison = compareMeasurements(
        { revisionLabel: before.revisionLabel, frequencyMhz: before.frequencyMhz, marginDb: before.marginDb },
        { revisionLabel: after.revisionLabel, frequencyMhz: after.frequencyMhz, marginDb: after.marginDb },
      );
      entries.push({
        type: "result",
        id: `result-${before.revisionLabel}-${after.revisionLabel}`,
        createdAt: after.createdAt,
        comparison,
      });
    }
  }

  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return entries;
}
