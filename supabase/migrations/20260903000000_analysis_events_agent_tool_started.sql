-- UX-05 Workstream C: add "agent.tool.started" to the analysis_events
-- typed-event list — the real server-execution-boundary start signal
-- (bridged from the AI SDK's onToolExecutionStart callback, persisted
-- before it's yielded, exactly like every other analysis event) that
-- drives the live Investigation Trace's active/queued step state. Carries
-- only safe display fields (tool name, a pre-written label, an optional
-- query, and the AI SDK's own toolCallId used to pair it with the matching
-- agent.tool.completed row) — never a raw model prompt or hidden
-- reasoning; see src/lib/analysis/events.ts. Additive: widens the allowed
-- set, drops nothing already in use.
alter table public.analysis_events
  drop constraint analysis_events_event_type_check;

alter table public.analysis_events
  add constraint analysis_events_event_type_check check (event_type in (
    'run.started',
    'product.fact_detected',
    'measurement.parsed',
    'measurement.loaded',
    'correlation.found',
    'clarification.required',
    'hypothesis.created',
    'hypothesis.updated',
    'observation.recorded',
    'change.recorded',
    'measurement.compared',
    'regulatory_state.updated',
    'agent.started',
    'agent.tool.started',
    'agent.tool.completed',
    'agent.completed',
    'run.completed',
    'run.failed'
  ));
