# MVP Architecture

## Web
Next.js / React / TypeScript.
Use server components where they reduce client complexity.
Use client components for live analysis state and interactive measurement/investigation UI.

## AI
Use Vercel AI SDK with a provider adapter.
Model responses must be schema-validated with Zod.
Use structured data events, not only token text streams.

## Persistence
Supabase Postgres.
Private Supabase Storage for pilot uploads if uploads are enabled.
RLS on all user/workspace-owned resources.

## Analysis
The orchestrator emits typed events.
Deterministic utilities run separately from the LLM:
- harmonic candidates
- frequency ratios
- known product frequencies/clocks
- before/after delta
- evidence/revision consistency

The LLM consumes the structured results and relevant product context to generate ranked hypotheses and clarification requests.

## Persistence model
Persist AnalysisRun and AnalysisEvent so the UI can reconstruct a partially completed run after refresh.

## Deployment
Vercel for Next.js.
Supabase managed Postgres/Auth/Storage.
Do not add a durable workflow engine until analysis duration/retry behavior proves it is needed.
