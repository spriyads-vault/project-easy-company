-- VALIDATION-01: Historical Failure Benchmark Harness.
--
-- Deliberately additive and structurally isolated, not a redesign: a
-- benchmark case is just a pointer at a real failure_cases row (built from
-- ordinary product/revision/fact/measurement rows, through the exact same
-- tables and code paths a live customer case uses) plus a separate
-- registration table. Hidden ground truth lives in its own table that no
-- investigation code path ever queries — see src/lib/agents/tools.ts and
-- src/lib/analysis/create-analysis-run.ts, neither of which reference
-- benchmark_ground_truth at all. "Never enters agent context" is true by
-- construction here (the secret is never in a table the agent can reach),
-- not by a runtime filter someone could forget to apply — verified directly
-- in src/lib/benchmarks/leakage.integration.test.ts.

-- benchmark_cases ------------------------------------------------------
-- The VISIBLE half: which real failure case is being used as a benchmark,
-- and why. Everything here is safe for Crado (or anyone) to see at any
-- time — it carries no answer.

create table public.benchmark_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  failure_case_id uuid not null,
  name text not null,
  source_description text not null,
  status text not null default 'created' check (status in ('created', 'investigated', 'scored', 'revealed')),
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (id, workspace_id),
  unique (failure_case_id, workspace_id),
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade
);

alter table public.benchmark_cases enable row level security;

create policy "benchmark_cases_workspace_isolation" on public.benchmark_cases
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger benchmark_cases_set_workspace_id
  before insert on public.benchmark_cases
  for each row execute function public.set_workspace_id();

-- benchmark_ground_truth -------------------------------------------------
-- The HIDDEN half. One row per benchmark case, written once at setup time
-- by whoever built the benchmark (they already know the answer — that's
-- the point) and never read by any investigation/agent code path. Kept in
-- its own table, not a jsonb column on benchmark_cases or failure_cases,
-- specifically so "does the agent's context ever touch this table" is a
-- one-line grep answer, not a matter of trusting a WHERE clause.

create table public.benchmark_ground_truth (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  benchmark_case_id uuid not null,
  root_cause text not null,
  diagnostic_actions_taken text not null,
  successful_engineering_change text not null,
  final_frequency_mhz numeric,
  final_margin_db numeric,
  final_outcome_notes text,
  created_at timestamptz not null default now(),
  unique (benchmark_case_id, workspace_id),
  foreign key (benchmark_case_id, workspace_id)
    references public.benchmark_cases (id, workspace_id) on delete cascade
);

alter table public.benchmark_ground_truth enable row level security;

create policy "benchmark_ground_truth_workspace_isolation" on public.benchmark_ground_truth
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger benchmark_ground_truth_set_workspace_id
  before insert on public.benchmark_ground_truth
  for each row execute function public.set_workspace_id();

-- benchmark_expert_scores --------------------------------------------------
-- The blind expert scoring form, filled in after reading one analysis
-- run's output but before ground truth is revealed. One score per run —
-- re-running the investigation and scoring the new run again is how a
-- benchmark case gets re-evaluated, never an overwrite of the original
-- score.

create table public.benchmark_expert_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  benchmark_case_id uuid not null,
  analysis_run_id uuid not null,
  next_action_useful smallint not null check (next_action_useful between 1 and 5),
  hypotheses_useful smallint not null check (hypotheses_useful between 1 and 5),
  misleading boolean not null,
  would_change_next_action boolean not null,
  comments text,
  scored_by uuid not null references auth.users (id),
  scored_at timestamptz not null default now(),
  unique (analysis_run_id, workspace_id),
  foreign key (benchmark_case_id, workspace_id)
    references public.benchmark_cases (id, workspace_id) on delete cascade,
  foreign key (analysis_run_id, workspace_id)
    references public.analysis_runs (id, workspace_id) on delete cascade
);

alter table public.benchmark_expert_scores enable row level security;

create policy "benchmark_expert_scores_workspace_isolation" on public.benchmark_expert_scores
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger benchmark_expert_scores_set_workspace_id
  before insert on public.benchmark_expert_scores
  for each row execute function public.set_workspace_id();
