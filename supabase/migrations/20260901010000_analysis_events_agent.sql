-- Add the Investigation Agent's observable-activity event types (MVP-10B) to
-- the analysis_events typed-event list. "agent.tool.completed" carries only
-- safe display fields (tool name, result count, duration, query) — never a
-- raw model prompt or hidden reasoning; see src/lib/analysis/events.ts.
-- Additive: widens the allowed set, drops nothing already in use.
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
    'agent.tool.completed',
    'agent.completed',
    'run.completed',
    'run.failed'
  ));
