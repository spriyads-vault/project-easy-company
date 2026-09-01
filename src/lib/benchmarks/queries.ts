// VALIDATION-01: read paths for the VISIBLE half of the benchmark harness.
// Deliberately in its own module, separate from
// src/lib/benchmarks/ground-truth.ts (the hidden half) — a caller that only
// imports this file structurally cannot read a root cause, a diagnostic
// action, or a successful engineering change, even by accident.
import { createClient } from "@/lib/supabase/server";

export interface BenchmarkCaseSummary {
  id: string;
  failureCaseId: string;
  name: string;
  sourceDescription: string;
  status: "created" | "investigated" | "scored" | "revealed";
  createdAt: string;
  revealedAt: string | null;
  productName: string;
  revisionLabel: string;
  failureCaseTitle: string;
}

export interface BenchmarkRunSummary {
  analysisRunId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  hasScore: boolean;
}

export interface ExpertScoreRow {
  id: string;
  analysisRunId: string;
  nextActionUseful: number;
  hypothesesUseful: number;
  misleading: boolean;
  wouldChangeNextAction: boolean;
  comments: string | null;
  scoredAt: string;
}

export interface FailureCaseOption {
  id: string;
  title: string;
  productName: string;
  revisionLabel: string;
  measurementCount: number;
}

/** Every failure case in the workspace not already registered as a
 * benchmark — the picker for "register this as a benchmark case." Reuses
 * the real failure_cases table (no benchmark-specific case list exists,
 * by design: a benchmark case is an ordinary case someone built through
 * the normal product/case/measurement flow). */
export async function listCasesAvailableForBenchmark(): Promise<FailureCaseOption[]> {
  const supabase = await createClient();
  const { data: registered } = await supabase.from("benchmark_cases").select("failure_case_id");
  const registeredIds = new Set((registered ?? []).map((r) => r.failure_case_id));

  const { data } = await supabase
    .from("failure_cases")
    .select("id, title, product_revisions(label, products(name)), measurements(id)")
    .order("created_at", { ascending: false });

  return (data ?? [])
    .filter((row) => !registeredIds.has(row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      productName: row.product_revisions?.products?.name ?? "Unknown product",
      revisionLabel: row.product_revisions?.label ?? "Unknown revision",
      measurementCount: row.measurements?.length ?? 0,
    }));
}

/** All benchmark cases in the signed-in user's workspace, most recent first.
 * Ground truth is never selected here — see
 * src/lib/benchmarks/ground-truth.ts for that, a separate module by
 * design. */
export async function listBenchmarkCases(): Promise<BenchmarkCaseSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("benchmark_cases")
    .select(
      "id, failure_case_id, name, source_description, status, created_at, revealed_at, failure_cases(title, product_revisions(label, products(name)))",
    )
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    failureCaseId: row.failure_case_id,
    name: row.name,
    sourceDescription: row.source_description,
    status: row.status as BenchmarkCaseSummary["status"],
    createdAt: row.created_at,
    revealedAt: row.revealed_at,
    productName: row.failure_cases?.product_revisions?.products?.name ?? "Unknown product",
    revisionLabel: row.failure_cases?.product_revisions?.label ?? "Unknown revision",
    failureCaseTitle: row.failure_cases?.title ?? "Untitled case",
  }));
}

export async function getBenchmarkCase(
  benchmarkCaseId: string,
): Promise<BenchmarkCaseSummary | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("benchmark_cases")
    .select(
      "id, failure_case_id, name, source_description, status, created_at, revealed_at, failure_cases(title, product_revisions(label, products(name)))",
    )
    .eq("id", benchmarkCaseId)
    .single();
  if (error || !row) return null;

  return {
    id: row.id,
    failureCaseId: row.failure_case_id,
    name: row.name,
    sourceDescription: row.source_description,
    status: row.status as BenchmarkCaseSummary["status"],
    createdAt: row.created_at,
    revealedAt: row.revealed_at,
    productName: row.failure_cases?.product_revisions?.products?.name ?? "Unknown product",
    revisionLabel: row.failure_cases?.product_revisions?.label ?? "Unknown revision",
    failureCaseTitle: row.failure_cases?.title ?? "Untitled case",
  };
}

/** Every analysis run performed against this benchmark case's underlying
 * failure case, most recent first, with whether each has already been
 * scored — exactly the runs a reviewer could pick from to score next. */
export async function listBenchmarkRuns(
  failureCaseId: string,
): Promise<BenchmarkRunSummary[]> {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("analysis_runs")
    .select("id, status, created_at, completed_at")
    .eq("failure_case_id", failureCaseId)
    .order("created_at", { ascending: false });
  if (!runs || runs.length === 0) return [];

  const { data: scores } = await supabase
    .from("benchmark_expert_scores")
    .select("analysis_run_id")
    .in(
      "analysis_run_id",
      runs.map((r) => r.id),
    );
  const scoredRunIds = new Set((scores ?? []).map((s) => s.analysis_run_id));

  return runs.map((row) => ({
    analysisRunId: row.id,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    hasScore: scoredRunIds.has(row.id),
  }));
}

export async function getExpertScore(analysisRunId: string): Promise<ExpertScoreRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("benchmark_expert_scores")
    .select(
      "id, analysis_run_id, next_action_useful, hypotheses_useful, misleading, would_change_next_action, comments, scored_at",
    )
    .eq("analysis_run_id", analysisRunId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    analysisRunId: data.analysis_run_id,
    nextActionUseful: data.next_action_useful,
    hypothesesUseful: data.hypotheses_useful,
    misleading: data.misleading,
    wouldChangeNextAction: data.would_change_next_action,
    comments: data.comments,
    scoredAt: data.scored_at,
  };
}

export async function listExpertScoresForCase(
  benchmarkCaseId: string,
): Promise<ExpertScoreRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("benchmark_expert_scores")
    .select(
      "id, analysis_run_id, next_action_useful, hypotheses_useful, misleading, would_change_next_action, comments, scored_at",
    )
    .eq("benchmark_case_id", benchmarkCaseId)
    .order("scored_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    analysisRunId: row.analysis_run_id,
    nextActionUseful: row.next_action_useful,
    hypothesesUseful: row.hypotheses_useful,
    misleading: row.misleading,
    wouldChangeNextAction: row.would_change_next_action,
    comments: row.comments,
    scoredAt: row.scored_at,
  }));
}
