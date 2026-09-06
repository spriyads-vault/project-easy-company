-- FIX-01: add "hypothesis.retried" to the analysis_events typed-event list.
-- Fired when a completed hypothesis-generation attempt returned zero
-- hypotheses and no clarification question while correlation candidates
-- existed (almost certainly a miss, not a considered answer — see
-- src/lib/hypotheses/generate-hypotheses.ts), immediately before
-- run-analysis.ts retries exactly once. Makes the retry observable rather
-- than a silent doubled model call. Carries only a correlation count —
-- never model output. Additive: widens the allowed set, drops nothing
-- already in use.
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
    'hypothesis.retried',
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
