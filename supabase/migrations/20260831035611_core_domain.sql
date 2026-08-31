-- Core domain schema: Product -> ProductRevision -> (ProductFact | FailureCase
-- -> Measurement -> MeasurementPeak) -> AnalysisRun -> AnalysisEvent ->
-- DiagnosticHypothesis -> EvidenceItem, plus the investigation timeline
-- (InvestigationEvent, EngineeringChange). RegulatoryRequirement and
-- RegulatoryEvidenceLink are deferred to the ticket that gives them a
-- concrete shape (MVP-12) rather than guessed at here.
--
-- Every table is workspace-owned. Isolation is enforced two ways:
--  1. RLS: workspace_id = current_workspace_id() on every row.
--  2. Composite foreign keys (child_id, workspace_id) -> parent(id,
--     workspace_id): a child row's workspace_id is constrained by Postgres
--     itself to match its parent's, so a workspace can never be linked to
--     another workspace's parent row even by guessing a UUID.
-- workspace_id itself is never client-supplied: a BEFORE INSERT trigger
-- forces it to the caller's own workspace on every table below.

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
as $$
  select id from public.workspaces where owner_id = auth.uid()
$$;

create or replace function public.set_workspace_id()
returns trigger
language plpgsql
as $$
begin
  new.workspace_id := public.current_workspace_id();
  return new;
end;
$$;

-- products -------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

alter table public.products enable row level security;

create policy "products_workspace_isolation" on public.products
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger products_set_workspace_id
  before insert on public.products
  for each row execute function public.set_workspace_id();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- product_revisions ------------------------------------------------------

create table public.product_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  product_id uuid not null,
  label text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade
);

alter table public.product_revisions enable row level security;

create policy "product_revisions_workspace_isolation" on public.product_revisions
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger product_revisions_set_workspace_id
  before insert on public.product_revisions
  for each row execute function public.set_workspace_id();

-- product_facts ------------------------------------------------------------
-- Structured product context (clocks, radios, power, cables, ...) extracted
-- or entered against a specific revision. `fact` shape is validated by the
-- application's Zod schema, not the database, so new fact categories don't
-- require a migration.

create table public.product_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  product_revision_id uuid not null,
  category text not null check (category in ('clock', 'radio', 'power', 'cable', 'other')),
  fact jsonb not null,
  source text not null default 'user_entered' check (source in ('user_entered', 'extracted')),
  created_at timestamptz not null default now(),
  foreign key (product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete cascade
);

alter table public.product_facts enable row level security;

create policy "product_facts_workspace_isolation" on public.product_facts
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger product_facts_set_workspace_id
  before insert on public.product_facts
  for each row execute function public.set_workspace_id();

-- failure_cases ------------------------------------------------------------
-- Constrained to the radiated-emissions wedge on purpose: the product truth
-- rule against implying broad EMC family coverage is enforced here, not
-- just in copy.

create table public.failure_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  product_revision_id uuid not null,
  title text not null default 'Radiated emissions investigation',
  test_type text not null default 'radiated_emissions' check (test_type = 'radiated_emissions'),
  status text not null default 'open' check (status in ('open', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete cascade
);

alter table public.failure_cases enable row level security;

create policy "failure_cases_workspace_isolation" on public.failure_cases
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger failure_cases_set_workspace_id
  before insert on public.failure_cases
  for each row execute function public.set_workspace_id();

-- measurements ---------------------------------------------------------

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  failure_case_id uuid not null,
  product_revision_id uuid not null,
  label text,
  operating_mode text,
  measured_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade,
  foreign key (product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete cascade
);

alter table public.measurements enable row level security;

create policy "measurements_workspace_isolation" on public.measurements
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger measurements_set_workspace_id
  before insert on public.measurements
  for each row execute function public.set_workspace_id();

-- measurement_peaks ----------------------------------------------------
-- margin_db is relative to the applicable regulatory limit (positive = over
-- the limit / fails, negative = under the limit / passes), matching how
-- engineers read a pre-compliance scan and how before/after deltas are
-- computed downstream.

create table public.measurement_peaks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  measurement_id uuid not null,
  frequency_mhz numeric not null check (frequency_mhz > 0),
  margin_db numeric not null,
  detector text,
  limit_line text,
  created_at timestamptz not null default now(),
  foreign key (measurement_id, workspace_id)
    references public.measurements (id, workspace_id) on delete cascade
);

alter table public.measurement_peaks enable row level security;

create policy "measurement_peaks_workspace_isolation" on public.measurement_peaks
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger measurement_peaks_set_workspace_id
  before insert on public.measurement_peaks
  for each row execute function public.set_workspace_id();

-- analysis_runs ----------------------------------------------------------

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  failure_case_id uuid not null,
  measurement_id uuid,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, workspace_id),
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade,
  foreign key (measurement_id, workspace_id)
    references public.measurements (id, workspace_id) on delete set null
);

alter table public.analysis_runs enable row level security;

create policy "analysis_runs_workspace_isolation" on public.analysis_runs
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger analysis_runs_set_workspace_id
  before insert on public.analysis_runs
  for each row execute function public.set_workspace_id();

-- analysis_events --------------------------------------------------------
-- The typed event stream (see docs/ARCHITECTURE.md). sequence orders events
-- within a run so the UI can reconstruct partial/completed state on refresh.

create table public.analysis_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  analysis_run_id uuid not null,
  sequence integer not null,
  event_type text not null check (event_type in (
    'run.started',
    'product.fact_detected',
    'measurement.parsed',
    'correlation.found',
    'clarification.required',
    'hypothesis.created',
    'hypothesis.updated',
    'observation.recorded',
    'change.recorded',
    'measurement.compared',
    'regulatory_state.updated',
    'run.completed',
    'run.failed'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (analysis_run_id, sequence),
  foreign key (analysis_run_id, workspace_id)
    references public.analysis_runs (id, workspace_id) on delete cascade
);

alter table public.analysis_events enable row level security;

create policy "analysis_events_workspace_isolation" on public.analysis_events
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger analysis_events_set_workspace_id
  before insert on public.analysis_events
  for each row execute function public.set_workspace_id();

-- diagnostic_hypotheses --------------------------------------------------

create table public.diagnostic_hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  analysis_run_id uuid not null,
  failure_case_id uuid not null,
  title text not null,
  confidence_band text check (confidence_band in ('low', 'medium', 'high')),
  recommended_next_step text,
  status text not null default 'active' check (status in ('active', 'superseded', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (analysis_run_id, workspace_id)
    references public.analysis_runs (id, workspace_id) on delete cascade,
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade
);

alter table public.diagnostic_hypotheses enable row level security;

create policy "diagnostic_hypotheses_workspace_isolation" on public.diagnostic_hypotheses
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger diagnostic_hypotheses_set_workspace_id
  before insert on public.diagnostic_hypotheses
  for each row execute function public.set_workspace_id();

create trigger diagnostic_hypotheses_set_updated_at
  before update on public.diagnostic_hypotheses
  for each row execute function public.set_updated_at();

-- evidence_items -----------------------------------------------------------
-- The OBSERVED / KNOWN / INFERRED / MISSING labels the product truth rules
-- require on every AI-authored statement.

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  hypothesis_id uuid not null,
  category text not null check (category in ('observed', 'known', 'inferred', 'missing')),
  description text not null,
  source_ref jsonb,
  created_at timestamptz not null default now(),
  foreign key (hypothesis_id, workspace_id)
    references public.diagnostic_hypotheses (id, workspace_id) on delete cascade
);

alter table public.evidence_items enable row level security;

create policy "evidence_items_workspace_isolation" on public.evidence_items
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger evidence_items_set_workspace_id
  before insert on public.evidence_items
  for each row execute function public.set_workspace_id();

-- investigation_events -----------------------------------------------------
-- The durable, engineer-facing investigation timeline for a failure case
-- (distinct from analysis_events, which is the AI pipeline's own stream).

create table public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  failure_case_id uuid not null,
  event_type text not null check (event_type in (
    'case_opened', 'observation', 'engineering_change', 'measurement_recorded', 'note'
  )),
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade
);

alter table public.investigation_events enable row level security;

create policy "investigation_events_workspace_isolation" on public.investigation_events
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger investigation_events_set_workspace_id
  before insert on public.investigation_events
  for each row execute function public.set_workspace_id();

-- engineering_changes --------------------------------------------------

create table public.engineering_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  failure_case_id uuid not null,
  from_product_revision_id uuid,
  to_product_revision_id uuid not null,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (failure_case_id, workspace_id)
    references public.failure_cases (id, workspace_id) on delete cascade,
  foreign key (from_product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete set null,
  foreign key (to_product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete cascade
);

alter table public.engineering_changes enable row level security;

create policy "engineering_changes_workspace_isolation" on public.engineering_changes
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger engineering_changes_set_workspace_id
  before insert on public.engineering_changes
  for each row execute function public.set_workspace_id();
