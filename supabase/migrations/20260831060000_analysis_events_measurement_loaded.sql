-- Add "measurement.loaded" to the analysis_events typed-event list (MVP-08:
-- an analysis run reads an already-persisted measurement rather than
-- extracting one from a document, which "measurement.parsed" is reserved
-- for). Additive: widens the allowed set, drops nothing already in use.
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
    'run.completed',
    'run.failed'
  ));
