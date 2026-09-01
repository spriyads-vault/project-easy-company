# Claude Progress

## Current state
MVP-01 through MVP-10C and MVP-10 (labeled "MVP-11" in the session that
built it — see that dated entry and features.json's MVP-10 note for the
mapping) are done. Auth, workspace isolation, the full core domain schema,
product/revision/fact entry, failure-case + measurement entry, the
deterministic harmonic correlation engine, the AI structured hypothesis
service, a real streaming `POST /api/analysis-runs` endpoint, the
Engineering Knowledge Base (private document storage, ingestion, hybrid
retrieval), the Investigation Agent (an AI SDK `ToolLoopAgent` that decides
what product context/documents/history to gather before proposing
evidence-labeled, source-cited hypotheses), the polished investigation
workspace UI (Product/Measurement/Investigation/Agent Activity/Sources, with
a clickable source-provenance drawer), and now the physical investigation
feedback loop — a structured "Record result" action that persists an
engineer observation as new OBSERVED evidence, a 7th agent tool
(`getPreviousHypotheses`) that lets the Investigation Agent see and
qualitatively update earlier hypotheses (supported/weakened/unchanged/needs
more evidence — never a probability claim) on the next run, and a
chronological investigation timeline proving old hypotheses are never
rewritten — all work, tested, against a local Supabase instance
(`supabase start`) and live-verified against two real Anthropic calls (a
first investigation and a follow-up after recording an observation). The
next open ticket is engineering change + second measurement / before-after
comparison (the pre-existing MVP-11 entry in features.json — explicitly not
started).

## Session handoff format
Append one entry per completed/paused ticket:

### YYYY-MM-DD — MVP-XX
- Completed:
- Tests:
- Files/areas changed:
- Decisions:
- Remaining:
- Next recommended ticket:
- Commit:

### 2026-08-31 — MVP-01
- Completed: Scaffolded Next.js 16 (App Router) + React 19 + TypeScript app with
  Tailwind v4, pnpm as package manager, and all four quality-gate commands
  (`lint`, `typecheck`, `test`, `build`). Initialized git (no prior repo existed —
  repo was docs/config only). Made the initial commit.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (1 passing smoke test for the
  placeholder home page), `pnpm build` — all pass.
- Files/areas changed: package.json, tsconfig.json, next.config.ts,
  eslint.config.mjs, postcss.config.mjs, vitest.config.ts, vitest.setup.ts,
  src/app/{layout,page,page.test,globals.css}, public/, .env.example, .gitignore,
  README.md.
- Decisions (reversible, made per CLAUDE.md autonomy rules — no blockers found):
  - Package manager: pnpm (already available locally, fast, Vercel-friendly).
  - Test runner: Vitest + React Testing Library (fast, native ESM/TS, standard
    with Next.js App Router; Playwright reserved for E2E per MVP-15).
  - Styling: Tailwind v4 (create-next-app default, fits "restrained, technical"
    design brief without extra setup).
  - `.env.example` seeded with the Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and AI provider
    (`ANTHROPIC_API_KEY`, server-side only) variable names from
    docs/ARCHITECTURE.md — no values, per docs/DEPLOYMENT.md.
  - zod added now (runtime dependency) since it's required by every later
    ticket touching model-facing schemas (MVP-07) and domain validation.
  - Replaced create-next-app's marketing boilerplate home page with a minimal
    Crado-branded placeholder rather than leaving the generic template, since
    CLAUDE.md rules out stock/generic AI-template aesthetics.
- Remaining: none for MVP-01.
- Next recommended ticket: MVP-02 (Supabase auth and workspace isolation) —
  requires human-provided Supabase project credentials (one-way-door: new paid
  infra / external service), so confirm before creating a project.
- Commit: (see git log)

### 2026-08-31 — MVP-02
- Completed: Email/password auth (sign in, sign up, sign out) via
  `@supabase/ssr`, session-refresh proxy (`src/proxy.ts`, Next 16's
  replacement for `middleware.ts`) that redirects unauthenticated requests to
  `/login`, and a `workspaces` table auto-provisioned per user on sign-up with
  RLS restricting every row to `owner_id = auth.uid()`. `/workspace` renders
  the signed-in user's own workspace with a sign-out button.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit, no external deps),
  `pnpm build` — all pass. `pnpm test:integration` (new script; requires
  `supabase start`) runs 3 tests against real Postgres RLS on the local
  Supabase instance: workspace auto-provisioned on sign-up, cross-user SELECT
  returns zero rows (not an error), cross-user UPDATE affects zero rows and
  the other user's row is verified unchanged — all pass. Also drove the full
  sign-up → workspace → refresh → sign-out → blocked-`/workspace` flow in a
  real browser (chrome-devtools MCP) against `pnpm dev`; the smoke-test user
  was deleted afterward via the admin API.
- Files/areas changed: `supabase/` (init + `migrations/..._workspaces.sql`),
  `src/lib/supabase/{env,client,server,middleware}.ts`, `src/proxy.ts`,
  `src/lib/auth/credentials.ts`, `src/app/login/{page,actions}.tsx`,
  `src/app/auth/confirm/route.ts`, `src/lib/workspace/get-current-workspace.ts`,
  `src/lib/workspace/workspace-rls.integration.test.ts`,
  `src/app/workspace/{page,actions}.tsx`, `src/app/page.tsx` (added sign-in
  link), `vitest.integration.config.ts`, `next.config.ts`, `.env.local`
  (gitignored, local-only), `.env.example` unchanged (already had the right
  names from MVP-01).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Auth method: email + password (no OAuth provider dependency; simplest to
    provision pilot users; magic-link remains a drop-in swap later since it
    goes through the same `@supabase/ssr` client).
  - Local dev backend: `supabase start` (Docker), not a hosted project —
    creating a hosted Supabase project is a one-way door (external
    account/possible cost) per CLAUDE.md, so it's deferred to the deployment
    ticket (MVP-16), which already requires confirmation. Local dev uses
    Supabase's well-known, publicly-documented local demo JWT keys (identical
    on every machine, not secrets) — safe in `.env.local` (gitignored) and in
    the integration test source.
  - Workspace model: one workspace per user (1:1, unique `owner_id`),
    auto-created by a `handle_new_user` trigger on `auth.users` insert, so the
    app never has to handle a signed-in user with no workspace. Matches "Auth
    and private workspace" in MVP scope; multi-member workspaces are out of
    scope until a ticket requires them.
  - RLS test strategy: a dedicated `*.integration.test.ts` suite excluded from
    `pnpm test` (needs Docker/local Supabase) and run via `pnpm test:integration`
    — mocking the DB client would not actually prove RLS works.
  - Found and fixed: Next.js 16 auto-appends an "agent rules" block to this
    repo's `CLAUDE.md` on every `next dev`/`next build` (`agentRules` config).
    Reverted the mutation and set `agentRules: false` in `next.config.ts` so
    our operating instructions file is never silently rewritten again.
  - Renamed `middleware.ts` → `proxy.ts` (Next.js 16 deprecated the old
    convention with a codemod pointer); behavior unchanged, just the file/
    export name.
- Remaining: none for MVP-02. Local Supabase stack is currently running
  (`supabase start`); stop it with `supabase stop` if not continuing
  immediately — it costs nothing but does hold Docker resources.
- Next recommended ticket: MVP-03 (Core domain schema) — builds on the
  `workspaces` table with Product/ProductRevision/FailureCase/Measurement/
  AnalysisRun/AnalysisEvent/Hypothesis/InvestigationEvent/EngineeringChange,
  all workspace-scoped with the same RLS pattern. No blockers.
- Commit: (see git log)

### 2026-08-31 — MVP-03
- Completed: One migration adding the full core domain schema from CLAUDE.md
  ("Core domain objects"), minus RegulatoryRequirement/RegulatoryEvidenceLink
  which are deferred to MVP-12 (their shape isn't clear yet and building them
  now would be speculative): products, product_revisions, product_facts,
  failure_cases, measurements, measurement_peaks, analysis_runs,
  analysis_events (event_type constrained to the exact typed-event list in
  docs/ARCHITECTURE.md), diagnostic_hypotheses, evidence_items (the
  OBSERVED/KNOWN/INFERRED/MISSING categories), investigation_events, and
  engineering_changes. Generated `src/lib/supabase/database.types.ts` from the
  live schema and wired it into the browser/server Supabase client factories.
  Added `src/lib/domain/schema.ts` with the Zod enums/schemas that mirror the
  DB check constraints for model- and form-facing validation.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.
  `pnpm test:integration` (8 tests total now) additionally proves: the full
  chain Product → ProductRevision → ProductFact/FailureCase → Measurement →
  MeasurementPeak → AnalysisRun → AnalysisEvent → DiagnosticHypothesis →
  EvidenceItem, plus InvestigationEvent and EngineeringChange, all persist for
  one user; a second user cannot read the first user's `products` row (RLS);
  and a user cannot create a `product_revisions` row under another user's
  `products` row even by guessing its id — rejected by the composite foreign
  key, not just RLS.
- Files/areas changed:
  `supabase/migrations/20260831035611_core_domain.sql`,
  `src/lib/supabase/database.types.ts` (generated), `src/lib/supabase/{client,
  server}.ts` (typed with `Database`), `src/lib/domain/schema.ts`,
  `src/lib/domain/core-domain.integration.test.ts`.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Workspace isolation, extended: every table carries `workspace_id`, forced
    server-side by a `BEFORE INSERT` trigger (`set_workspace_id()`, ignores
    whatever the client sends) plus `default current_workspace_id()` so the
    generated TypeScript Insert types don't require callers to pass it. RLS
    (`for all using/with check workspace_id = current_workspace_id()`) gates
    reads/writes; composite foreign keys `(child_id, workspace_id) ->
    parent(id, workspace_id)` gate cross-workspace references that RLS alone
    wouldn't catch (a guessed parent UUID). This is the standard Postgres
    multi-tenancy pattern, not a custom invention.
  - `measurement_peaks.margin_db` is dB relative to the regulatory limit
    (positive = over/fail, negative = under/pass), matching
    docs/MVP_SCOPE.md's "+7.4 dB" / "-3.6 dB" happy path and making the
    before/after delta (MVP-11) a plain subtraction.
  - `failure_cases.test_type` is DB-constrained to exactly
    `'radiated_emissions'` — the product-truth rule against implying broad
    EMC family coverage is enforced in schema, not just UI copy.
  - `product_facts.fact` and `evidence_items.source_ref` are `jsonb`,
    validated by Zod at the application layer (`src/lib/domain/schema.ts`)
    rather than more DB columns, so new fact/evidence shapes in MVP-04/07
    don't need a migration.
  - `investigation_events` (durable, engineer-facing case timeline) is
    deliberately separate from `analysis_events` (the AI pipeline's own typed
    stream) — they answer different questions and have different consumers.
- Remaining: none for MVP-03. Local Supabase stack still running.
- Next recommended ticket: MVP-04 (Product context entry) — UI + server
  actions for creating a product/revision and entering structured
  clocks/radios/power/cables facts against `product_facts`. No blockers.
- Commit: (see git log)

### 2026-08-31 — MVP-04
- Completed: `/workspace` lists products and has a "new product" form
  (creates a `products` row + its first `product_revisions` row in one
  action, then redirects into the new revision). `/products/[productId]`
  lists revisions and has a "new revision" form. `/products/[productId]/
  revisions/[revisionId]` shows structured facts and a category-aware "add a
  fact" form (clock/radio/power/cable/other), each with the real fields for
  that category rather than a generic key/value box.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm test:integration` all pass. Added `src/lib/domain/schema.test.ts`:
  positive case (valid clock fact), negative case (missing frequencyMhz),
  boundary case (frequencyMhz = 0 rejected), a discriminated-shape case
  (cable's `shielded` field must not satisfy clock's shape), a second
  positive case (cable fact), and the default-source case. Also drove the
  full flow in a real browser (chrome-devtools MCP against `pnpm dev`):
  signed up → created "Gateway X" / Rev17 → added a 40 MHz clock fact →
  switched the form to "Cable / connector" (fields re-rendered correctly) →
  added a shielded display-ribbon-cable fact → both facts survived a fresh
  navigation. Smoke-test user deleted afterward via the admin API.
- Files/areas changed: `src/lib/domain/schema.ts` (clock/radio/power/cable/
  other fact schemas as a `discriminatedUnion` on `category`, replacing the
  earlier open `z.record`), `src/lib/domain/schema.test.ts`,
  `src/lib/products/queries.ts` (list/get product, get revision + facts),
  `src/app/products/actions.ts` (createProduct), `src/app/products/
  [productId]/{page,actions,new-revision-form}.tsx`, `src/app/products/
  [productId]/revisions/[revisionId]/{page,actions,add-fact-form}.tsx`,
  `src/app/workspace/{page,new-product-form}.tsx`.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Product facts are a real discriminated union (clock has `frequencyMhz`,
    cable has `shielded`, etc.), not a generic bag of properties — matches
    "structured clocks/radios/power/cables facts" in the acceptance
    criteria and keeps the extraction pipeline (MVP-07+) grounded in a fixed
    contract rather than free-form JSON.
  - Creating a product always creates its first revision in the same action
    (one form, one redirect into the revision page) — a product with zero
    revisions isn't a useful state for anything downstream, so there's no
    reason to make it a separate step.
  - Kept the UI to plain HTML form elements (native `<select>`, checkbox) at
    this stage rather than a component library — nothing here needs more
    than that yet, and CLAUDE.md rules out generic component-library
    sprawl over restrained, purpose-built UI.
- Remaining: none for MVP-04. Local Supabase stack still running.
- Next recommended ticket: MVP-05 (Failure case and measurement entry) —
  radiated-emissions `failure_cases` + `measurements`/`measurement_peaks`
  entry against a product revision, with validation. No blockers; schema
  already supports it (MVP-03).
- Commit: (see git log)

### 2026-08-31 — MVP-05
- Completed: revision page can now open a radiated-emissions failure case
  (one click; records a `case_opened` `investigation_events` row) and
  redirects to `/cases/[caseId]`. That page lists measurements (each with
  its peak(s)) and has a form to add one: operating mode, frequency (MHz),
  margin (dB relative to the regulatory limit, matching the schema/UI
  decision from MVP-03), plus optional label/detector/limit-line/notes.
  Recording a measurement also writes a `measurement_recorded`
  investigation event. A margin > 0 renders in red (over the limit), ≤ 0 in
  green — the beginning of the "OBSERVED" visual language MVP-09 will build
  out fully.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (12 tests, incl. 5 new
  `measurementInputSchema` cases: positive, a passing-margin boundary
  case using the scope's own -3.6 dB, missing operatingMode, a zero-
  frequency boundary, and a missing-peak case), `pnpm build`, and
  `pnpm test:integration` (unchanged, still 6/6 — schema didn't change) all
  pass. Drove the full flow in a real browser: signed up → created
  Gateway X/Rev17 → opened a failure case → recorded "200 MHz, +7.4 dB,
  WiFi TX + display active" exactly as in docs/MVP_SCOPE.md's happy path →
  confirmed it renders correctly (in red, since +7.4 dB is over the limit)
  and survives a fresh navigation. Smoke-test user deleted afterward.
- Files/areas changed: `src/lib/domain/schema.ts` (`measurementInputSchema`),
  `src/lib/domain/schema.test.ts`, `src/lib/cases/queries.ts`
  (listFailureCases, getFailureCase), `src/app/products/[productId]/
  revisions/[revisionId]/{actions,page,open-case-button}.tsx` (createFailureCase
  added), `src/app/cases/[caseId]/{page,actions,add-measurement-form}.tsx`.
  Also: `eslint.config.mjs` now sets `argsIgnorePattern: "^_"` for
  `no-unused-vars` — a no-input server action (like "open a case", which
  needs neither the previous state nor form data) legitimately has unused
  leading-underscore params, and the plain eslint-config-next rule was
  flagging that pattern as warnings.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - The failure case detail page lives at a top-level `/cases/[caseId]`
    route, not nested under `/products/.../revisions/...` — per
    docs/UX.md the failure case is the primary investigation surface, and
    MVP-06 through MVP-12 all attach more state to it (hypotheses,
    evidence, investigation timeline, engineering changes), so it earns its
    own URL now rather than a deep nested path later.
  - One measurement = one peak in this form (matches the MVP happy path:
    "Enter 200 MHz, +7.4 dB..."). If a measurement insert succeeds but its
    peak insert fails, the action deletes the measurement row rather than
    leaving a peak-less orphan — a compensating action, not a DB
    transaction, which is an acceptable simplification per CLAUDE.md's
    "simplest reversible implementation" tie-breaker; revisit only if it
    causes a real problem.
  - Every "open a case" / "record a measurement" action also writes an
    `investigation_events` row (already modeled in MVP-03), so the case
    timeline MVP-09/10/11 render is populated from day one instead of
    needing a backfill.
- Remaining: none for MVP-05. Local Supabase stack still running.
- Next recommended ticket: MVP-06 (Deterministic correlation engine) — a
  pure TypeScript utility (not a DB or UI ticket) that takes a measured
  frequency and the revision's clock/radio facts and finds harmonic
  candidates (e.g. 40 MHz × 5 = 200 MHz), with positive/negative/missing-
  data/boundary tests and provenance back to the input facts. No blockers;
  both its dependencies (MVP-04, MVP-05) now pass.
- Commit: (see git log)

### 2026-08-31 — MVP-06
- Completed: `src/lib/correlation/harmonic-correlation.ts` — pure TypeScript,
  zero I/O, zero model calls, no DB dependency. `extractFrequencySources`
  reduces raw `ProductFact` records (the discriminated union from MVP-04) to
  the subset that carry a characteristic frequency (clocks always; radios
  and switching power rails only if one was entered — cables/other never
  do). `findHarmonicCorrelations(measuredFrequencyMhz, sources, options)`
  finds, for each source, the single closest-matching integer harmonic N
  such that `sourceFrequencyMhz x N ≈ measuredFrequencyMhz` within a
  configurable tolerance (default 1% of the measured frequency, 25 max
  harmonic), and `correlateMeasurementWithProductFacts` chains both in one
  call. Every candidate carries `productFactId`/`productFactCategory`/
  `productFactLabel` (provenance) and a `description` phrased as "consistent
  with", never "caused by"/"confirmed"/"proves" — enforced by a test, not
  just a comment.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (29 total, 17 new in
  `harmonic-correlation.test.ts`), `pnpm build` all pass. Coverage:
  positive (Gateway X's 40 MHz clock → 200 MHz via the 5th harmonic, the
  exact case CLAUDE.md calls out), negative (137 MHz matches nothing),
  missing-data (no facts at all; facts present but none carry a frequency —
  cable/power-without-switching-frequency correctly excluded), and boundary
  cases (fundamental match at N=1, a match just outside the 1% tolerance
  rejected, one just inside accepted, a harmonic number above the 25 cap
  rejected even though the arithmetic works, a non-positive measured
  frequency throws `RangeError`, a malformed zero-frequency source is
  skipped rather than throwing, one candidate per source rather than one
  per near-hit, and stable sort order across three simultaneous matches).
  No DB/integration test needed — this ticket has no persistence surface.
- Files/areas changed: `src/lib/correlation/harmonic-correlation.ts`,
  `src/lib/correlation/harmonic-correlation.test.ts`.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - 1% default tolerance and 25 max harmonic number are documented,
    overridable constants (`CorrelationOptions`), not hardcoded — a real
    EMC engineer's tolerance judgment (MVP-07 or later product feedback) can
    override them without touching this module's logic.
  - Only the single closest-matching harmonic per source is returned, not
    every N within tolerance — avoids near-duplicate, confusing entries for
    the same fact at slightly different harmonic numbers.
  - No "confidence" or ranking score on a candidate — only the raw
    harmonic number, expected frequency, and deviation. Semantic labeling
    (INFERRED, confidence band, ranked hypothesis) is MVP-07's job; this
    layer stays strictly deterministic and un-opinionated about likelihood,
    per the user's explicit instruction not to imply root-cause proof here.
  - Kept this DB-free by design: it operates on plain `ProductFactRecord[]`
    (id + the same discriminated fact shape from MVP-04's Zod schema), so
    MVP-07 (or a future caller) is responsible for loading facts and
    persisting/streaming the result — this utility has one job.
- Remaining: none for MVP-06.
- Next recommended ticket: MVP-07 (AI structured hypothesis service) — takes
  this module's correlation output plus product/measurement context,
  generates ranked hypotheses with every statement labeled OBSERVED/KNOWN/
  INFERRED/MISSING, behind a provider adapter, Zod-validated. No blockers.
- Commit: (see git log)

### 2026-08-31 — MVP-07
- Completed: `src/lib/ai/provider.ts` — the one file allowed to know Crado
  uses Anthropic (`@ai-sdk/anthropic` + Vercel AI SDK `generateObject`).
  Exposes only `HypothesisModelAdapter` (one method,
  `generateHypotheses(input): Promise<output>`); every other module depends
  on that interface, never on the SDK. `src/lib/hypotheses/schema.ts` — Zod
  contracts for both directions of the model boundary. The load-bearing
  design choice: `modelHypothesisSchema` has no field for OBSERVED or KNOWN
  evidence at all — only `reasoning` (→ INFERRED) and `missingEvidence`
  (→ MISSING). The model structurally cannot claim something is observed or
  known; there's no field to put it in, not just a prompt asking it not to.
  `src/lib/hypotheses/generate-hypotheses.ts` — orchestrates: builds
  OBSERVED evidence from the real measurement and KNOWN evidence from real
  product facts (both deterministic, no model involved), calls the adapter
  for INFERRED reasoning + MISSING evidence per hypothesis, then two
  independent guards before anything is trusted: (1) a hypothesis's
  `productFactId` must match one of the correlation candidates it was
  actually given — a hallucinated id is dropped; (2) title/reasoning/
  recommendedNextStep/clarificationQuestion are scanned for certainty
  language ("root cause", "confirmed", "definitely", "proven", "guarantee",
  "verified") — a match gets dropped/nulled regardless of what the schema
  or prompt allowed through. Zero correlation candidates short-circuits
  before ever calling the model (nothing legitimate to ground a hypothesis
  on).
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (51 total, 22 new across
  `schema.test.ts` and `generate-hypotheses.test.ts`), `pnpm build` all
  pass. No live model call in any test — a fake `HypothesisModelAdapter`
  (the same interface a real caller uses) drives every case: positive
  (full OBSERVED→KNOWN→INFERRED→MISSING assembly, evidence in that exact
  order), the hallucinated-productFactId guard, the certainty-language
  guard (title, reasoning, and a would-be clarification question all
  tested separately), missing-data (empty candidates never call the
  adapter at all — asserted via a spy), and boundary cases (a passing vs.
  failing margin's OBSERVED wording, a hypothesis assembled with no
  matching product fact loaded). `schema.test.ts` separately proves the
  model's Zod shape has exactly 6 fields (none of them evidence/category)
  and that a smuggled `category` field is stripped by `.parse()` rather
  than trusted.
- Files/areas changed: `src/lib/ai/provider.ts`,
  `src/lib/hypotheses/{schema,schema.test,generate-hypotheses,
  generate-hypotheses.test}.ts`, `package.json` (added `ai`,
  `@ai-sdk/anthropic`). `eslint.config.mjs`: added `varsIgnorePattern: "^_"`
  and `ignoreRestSiblings: true` alongside the existing `argsIgnorePattern`
  (needed for a `const { x: _omit, ...rest } = obj` pattern in a test).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Model id defaults to `claude-sonnet-5`, overridable via
    `CRADO_HYPOTHESIS_MODEL` — per the session's own guidance to default to
    the latest Claude models, and kept out of application code so changing
    it is a one-line env var, not a code change.
  - This service takes already-loaded data (measurement, correlation
    candidates, product facts) and returns a result — no Supabase client,
    no fetching. Whatever calls it (an API route in MVP-08) owns loading
    data and persisting/streaming the result, matching MVP-06's same
    "one job, no I/O" shape and keeping this fully unit-testable without a
    live database or model key.
  - Rejected hypotheses aren't silently dropped from observability:
    `rejectedCount` is returned so a caller can log/monitor "the model
    proposed N hypotheses that violated the certainty/grounding rules"
    without ever surfacing them to a user.
  - Not wired into any route/page yet — there's nothing for MVP-07's
    acceptance criteria to attach to in the UI until MVP-08 (streaming
    events) and MVP-09 (the investigation workspace) exist. Wiring it in
    now would mean building throwaway UI just to prove the service works,
    when the fake-adapter unit tests already prove that directly.
- Remaining: none for MVP-07.
- Next recommended ticket: MVP-08 (Typed streaming analysis events) — an
  AnalysisRun/AnalysisEvent-backed API route that runs ingest → correlation
  (MVP-06) → hypothesis generation (MVP-07) → persistence, streaming typed
  events via the Vercel AI SDK data stream, with events persisted so a
  refresh can reconstruct partial/completed state. Needs a real
  `ANTHROPIC_API_KEY` in `.env.local` to exercise the live model path handoff
  — Claude has not been given one; ask before assuming it's available, or
  test the wiring against the fake adapter and note the live-model path as
  unverified until a key is supplied.
- Commit: (see git log)

### 2026-08-31 — MVP-08
- Completed: `POST /api/analysis-runs` — a real Route Handler, not a
  chatbot. Given `{failureCaseId, measurementId}`, it loads the real
  measurement/peak/product-facts from Postgres (RLS-scoped to the caller),
  creates an `analysis_runs` row, runs the pipeline
  (`src/lib/analysis/run-analysis.ts`: ingest → MVP-06 correlation → MVP-07
  hypotheses → typed events), persists each `analysis_events` row *as it's
  produced* (not batched at the end), and streams the same events to the
  browser as Server-Sent Events using the Vercel AI SDK's
  `JsonToSseTransformStream` (a small framing utility, not the SDK's
  chat/UIMessage protocol — deliberately avoided per "do not build a
  chatbot"). Event types: `run.started`, `measurement.loaded`,
  `correlation.found`, `hypothesis.created`, `clarification.required`,
  `run.completed`, `run.failed` — the DB's `analysis_events.event_type`
  check constraint gained `measurement.loaded` via an additive migration
  (kept `measurement.parsed` for a future document-extraction ticket).
  `correlation.found` mirrors `HarmonicCorrelationCandidate` field-for-field
  (provenance intact); `hypothesis.created` carries MVP-07's
  OBSERVED/KNOWN/INFERRED/MISSING evidence array exactly as assembled,
  untouched. The route only ever imports `createAnthropicHypothesisAdapter`
  from `src/lib/ai/provider.ts` — never `@ai-sdk/anthropic` directly — and
  that adapter now throws a clear `MissingProviderApiKeyError` (safe
  message, no secret in it) the moment it's actually called with no
  `ANTHROPIC_API_KEY` configured, which surfaces to the client as an
  ordinary `run.failed` event rather than a crash or a silent fake result.
- Tests: `pnpm lint`, `pnpm typecheck`, `pnpm test` (61, incl. 17 new in
  `run-analysis.test.ts` and 3 in `route.test.ts`), `pnpm build`, and
  `pnpm test:integration` (12, incl. 5 new in
  `create-analysis-run.integration.test.ts` and 1 in
  `route.integration.test.ts`) all pass — 73 tests total, zero live model
  calls in any of them (a fake `HypothesisModelAdapter` throughout).
  `run-analysis.test.ts` proves the pure pipeline: the exact Gateway X
  sequence (run.started → measurement.loaded → correlation.found [40 MHz x
  5] → hypothesis.created → run.completed), strictly increasing sequence
  numbers, a clarification-required path, the missing-data case (zero
  candidates completes without ever calling the adapter — asserted via a
  spy), and that a thrown error becomes a safe `run.failed` message (a
  planted fake API key string in the thrown error is asserted absent from
  the output). `create-analysis-run.integration.test.ts` proves the same
  flow against real Postgres — every streamed event is later found in
  `analysis_events` in the same order, `analysis_runs.status` ends
  `completed`/`failed` correctly, a cross-workspace `failureCaseId` 404s
  (not another user's data), a `measurementId` not belonging to the given
  case 404s, and a measurement with no peak 400s. Beyond the test suite: a
  full real-browser run (chrome-devtools MCP, real cookie session, actual
  `fetch('/api/analysis-runs')`) reproduced the exact same sequence live,
  ending in `run.failed` with the safe "ANTHROPIC_API_KEY is not
  configured" message (this repo has no live key), confirmed persisted to
  Postgres by direct query — proving requirement 10 end-to-end, not just in
  a unit test. Smoke-test user deleted afterward.
- Files/areas changed:
  `supabase/migrations/20260831060000_analysis_events_measurement_loaded.sql`,
  `src/lib/domain/schema.ts` (event-type enum), `src/lib/analysis/{events,
  run-analysis, run-analysis.test, create-analysis-run,
  create-analysis-run.integration.test}.ts`,
  `src/lib/supabase/route-client.ts`, `src/lib/products/{describe-fact,
  load-fact-records}.ts` (describe-fact extracted from the revision page,
  now shared by the UI and the model-facing summary), `src/lib/ai/
  provider.ts` (`MissingProviderApiKeyError` + the call-time key check),
  `src/app/api/analysis-runs/{route,route.test,
  route.integration.test}.ts`, `vitest.integration.config.ts` +
  `vitest.integration.setup.ts` (env for tests that build a Supabase client,
  using the same well-known local demo keys already hardcoded elsewhere —
  never read from `.env.local`).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - SSE via `ai`'s `JsonToSseTransformStream` (`TransformStream<unknown,
    string>`, just JSON-frames whatever you write to it) rather than
    `createUIMessageStream`/chat-protocol helpers — satisfies "use the
    current Vercel AI SDK APIs" for the transport layer without adopting
    UIMessage/role semantics that don't fit a non-chat typed-event feed.
  - Split the route into a thin HTTP wrapper (`route.ts`: parse, auth, SSE
    framing) and a DB-touching core (`create-analysis-run.ts`: loading,
    persistence, orchestration) that takes an already-authenticated
    Supabase client as a parameter. `next/headers`' `cookies()` only works
    inside Next's own request lifecycle and throws when a route handler is
    invoked directly (as a test would); `route.ts` instead builds its
    client from the raw `Request`'s Cookie header
    (`src/lib/supabase/route-client.ts`, using `@supabase/ssr`'s
    documented `parseCookieHeader`). This let the DB-touching core be
    integration-tested by constructing the same kind of authenticated
    client integration tests already use elsewhere (sign in via
    supabase-js), rather than fabricating `@supabase/ssr`'s internal
    session-cookie serialization format in a test.
  - `route.test.ts` covers only request-parsing (no Supabase client built
    yet, so no DB needed); the one test that needs a real answer to "is
    there a signed-in user" moved to `route.integration.test.ts`. Documented
    inline in both files so the split doesn't look accidental.
  - One measurement = one peak, matching MVP-05; `measurement_peaks[0]` is
    used for the analysis (if absent, 400 rather than crashing on
    `undefined`).
  - The missing-API-key check lives inside `generateHypotheses()`, not at
    adapter construction — so a run with zero correlation candidates
    (nothing to reason about) still succeeds even with no key configured,
    consistent with MVP-07's existing "don't call the model with nothing to
    ground a hypothesis on" short-circuit.
- Remaining: none for MVP-08. Not wired into any page — MVP-09 builds the
  investigation workspace UI that calls this endpoint and renders the
  stream. Local Supabase stack still running.
- Next recommended ticket: MVP-09 (Investigation workspace UI) — the
  three-region desktop layout (Product Context / Failure State / Evidence)
  plus the composer, calling `POST /api/analysis-runs` and rendering the SSE
  stream as progressive typed states. No blockers.
- Commit: (see git log)

### 2026-08-31 — Live Gateway X test against the real Anthropic provider
Ran a real end-to-end analysis (no fake adapter) against the configured
Anthropic key, per explicit instruction to verify MVP-08 against a live
model before starting MVP-09. Found and fixed two genuine defects; no
architecture change.

- Defect 1 — missing workspace header: the first live call failed with
  `AI_APICallError: anthropic-workspace-id is required when authenticating
  with an identity-linked API key...` (400). The configured key is
  identity-linked (Console SSO), which the Anthropic API rejects without an
  `anthropic-workspace-id` header; a plain workspace API key doesn't need
  this. This was invisible until fixed, because `sanitizeAnalysisError`
  deliberately hides raw error detail from the client and nothing logged it
  server-side either — a second, related gap. Fixed both:
  - `src/lib/ai/provider.ts`: added `buildAnthropicHeaders(workspaceId)`
    (pure, unit-tested in new `provider.test.ts`) and
    `resolveAnthropicProvider()`, which uses
    `createAnthropic({ headers: {"anthropic-workspace-id": ...} })` when
    `ANTHROPIC_WORKSPACE_ID` is set, else falls back to the default
    `anthropic` singleton — fully backward compatible, no behavior change
    for a plain workspace key.
  - `.env.example`: documented the new optional `ANTHROPIC_WORKSPACE_ID`.
  - `src/lib/analysis/run-analysis.ts`: added server-side-only
    `console.error` in the `run.failed` catch (operators previously had no
    way to see why a run failed — the client-safe message is unaffected).
  - User added `ANTHROPIC_WORKSPACE_ID` to `.env.local` (never read by me);
    retried, confirmed the model call succeeds.
- Defect 2 — certainty-guard false positives: with the header fixed,
  `hypothesis.created` events appeared but hypotheses were intermittently
  dropped. `containsProhibitedCertaintyLanguage`'s bare-word regex matched
  "confirm"/"verified" regardless of grammar, rejecting correctly-hedged
  real model output: reasoning ending "...not a confirmed cause" (a
  negation) and a `recommendedNextStep` using "to confirm signal presence"
  (confirm as a legitimate verification-action verb — exactly the hedged
  behavior the system prompt asks for). Narrowed
  `PROHIBITED_CERTAINTY_PATTERN` (now `PROHIBITED_CERTAINTY_PATTERNS`, an
  array) in `src/lib/hypotheses/generate-hypotheses.ts` to match the
  grammatical certainty-CLAIM shape only — "is/are/was/were
  confirmed/verified/proven" and "confirmed/verified/proven as/to be" —
  while `root cause`, `definitely`, and `guarantee[sd]?` stay unconditional
  (no comparable benign usage found). Added a regression test with the
  exact live-observed false-positive strings. The temporary diagnostic
  `console.warn` added mid-investigation (echoed rejected hypothesis title/
  reasoning/recommendedNextStep) was removed — content must not be logged
  server-side (product/measurement data is confidential); the existing
  count-only `[analysis:runId] rejected N ...` warning in
  `run-analysis.ts` is the permanent, safe observability signal.
- Verification: `pnpm test` (65/65), `pnpm typecheck`, `pnpm lint` all pass.
  Live re-run (real browser session via chrome-devtools MCP, real signed-in
  smoke user, seeded Gateway X case — 40 MHz clock, 200 MHz / +7.4 dB
  measurement during "WiFi TX + display active") produced the full sequence
  `run.started → measurement.loaded → correlation.found → hypothesis.created
  → clarification.required → run.completed`, zero rejected hypotheses.
  Confirmed: `correlation.found` carries `sourceFrequencyMhz: 40,
  harmonicNumber: 5, expectedFrequencyMhz: 200, deviationRatio: 0` with the
  correlating `productFactId` intact (provenance preserved); the
  hypothesis's `evidence` array is `[observed, known, inferred, missing x5]`
  in that order; the hypothesis title/reasoning/recommendedNextStep contain
  no root-cause or certainty claims ("plausible harmonic relationship worth
  investigating", "worth investigating as a contributor"); the
  `clarificationQuestion` is a genuine, well-hedged missing-fact question.
  Persistence confirmed by direct Postgres query: all 6
  `analysis_events` rows present in the same order, `analysis_runs.status =
  'completed'`. Smoke-test user deleted afterward.
- Files changed: `src/lib/ai/provider.ts`, `src/lib/ai/provider.test.ts`
  (new), `.env.example`, `src/lib/analysis/run-analysis.ts`,
  `src/lib/hypotheses/generate-hypotheses.ts`,
  `src/lib/hypotheses/generate-hypotheses.test.ts`.
- Remaining: none. MVP-09 not started per explicit instruction.
- Commit: (see git log)

### 2026-08-31 — MVP-09: Investigation workspace UI
- Completed: the real investigation workspace at
  `/cases/[caseId]/investigation` — a three-region engineering-tool layout
  (PRODUCT / MEASUREMENT / INVESTIGATION), not a chatbot, built directly on
  the existing MVP-08 typed SSE pipeline with no architecture change.
  - **Reconstruction is the core design decision**
    (`src/lib/investigation/reconstruct.ts`): one pure reducer,
    `applyAnalysisEvent(state, event)`, folds a typed AnalysisEvent into
    `WorkspaceState`. The live client feeds it events as they stream in;
    the server feeds it every persisted `analysis_events` row for the
    case's latest run on page load
    (`src/lib/investigation/queries.ts` →
    `reconstructFromPersistedEvents`). Same function both ways — a refresh
    can't be told apart from a live run mid-flight except by one thing: if
    the reduced state is still "running" with no terminal event, that's
    reclassified as `"interrupted"` (a recoverable state, not a stuck
    spinner) — the connection dropped before the run finished, and nothing
    here ever re-triggers the model to "resume" it.
  - **Streaming**: `investigation-workspace.tsx` (`"use client"`) POSTs to
    the existing `/api/analysis-runs`, reads the response body with a
    plain `ReadableStream` reader, and decodes it with a small stateful
    `SseEventParser` (`src/lib/investigation/parse-sse-events.ts`) that
    handles the AI SDK's `JsonToSseTransformStream` framing arriving split
    across chunks. Each parsed event is re-validated against
    `analysisEventSchema` before it touches state — the network is a trust
    boundary regardless of which server produced it. No EventSource (POST
    body required), no chat/message list, no typing animation — panels
    update in place as `run.started` → `measurement.loaded` →
    `correlation.found` → `hypothesis.created` /
    `clarification.required` → `run.completed` arrive.
  - **Duplicate-run protection**: belt-and-suspenders — a `useRef` flag
    checked synchronously at the top of the click handler (closes the
    window before React's `disabled` prop re-renders), plus an
    `isSubmitting` state for instant visual feedback, plus the reducer's
    own `isRunActive(status)` check. A stream that ends without a terminal
    event (connection dropped) is caught explicitly and turned into a
    `failed` state with a distinct message, never left implying a run is
    still active.
  - **Correlation vs. hypothesis, visually distinct by design**: the
    deterministic `40 MHz × 5 = 200 MHz` correlation renders as arithmetic
    in its own card labeled "Candidate relationship" (never "root cause");
    the hypothesis is a separate signature card with evidence grouped into
    OBSERVED / KNOWN / INFERRED / MISSING sections (only sections with
    items render), INFERRED text styled distinctly (italic) so it never
    reads as a fact, and "Next investigation" (the recommended step) kept
    visually separate from the reasoning.
  - **Measurement panel / spectrum chart**: renders only what's actually
    stored — one peak, its margin vs. the selected limit, and the
    operating mode. `SpectrumChart` (`spectrum-chart.tsx`) deliberately
    draws a dashed limit line and a single peak marker/stem, nothing else
    — no fabricated trace, since only peak data is stored (not a raw
    spectrum). `MeasurementPanel` splits the free-text `operatingMode`
    string into chips on its natural conjunctions ("WiFi TX" / "display
    active") — a presentational re-split of the real stored string, not
    invented structured flags (the schema has no such fields).
  - **Product panel**: renders real `ProductFactRecord`s per-category
    (clock/radio/power/cable/other) with real labels and monospace values
    — never raw jsonb.
  - Reused existing conventions rather than adding new ones: `getFailureCase`
    (measurements+peaks), `loadProductFactRecords` +
    `describeProductFact`'s per-category shape, the same "each query
    function makes its own Supabase client" pattern already used
    throughout `src/lib/{cases,products}/queries.ts`.
- **Genuine infra fix found along the way**: `vitest.config.ts` doesn't set
  `test.globals: true`, so Testing Library's automatic `afterEach(cleanup)`
  — which only self-registers when it finds a global `afterEach` — was
  silently never running. Every existing test file happened to have only
  one `render()` call so this was invisible until this ticket's
  multi-render component test files started failing with "found multiple
  elements" (leftover DOM from earlier tests in the same file). Fixed once,
  centrally, in `vitest.setup.ts` with an explicit `afterEach(() =>
  cleanup())` — benefits every test file, not just this ticket's.
- Scope decision: the bottom composer ("Tell Crado what you measured,
  changed or observed…") was **not** built here. The MVP-09 instructions
  actually given were explicit about the three panels, streaming, and
  refresh reconstruction, and never mentioned a composer; MVP-10's own
  ticket title/acceptance ("Observation updates hypothesis" / "observation
  persists") is where recording an observation and updating a hypothesis
  actually belongs. Updated `features.json`'s MVP-09 acceptance
  accordingly (dropped "composer records observation", added the
  streaming/reconstruction criterion that was actually built and tested).
- Tests (25 new, all in `src/lib/investigation/` and
  `src/app/cases/[caseId]/investigation/`): `reconstruct.test.ts` (pure
  reducer — every event type, RUN AGAIN reset, empty hypotheses, multiple
  correlations, interrupted-run reclassification),
  `parse-sse-events.test.ts` (split-across-chunks framing, multiple frames
  per chunk, `[DONE]` sentinel, malformed JSON, schema-invalid frame — all
  non-throwing), `product-panel.test.tsx`, `measurement-panel.test.tsx`,
  `correlation-card.test.tsx`, `hypothesis-card.test.tsx` (all four
  evidence categories, section omitted when empty), and
  `investigation-workspace.test.tsx` — the integration-style test, using
  the real `JsonToSseTransformStream` (from `ai`) to build the mock
  response so the client parser is exercised against real byte framing,
  not a hand-rolled approximation: progressive updates (asserts an early
  disabled/empty state before the delayed stream delivers anything),
  correlation shown separately from hypothesis, multiple correlations,
  clarification banner, failed state, connection-drop-without-terminal
  handling, empty-hypotheses message, duplicate-click protection (asserts
  `fetch` called exactly once across three rapid clicks), refresh
  reconstruction (renders a completed state from `initialState` alone and
  asserts `fetch` is never called), and accessibility (status live region,
  alert role, disabled button with an explanatory `title`). 109/109 unit
  tests pass, `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean.
- Browser walkthrough (chrome-devtools MCP, real local app, real signed-in
  smoke user, real Anthropic call — no fake adapter): seeded a fresh
  Gateway X case (40 MHz clock, WiFi radio, a "Display path" fact, 200 MHz
  / +7.4 dB measurement during "WiFi TX + display active"). Clicked RUN
  INVESTIGATION and screenshotted mid-stream: button already read
  "ANALYZING…" and the `40 MHz × 5 = 200 MHz` correlation card had
  appeared, labeled "Candidate relationship" — while the hypothesis (the
  actual model call) was still in flight, confirming panels update
  progressively rather than all at once. Once complete: hypothesis card
  showed OBSERVED / KNOWN / INFERRED / MISSING sections correctly
  separated, "MEDIUM CONFIDENCE" badge, a distinct "NEXT INVESTIGATION"
  line, and no root-cause or certainty language in the model's text.
  Reloaded the browser: **zero network requests fired** (checked via
  `list_network_requests`) and the identical completed state re-rendered
  from persisted `analysis_events` — confirmed directly in Postgres too
  (5 events, `run.started` → `measurement.loaded` → `correlation.found` →
  `hypothesis.created` → `run.completed`, `analysis_runs.status =
  'completed'`). Resized to tablet (820px): Product + Measurement side by
  side, Investigation full-width below. Resized to mobile (390px): all
  three panels stacked. Smoke-test user deleted afterward.
- Files/areas added:
  `src/lib/investigation/{reconstruct,reconstruct.test,parse-sse-events,
  parse-sse-events.test,queries}.ts`,
  `src/app/cases/[caseId]/investigation/{page,investigation-workspace,
  product-panel,measurement-panel,spectrum-chart,investigation-panel,
  correlation-card,hypothesis-card,theme}.tsx` +
  matching `*.test.tsx` files, a small "Open investigation workspace" link
  added to the existing `src/app/cases/[caseId]/page.tsx`,
  `vitest.setup.ts` (the cleanup fix above).
- Remaining: no observation composer (MVP-10), no before/after comparison
  (MVP-11), single-measurement-per-case assumption (the panel picks the
  most recent measurement — MVP-11 is the ticket that has to decide how a
  second measurement is presented alongside the first).
- Next recommended ticket: MVP-10 (Observation updates hypothesis) — the
  composer, persisting an observation, and updating evidence/hypothesis
  without ever promoting an inference to a fact without real evidence. No
  blockers.
- Commit: (see git log)

### 2026-09-01 — MVP-10A: Engineering Knowledge Base
- Completed: workspace-isolated document storage, ingestion, and hybrid
  retrieval — infrastructure only, no agent (MVP-10B is explicitly next,
  not built here).
  - **Schema** (`supabase/migrations/20260901000000_engineering_documents.sql`):
    `engineering_documents` (filename, document_type, source, status,
    storage_path, mime_type, byte_size, page_count, failure_reason,
    is_current/supersedes_document_id for the current/historical
    relationship, product/revision composite FKs, same
    `current_workspace_id()`/RLS/trigger pattern as every other table) and
    `document_chunks` (chunk_index, page_number, section, content, a
    generated `tsvector` column, a `vector(512)` embedding column). Enabled
    `pgvector` (0.8.0, already available in the local Supabase image) and
    indexed `document_chunks` with `gin(content_tsv)` and
    `hnsw(embedding vector_cosine_ops)` — HNSW because it builds
    incrementally, unlike ivfflat which wants data present at creation.
  - **Storage**: a private `engineering-documents` bucket (never public),
    path convention `{workspaceId}/{documentId}/{filename}`
    (`src/lib/documents/storage-path.ts`, strips path separators from the
    filename), RLS on `storage.objects` keyed off the first path segment
    matching `current_workspace_id()`.
  - **The "semantic" embedding is a deliberate, documented MVP choice**:
    Anthropic has no embeddings API, and Crado has no other model-provider
    credential configured. Adding one (OpenAI, Voyage, etc.) purely for
    embeddings would be a new third-party credential — a one-way-door
    decision per CLAUDE.md, not something to add unasked. Instead,
    `src/lib/documents/embedding.ts` implements the "hashing trick"
    (Weinberger et al.): tokens hashed into a fixed 512-dim vector with a
    randomized sign, L2-normalized. It's a real, well-known lexical
    embedding technique — genuinely scores word-overlap similarity higher
    than unrelated text (verified in a unit test) — but it is NOT a
    neural/contextual embedding, and nothing in the UI or docs claims it
    is. Zero cost, zero network call, fully deterministic, and a real
    embedding provider is a drop-in swap behind the same function
    signature once a key is approved.
  - **Ingestion** (`src/lib/documents/{extract-text,chunk-text,
    ingest-document}.ts`): PDF (via `unpdf`, a pdfjs-dist wrapper with no
    native/canvas dependency needed for text-only extraction — confirmed
    canvas is an optional peer, not pulled in), TXT, and Markdown only —
    no OCR, no CAD. A PDF with no extractable text is marked `status:
    failed` with a clear reason mentioning OCR, never silently indexed
    with zero chunks. Chunking preserves page number (PDF) or the nearest
    Markdown heading as `section`, greedily merging paragraphs up to
    ~1000 chars per chunk. `ingestDocument` is idempotent on retry
    (deletes any partial chunks before inserting the fresh set) and takes
    an already-authenticated Supabase client (same shape as
    `createAnalysisRunForFailureCase`), which is what makes it directly
    integration-testable.
  - **Retrieval** (`src/lib/documents/search.ts`): `searchEngineeringDocuments(supabase,
    {query, productId?, productRevisionId?, limit?})` calls a single
    Postgres function, `search_document_chunks`, that ranks
    `0.5 * ts_rank_cd(keyword) + 0.5 * (1 - cosine_distance)` server-side
    — no chunk is ever pulled into Node memory to be re-ranked in
    application code. Workspace scoping is not a parameter at all: the
    SQL function reads `current_workspace_id()` itself, so there's no
    argument a caller could pass to search another workspace even by
    accident. Every result carries `documentId`, `filename`,
    `pageNumber`/`section`, and the exact `passage` — never a summary,
    never fabricated.
  - **UI** (`/documents`): "SOURCES" + a real `count: "exact"` total (never
    a placeholder), a paginated document list with the four real statuses
    (UPLOADING/PROCESSING/INDEXED/FAILED, with the failure reason shown
    inline for FAILED), an upload form, and a search panel where selecting
    a result shows document/page-or-section/passage with query terms
    highlighted as real React `<mark>` nodes (never
    `dangerouslySetInnerHTML` — uploaded document text is user-controlled
    content in a multi-tenant app). Same scoped graphite/mono theme as the
    MVP-09 investigation workspace, its own `theme.ts` (not shared —
    each screen owns its theme file, not a premature design system).
- **Genuine defect found and fixed**: `listEngineeringDocuments` initially
  fell back to `totalCount: 0` whenever a requested page was past the end
  of the data. Root cause: PostgREST errors (`PGRST103`, "Requested range
  not satisfiable") rather than returning an empty page with a real count
  when `.range()`'s offset exceeds the row count — confirmed directly
  against local Postgres before fixing. Fixed by falling back to a
  second, unranged `count: "exact", head: true` query (no rows fetched)
  whenever the ranged query errors, so a stale/past-the-end page still
  reports the real total instead of implying the workspace is empty.
  Caught by the 120-document pagination integration test, not guessed at.
- **Testability decision**: `listEngineeringDocuments` takes an
  already-authenticated Supabase client as a parameter (like
  `searchEngineeringDocuments` and `ingestDocument`) rather than building
  its own via `next/headers`' `cookies()` the way the older
  `src/lib/{cases,products}/queries.ts` do. Pagination is an explicit
  required test in this ticket, and a `cookies()`-based client can't be
  exercised outside Next's own request lifecycle — this module adopts the
  more testable MVP-08 pattern; the older query modules are unchanged.
- Tests: 154 unit / 32 integration, all passing, no real Anthropic call and
  no real embedding API call anywhere (the embedder needs no network).
  Unit: `embedding.test.ts` (determinism, normalization, dimension,
  lexical-similarity ordering), `chunk-text.test.ts` (page/section
  provenance, heading tracking, boundary chunk-splitting, whitespace-only
  page), `extract-text.test.ts` (real PDF fixtures built with `pdf-lib`,
  no-extractable-text failure, corrupt-PDF failure, empty-text-file
  failure), `storage-path.test.ts` (path traversal stripped). Component:
  `document-list.test.tsx` (all four statuses, pagination boundaries,
  historical marker), `source-preview.test.tsx` (highlighting, page/section
  combinations, regex-special-character query doesn't crash),
  `search-panel.test.tsx` and `upload-form.test.tsx` (server actions
  mocked via `vi.hoisted`, since they call `next/headers`-based
  `createClient()`). Integration (real local Postgres/RLS/Storage):
  `ingest-document.integration.test.ts` (PDF/Markdown indexing with real
  provenance, failed-extraction case, idempotent re-ingest),
  `search.integration.test.ts` (hybrid ranking, product filtering,
  revision filtering, workspace isolation — an identical query as
  Workspace A never surfaces Workspace B's chunk),
  `queries.integration.test.ts` (the 120-document scale/pagination test
  from CLAUDE.md section 9 — real programmatic rows, not real PDFs;
  product filtering; workspace isolation on the list/count),
  `storage-security.integration.test.ts` (own-file round-trip; another
  workspace's file can't be downloaded even with its exact real path,
  can't be listed by guessing the workspace UUID prefix, can't be
  uploaded into, can't be deleted).
- Browser walkthrough (chrome-devtools MCP, real local app, real signed-in
  user): uploaded a real Markdown file through the actual `/documents`
  page — real extraction, real chunking (headings captured as `section`:
  "Suspected Source", "Radiated Emissions Summary", "Recommended Next
  Step"), real embedding, ended at `INDEXED` with a real "SOURCES 1"
  count. Searched "40 MHz clock harmonic" — the chunk actually about the
  clock ranked first; selected it and the source preview showed the
  correct section and passage with "40", "MHz", "clock" highlighted.
  Smoke-test user deleted afterward.
- Files/areas added: `supabase/migrations/20260901000000_engineering_documents.sql`,
  `src/lib/domain/schema.ts` (document type/status/source/mime enums,
  upload input schema), `src/lib/documents/{embedding,extract-text,
  chunk-text,ingest-document,search,queries,storage-path,
  integration-test-helpers}.ts` + matching `*.test.ts`/`*.integration.test.ts`,
  `src/app/documents/{page,theme,upload-form,document-list,search-panel,
  source-preview,actions}.tsx` + matching `*.test.tsx`, a "Sources" link
  added to `src/app/workspace/page.tsx`. New dependencies: `unpdf`
  (PDF text extraction, no native canvas needed for this use case) and
  `pdf-lib` (devDependency, only used to build real PDF fixtures in
  tests).
- Remaining: no OCR, no CAD/STEP parsing (explicitly out of MVP-10A
  scope). No real neural embedding provider configured — see the embedding
  design note above. Not wired into any agent yet — MVP-10B builds the
  Investigation Agent that calls `searchEngineeringDocuments()`; MVP-10C
  builds the polished citation/source drawer this UI's source preview is
  a first cut of.
- Next recommended ticket: MVP-10B (Investigation Agent) — calls
  `searchEngineeringDocuments()` as a tool, no LangGraph/ToolLoopAgent per
  CLAUDE.md's explicit "do not" list for this phase. MVP-10 (composer +
  observation updating a hypothesis) also remains open and has no
  dependency on MVP-10A. No blockers either way.
- Commit: (see git log)

### 2026-09-01 — MVP-10B
- Completed: The Investigation Agent — an AI SDK 7 `ToolLoopAgent`
  orchestration layer added on top of the working MVP-06/07/08/09
  pipeline, not a replacement for it. `createInvestigationAgent({supabase,
  model, caseContext})` (`src/lib/agents/investigation-agent.ts`) is a
  per-request factory (no global/singleton agent holding customer state)
  with exactly six bounded tools (`src/lib/agents/tools.ts`):
  `getProductContext`, `getMeasurementContext`,
  `getDeterministicCorrelations` (returns MVP-06's already-computed
  candidates, never recomputes them), `searchEngineeringDocuments` (wraps
  MVP-10A's function, callable multiple times with different queries),
  `getPreviousRevisions`, `getPreviousInvestigations`. Structured output
  only (`Output.object`, Zod — `src/lib/agents/schema.ts`): `hypotheses[]`
  (title/reasoning/evidenceRefs/missingEvidence/nextInvestigation),
  `clarificationQuestion`, `investigationStatus`. `stopWhen: stepCountIs(9)`
  — not the SDK's 20-step default.
  Independent post-hoc validation (`src/lib/agents/validate-agent-output.ts`,
  "Zod validates shape, not truth"): rejects a whole hypothesis for a
  hallucinated `productFactId` or certainty/root-cause language (reusing
  MVP-07's `buildObservedEvidence`/`buildKnownEvidence`/
  `containsProhibitedCertaintyLanguage` rather than reimplementing them);
  drops just one bad citation (an id never actually retrieved this run, or
  a chunkId/documentId that don't pair up) without discarding an otherwise
  sound hypothesis. A citation's evidence text always comes from the
  stored tool-call result, never the model's own restatement of it. Three
  new observable-only event types (`agent.started`, `agent.tool.completed`,
  `agent.completed`) added to `analysisEventTypeSchema`, `events.ts`, an
  additive migration, and `reconstruct.ts`'s reducer — never hidden
  reasoning or a raw prompt, safe display fields only (tool name, label,
  result count, durationMs, query). `agent.completed` carries truthful,
  actually-computed metrics (documentsAvailable/documentSearches/
  passagesRetrieved/passagesUsedAsEvidence/
  deterministicRelationshipsChecked/nextInvestigationCount) for MVP-10C.
  Integration is fully additive/backward-compatible: `runAnalysis` takes
  an optional `agentRunner` (falls back to MVP-07's plain adapter path
  unchanged when omitted — this is what every existing MVP-08/09 test
  still exercises), and `createAnalysisRunForFailureCase` takes an
  optional `agentModel` (only the real `POST /api/analysis-runs` route
  passes one, via a new `resolveInvestigationAgentModel()` in
  `src/lib/ai/provider.ts` that reuses `resolveAnthropicProvider()`/
  `buildAnthropicHeaders()` rather than duplicating them).
- Tests: 185 unit / 32 integration, all passing, no real Anthropic call in
  the committed suite. `investigation-agent.test.ts` drives the *real*
  `ToolLoopAgent` end-to-end against a scripted `MockLanguageModelV4` (no
  real network) — tool loop execution, activity-event construction,
  hallucinated-citation dropping, hallucinated-productFactId rejection,
  certainty-language rejection, a tool-execution failure handled without
  crashing the run, and step-limit termination staying well under the
  SDK's 20-step default. `validate-agent-output.test.ts` (16 cases) covers
  the belt-and-suspenders validator directly: OBSERVED/KNOWN/INFERRED/
  MISSING assembly, every citation-rejection path (chunk never retrieved,
  document/chunk mismatch, fact never retrieved, investigation-event never
  retrieved), certainty language in reasoning vs. nextInvestigation vs.
  clarificationQuestion, multiple-hypotheses partial rejection, empty
  input, and the truthful-metrics builder. `run-analysis.test.ts` gained 5
  cases for the new branch, using a hand-written fake `agentRunner` (same
  pattern as the existing fake `HypothesisModelAdapter`) — event ordering
  with the agent phase, deterministic correlations still guaranteed before
  the agent runs, falling back to the plain path with zero candidates,
  `run.failed` (not an unhandled rejection) when the agent throws, and
  agent-sourced clarification. `reconstruct.test.ts` gained cases for the
  three new event types plus a full agent-phase reconstruction. All prior
  MVP-08/09/10A unit and integration tests pass completely unmodified.
- Live Gateway X test (real Anthropic call, real local Supabase, then
  deleted — not part of the committed suite): seeded Rev17 with a 40 MHz
  clock, a 2.4 GHz WiFi radio, and an unshielded display ribbon cable
  fact, a 200 MHz/+7.4dB measurement during "WiFi TX + display active",
  and one real Markdown test-report document (the session's `EMC-Test-04`
  scratchpad note). Full event sequence: `run.started` ->
  `measurement.loaded` -> `correlation.found` -> `agent.started` -> 9x
  `agent.tool.completed` -> `agent.completed` -> 2x `hypothesis.created`
  -> `run.completed` — no `run.failed`. The agent called
  `getMeasurementContext`, `getDeterministicCorrelations`,
  `getProductContext`, `getPreviousRevisions`, `getPreviousInvestigations`,
  then 5 separate targeted `searchEngineeringDocuments` calls (not one
  broad query) — 15 passages retrieved, 4 actually used as evidence.
  Produced two hypotheses: "5th harmonic of 40 MHz system clock radiating
  directly from clock trace/oscillator" (confidence high) and "Unshielded
  display ribbon cable acting as an unintentional antenna for the coupled
  clock harmonic" (confidence medium) — each with real document citations
  quoting the actual stored passage text with filename+section, a clearly
  separated INFERRED synthesis sentence, concrete MISSING evidence, and a
  physical next-measurement suggestion. No root-cause/certainty language
  anywhere (asserted programmatically against the same regex family as
  `containsProhibitedCertaintyLanguage`). Persisted `analysis_events` rows
  matched the streamed sequence exactly; `analysis_runs.status` was
  `completed`.
  The live run surfaced two real defects, both fixed and covered by a
  regression test before the ticket closed: (1) the agent's
  evidence-integrated `reasoning`/`nextInvestigation` legitimately runs
  longer than MVP-07's single-shot limits — a real response failed Zod
  validation at 600/300 chars and the whole run became `run.failed`;
  widened to 1200/500 chars and added a system-prompt line asking for
  conciseness. (2) the tool-activity label pluralizer naively appended
  `s` to two-word nouns ("passage retrieveds", "revision founds"); fixed
  to pluralize the noun and keep the suffix ("2 passages retrieved").
- Files/areas added: `supabase/migrations/20260901010000_analysis_events_agent.sql`,
  `src/lib/agents/{schema,tools,investigation-agent,validate-agent-output}.ts`
  + matching `*.test.ts`. Files/areas changed: `src/lib/domain/schema.ts`
  (three new event types), `src/lib/analysis/events.ts` (three new payload
  schemas/variants), `src/lib/analysis/run-analysis.ts` (optional
  `agentRunner`, `InvestigationAgentRunner` interface), `src/lib/analysis/
  create-analysis-run.ts` (optional `agentModel`, richer failure-case/
  measurement selects for the agent's tool context, `documentsAvailable`
  count), `src/lib/investigation/reconstruct.ts` (three new reducer
  cases, three new `WorkspaceState` fields), `src/lib/ai/provider.ts`
  (`resolveInvestigationAgentModel`), `src/app/api/analysis-runs/route.ts`
  (passes `agentModel` when `ANTHROPIC_API_KEY` is configured).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Agent-vs-plain-path is opt-in per call (`agentModel`/`agentRunner`
    both optional, default omitted), not a hard replacement of MVP-07's
    adapter path. This is what kept every existing MVP-08/09 test
    passing unmodified — the plain path stays real, tested, load-bearing
    code (the fallback when no agent context is available), not dead
    code kept only for nostalgia.
  - Document-passage/product-fact/investigation-event citations are
    validated against a registry built from the *real* tool-call results
    of this one run (via `onToolExecutionEnd`), not from the closure
    context available to the tools — a fact the agent never actually
    asked for via `getProductContext` can't be cited even though the data
    technically exists, which is the actual guarantee CLAUDE.md's
    provenance rule needs.
  - The MVP-10A hashed-lexical embedding was intentionally left
    unchanged — MVP-10B confirms and does not revisit that decision.
- Remaining: MVP-10C's UI has real backend material to render now
  (`agentActivity`/`agentActive`/`agentMetrics` on `WorkspaceState`, and
  every citation traceable to filename+section/page) but no UI was built
  here — out of this ticket's explicit scope. `diagnostic_hypotheses`/
  `evidence_items` tables remain unused (hypotheses still live only in
  `analysis_events` payloads, matching MVP-07/08/09's existing pattern —
  not something this ticket changed).
- Next recommended ticket: MVP-10C (polished agent-activity UI: observable
  tool-call log, source/citation drawer) or MVP-10 (composer + observation
  updating a hypothesis) — both are open, neither blocks the other.
- Commit: (see git log)

### 2026-09-01 — MVP-10C: Investigation workspace UX
- Completed: upgraded `/cases/[caseId]/investigation` from three independent
  panels into one connected investigation workspace, per explicit instruction
  not to touch the Investigation Agent's architecture except where the UI
  exposed a genuine defect.
  - **Layout**: a single responsive CSS grid (six children: Product,
    Measurement, Investigation, Agent Activity, What Crado Handled, Sources)
    using per-breakpoint Tailwind `order-*` classes rather than duplicated
    markup — desktop is header row + PRODUCT | MEASUREMENT | INVESTIGATION +
    full-width AGENT ACTIVITY row; mobile order is Measurement, Investigation
    (Next Investigation is inline per-hypothesis, not separate), Agent
    Activity, What Crado Handled, Sources, Product, exactly as specified.
    Verified live at desktop (1440px), tablet (834px — collapses to a
    sensible two-column PRODUCT/MEASUREMENT row), and mobile (390px).
  - **Agent Activity** (`agent-activity-panel.tsx`): renders only persisted
    `agent.started`/`agent.tool.completed`/`agent.completed` events as plain
    observable work — "Loaded product context / 3 structured facts",
    "Searched engineering documents / 3 passages retrieved / Query: ...",
    etc. No "thinking"/"reasoning"/chain-of-thought language anywhere. A
    live run shows tool events appearing one at a time under a pulsing
    "◌ Working…" `role="status"` line — no fake typing animation.
  - **What Crado Handled** (`agent-metrics-panel.tsx`): a `<dl>` grid over
    the six real `agent.completed` fields (documentsAvailable/
    documentSearches/passagesRetrieved/passagesUsedAsEvidence/
    deterministicRelationshipsChecked/nextInvestigationCount) — no
    hardcoded numbers; a 1-document workspace correctly shows "1", not a
    placeholder like 600/612.
  - **Structured citations — the one architecture change made, and why it's
    in-scope**: added an optional `citation` object (documentId, chunkId,
    filename, documentType, pageNumber, section, passage) to
    `finalEvidenceItemSchema` (`src/lib/hypotheses/schema.ts`) and had
    `buildDocumentPassageEvidence` (`validate-agent-output.ts`) return it
    alongside the existing text description — built only from the stored
    retrieval registry, never model-generated text. This is additive/
    optional (old persisted rows without it still validate) and was the one
    genuine gap the ticket's own citation/provenance requirements exposed:
    citations existed only as unstructured prose before, with no reliable
    way for the UI to link a claim back to its exact source.
  - **Source drawer** (`source-drawer.tsx`, new, from scratch, no external
    dialog library): opens on citation click, shows filename/type/revision,
    page or section, the exact stored passage, "Used in" (hypothesis title)
    and "Evidence type". Real accessible dialog: `role="dialog"
    aria-modal="true"`, focus captured on open and restored to the exact
    triggering button on close, manual Tab focus-trap, Escape-to-close,
    backdrop-click-to-close, full-screen sheet on mobile. Verified in a real
    Chrome instance (chrome-devtools MCP), not just jsdom: Escape closed the
    drawer and returned focus to the precise citation button that opened it.
  - **Sources panel** (`sources-panel.tsx`): documents actually used
    (deduped by citation, `derive-sources-used.ts`) with per-document
    passage-used counts, real "N documents available · N searches performed
    · N passages retrieved" header, a link to `/documents`, and two distinct
    honest empty states ("no relevant passages retrieved" vs. "passages
    retrieved but none used as evidence") — both independently confirmed as
    real, reachable states (see live run below, not just fixtures).
  - **Hypothesis card polish**: "HYPOTHESIS 0N" numbering, citation badges
    beside KNOWN evidence that carries one, a "Why this test" line beside
    Next Investigation reusing the hypothesis's own INFERRED synthesis (no
    new model call). Deterministic-relationship arithmetic stays visually
    separate from AI inference (unchanged from MVP-09, confirmed still
    correct here).
  - **`/documents` polish**: "SOURCES" heading with a real always-unfiltered
    total count (a filter never makes the library look smaller), six filter
    tabs (All/Product/Testing/Regulatory/Datasheets/Notes,
    `describe-document-type.ts`'s new `DOCUMENT_TYPE_GROUPS`,
    server-rendered `<Link>`s so filtering needs no client JS), rows now
    show product/revision and a real indexed date
    (`src/lib/documents/queries.ts` joins `products`/`product_revisions`).
    Verified live: filtering to a type with zero matches shows "0 matching /
    No documents match this filter." while the header total stays honest.
- **Genuine defect found and fixed during live QA, not guessed at**:
  `sources-panel.tsx` rendered "1 documents available" — a real
  singular/plural bug invisible to every jsdom test (fixed test data never
  hit the n=1 case). Found only by looking at the actual rendered page with
  the real 1-document seed case; fixed with singular/plural ternaries for
  both "document(s) available" and "passage(s) retrieved", confirmed fixed
  live via Next.js Fast Refresh.
- Tests: 214 unit tests (60 new: `agent-activity-panel`,
  `agent-metrics-panel`, `sources-panel`, `source-drawer`,
  `type-filter-tabs` test files new; `hypothesis-card`,
  `investigation-workspace`, `document-list`, `validate-agent-output` tests
  extended), `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
  `investigation-workspace.test.tsx` gained a dedicated "Investigation Agent
  (MVP-10C)" block: progressive live streaming of agent-activity events,
  full replay of a completed run, citation click → drawer → Escape closes
  and restores focus, the honest empty-passages state, and agent metrics/
  sources correctly absent when the agent phase never ran (plain MVP-07/08/09
  path, unaffected by any of this).
- Live browser walkthrough (chrome-devtools MCP): seeded a fully realistic
  completed Gateway X run directly into Postgres (same real data captured
  from MVP-10B's live Anthropic test) to inspect the replay/completed UI
  without a second paid model call, then separately triggered one real,
  live (non-replayed) Anthropic run via "RUN AGAIN" on that same case to
  confirm the progressive streaming UX and get real timing numbers:
  - Desktop (1440px): full three-column layout, agent activity panel,
    metrics grid, sources list, and source drawer all confirmed against the
    real a11y tree and screenshots.
  - Tablet (834px): Product/Measurement collapse to two columns,
    Investigation/Agent Activity/Sources stay full-width below — a
    reasonable intermediate layout, not a forced 3-column squeeze.
  - Mobile (390px): confirmed exact required order (Measurement,
    Investigation with hypotheses, Agent Activity, What Crado Handled,
    Sources, Product).
  - Keyboard pass: Tab order is top-to-bottom/left-to-right (back link →
    Edit facts → Add measurement → Run Again → citation buttons →
    View all sources), every stop has a visible focus outline; drawer
    focus-trap/Escape/focus-restore confirmed live (not just in jsdom).
  - `/documents`: real "SOURCES" / total count, filter tabs wired to real
    `?type=` URLs, "Testing" filter correctly includes the one seeded
    test-report document, "Product" filter correctly shows the honest
    zero-match empty state without shrinking the header total.
  - **Live (non-replayed) run**: clicked "Run again" on the real case;
    button changed to disabled "ANALYZING…", the deterministic correlation
    appeared immediately, then agent-activity events appeared one at a time
    under a pulsing "Working…" status over the course of the run, then
    "Investigation complete" with 3 hypotheses. Total wall-clock time from
    click to completion: **~47 seconds**. This run's 5 document searches
    all legitimately returned 0 passages (real semantic/keyword search
    against the one seeded document's actual phrasing didn't match this
    run's query terms) — confirming "No relevant passages were retrieved
    for this investigation." is real, reachable behavior, not only a test
    fixture; hypotheses correctly fell back to product-context-only KNOWN
    evidence with no citation badges. Refresh after completion reconstructed
    the identical state from `analysis_events` with no re-run.
  - Observed but explicitly out of this ticket's scope (no architecture
    change made): the live model occasionally emits a duplicate KNOWN
    evidence line within one hypothesis (e.g. "Product context: system
    clock — 40 MHz" listed twice). This is a model-output quality issue in
    MVP-10B's prompt/output, not a UI rendering defect — the workspace
    faithfully renders whatever the persisted event contains. Worth a
    future prompt-tightening pass, not a reason to touch the agent now.
  - Whether the ~47s / up-to-9-model-steps latency is visibly justified:
    yes, materially — the Agent Activity panel showed 7 distinct, concretely
    quantified actions (measurement/product-context load, 2 history checks,
    5 document searches with their exact query strings and result counts)
    that a user can read end-to-end and see real work happened, not a
    generic spinner. The one soft edge: 5 consecutive document searches
    that all returned 0 results back-to-back can read as "flailing" rather
    than "efficient" to an engineer watching live — a genuine UX
    observation for a future tuning pass (e.g. capping/deduping near-
    identical failed queries), not something addressed here since it's
    MVP-10B agent behavior, not a UI defect.
  - Cleanup: the throwaway seed script
    (`src/lib/agents/__seed-walkthrough.integration.test.ts`) and all QA
    screenshots (`.qa-screenshots/`) were deleted before commit, matching
    the MVP-10B precedent — neither is part of the committed suite.
- Files/areas added: `src/app/cases/[caseId]/investigation/{agent-activity-
  panel,agent-metrics-panel,derive-sources-used,sources-panel,source-drawer}.tsx`
  + matching `*.test.tsx`, `src/lib/documents/describe-document-type.ts`,
  `src/app/documents/type-filter-tabs.tsx` + `.test.tsx`. Files/areas
  changed: `src/lib/hypotheses/schema.ts` (citation field),
  `src/lib/agents/{validate-agent-output,investigation-agent}.ts` +
  `validate-agent-output.test.ts`, `src/app/cases/[caseId]/investigation/
  {hypothesis-card,investigation-panel,investigation-workspace}.tsx` +
  `*.test.tsx`, `src/app/documents/{document-list,page}.tsx` +
  `document-list.test.tsx`, `src/lib/documents/queries.ts` (product/revision
  join, type filtering).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Citation is optional/additive on the existing evidence schema rather
    than a new table or a required field — old persisted hypotheses (no
    citation) still render correctly with plain KNOWN text and no badge,
    matching "a hypothesis with no document citations should just show
    deterministic/product evidence only."
  - Built the source drawer as a hand-written accessible dialog rather than
    pulling in a UI library — one focused, fully-owned component with no new
    dependency, consistent with CLAUDE.md's "no package unless it saves
    meaningful implementation time" and the existing near-monochrome custom
    design language.
  - Reused a real completed run's exact data (captured from MVP-10B's live
    test) to seed a throwaway visual-QA case rather than paying for a
    second live Anthropic call for every layout/breakpoint check — the one
    live call actually spent was reserved for the thing only a live call
    can prove: progressive streaming UX and real timing.
- Remaining: none for MVP-10C. The duplicate-KNOWN-evidence-line and
  multiple-empty-searches observations above are notes for a future MVP-10B
  prompt-tuning pass, not blockers.
- Next recommended ticket: MVP-10 (composer + observation updating a
  hypothesis) — the next open, unblocked ticket. Do not start it without
  further instruction (explicitly deferred by the user this session).
- Commit: (see git log)

### 2026-09-01 — MVP-11: the physical investigation feedback loop
(The user's instructions this session called this ticket "MVP-11" and
described exactly features.json's pre-existing MVP-10 — "observation
persists" / "analysis can update evidence/hypothesis" / "does not convert
inference to fact without evidence" — plus substantially more. features.json
now records this against MVP-10, which is what it actually satisfies; the
pre-existing MVP-11 entry there, engineering change + second measurement,
was explicitly **not** started per this session's own instruction.)

- Completed: an engineer can give Crado new physical evidence after
  following a recommended investigation, and Crado updates the case without
  losing any previous hypothesis/evidence history. No agent architecture
  redesign — the existing `getPreviousInvestigations` tool already reads
  whatever's newly persisted, so recording an observation needed zero agent
  changes to become visible on the next run; one new bounded 7th tool
  (`getPreviousHypotheses`) was added for the agent to see prior hypotheses,
  matching the same small, single-purpose-tool pattern MVP-10B established.
  - **1. Observation input** (`record-observation-form.tsx`, new): a
    "Record result" action under the hypotheses, collapsed behind a plain
    button until clicked — never an open chatbot textarea. Four structured
    fields exactly as specified: Observation (required), Measurement change
    if known, Operating mode, Notes. `useActionState` + `disabled={pending}`
    is the duplicate-submission guard (verified by a real rapid-double-click
    test: a disabled `<button>` genuinely doesn't dispatch a second click,
    in jsdom and real Chrome both).
  - **2. Persistence**: `src/lib/investigation/record-observation.ts`
    (split out from the "use server" action the same way MVP-08 split
    create-analysis-run.ts from route.ts, specifically so the DB-touching
    core is directly integration-testable) inserts one
    `investigation_events` row (`event_type: "observation"`), RLS-scoped
    like every other table. Nothing is ever rewritten or deleted — every
    prior `analysis_events`/`investigation_events` row stays exactly as it
    was; "history" is the existing insert-only architecture, not new
    machinery.
  - **3. Evidence rule**: `buildInvestigationEventEvidence` in
    `validate-agent-output.ts` now maps an `event_type: "observation"`
    citation to `category: "observed"` (previously always `"known"` for
    every investigation-event citation — a real gap the ticket's explicit
    "must remain distinguishable" requirement exposed and this session
    fixed). The model still cannot write OBSERVED/KNOWN text itself; this
    is purely which deterministic bucket a real stored row's text lands in.
  - **4. Agent update**: `getPreviousHypotheses` (`tools.ts`) returns
    hypotheses from earlier **completed** runs of the same case (`status =
    "completed"` is what excludes the run currently in flight, without
    needing to know its own runId). `agentHypothesisSchema` gained two
    required-but-nullable fields, `previousHypothesisId` and
    `hypothesisUpdateStatus` (one of `supported_by_new_evidence` /
    `weakened_by_new_evidence` / `unchanged` / `needs_more_evidence` — a
    new domain enum, `hypothesisUpdateStatusSchema`) — matching the same
    "always nullable, never silently optional" convention
    `clarificationQuestion` already established. `validateAgentOutput`
    trusts the pairing only when `previousHypothesisId` is one this exact
    run's tool call actually returned (same "never trust the model's own
    say-so" rule as every other citation); an invalid id silently drops the
    update rather than rejecting the hypothesis. No Bayesian/probability
    update is implemented, so none is exposed — four qualitative labels
    only, styled distinctly (green/warn/neutral/dashed), never a score.
  - **5. Gateway X live behavior**: confirmed live (see below) — an
    observation showing a 9 dB drop after disconnecting the display path
    produced exactly the qualitative shift the ticket describes: the
    display-path hypothesis promoted to `SUPPORTED BY NEW EVIDENCE`, a
    WiFi-TX hypothesis marked `WEAKENED BY NEW EVIDENCE` (correctly
    reasoned: the 9 dB alone nearly accounts for the whole margin, leaving
    little room for WiFi as an independent contributor), and a third
    marked `NEEDS MORE EVIDENCE`. No "root cause confirmed" language
    anywhere.
  - **6. Investigation timeline** (`investigation-timeline.tsx` +
    `src/lib/investigation/timeline.ts`, both new): a chronological,
    read-only merge of every measurement, hypothesis (across **all** runs,
    not just the latest — this is what makes it prove history, not just
    reconstruct the current run), and observation for a case. Deliberately
    given an explicit-Supabase-client signature (not the older cookie-based
    `cases/queries.ts` convention) for the same reason MVP-10A did that for
    `listEngineeringDocuments`: so "old hypothesis remains historical" is
    directly integration-testable against real Postgres, not just a hand-
    built fixture.
  - **7. UI**: the existing polished workspace is unchanged in structure;
    the timeline is a new full-width row (mobile/desktop) between
    Investigation and Agent Activity, and the Record-result action sits
    directly under the hypotheses list. A hypothesis-update badge
    (`describe-hypothesis-update.ts`, shared between `hypothesis-card.tsx`
    and the timeline so the two surfaces can't drift in wording) appears
    beside the confidence badge on a continuing hypothesis.
  - **8. Refresh**: the timeline is fetched server-side in `page.tsx` and
    passed down, so a `revalidatePath` after recording a result refreshes
    it without touching the client-only `WorkspaceState`/SSE machinery at
    all; a full page reload reconstructs the observation, updated
    hypothesis status, and the complete timeline purely from persisted
    rows, never rerunning the model (verified live, see below).
- Tests: 231 unit tests (23 new: `validate-agent-output.test.ts` gained
  OBSERVED-classification and hypothesis-update-assembly cases including a
  hallucinated-`previousHypothesisId` rejection; new
  `investigation-timeline.test.tsx`, `record-observation-form.test.tsx`
  including a real rapid-double-click duplicate-submission test; extended
  `hypothesis-card.test.tsx` for the update badge; agent-schema test
  literals updated for the two new required-nullable fields). 38 integration
  tests (6 new, `src/lib/investigation/mvp11.integration.test.ts`): records
  an observation with the exact structured fields; workspace isolation (a
  second user can neither write into nor read someone else's case, proven
  via both `insertInvestigationObservation` and `getInvestigationTimeline`);
  `getPreviousInvestigations` sees a real newly-recorded observation;
  `getPreviousHypotheses` returns a prior completed run's hypothesis and
  excludes a same-case run that's still `"running"`; the timeline shows
  both an original and an "updated investigation" entry with the right
  status, in chronological order, after a follow-up run; a `run.failed`
  second run adds nothing and removes nothing from the existing history.
  `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass.
- Live Gateway X walkthrough (chrome-devtools MCP, real browser, the
  existing seeded case from the MVP-10C session — its already-completed
  run stood in as "run 1" rather than paying for a redundant first live
  call): clicked "Record result", entered exactly the ticket's own example
  ("Display path disconnected." / "200 MHz peak dropped 9 dB."), got
  "Observation recorded." and an immediate timeline update (via
  `revalidatePath`, no client-side wiring needed) — confirmed **live**, not
  just via test. Clicked "Run again" for one real Anthropic call (**not**
  a replay): the agent's Agent Activity panel showed "Reviewed previous
  investigations / 1 event found" and "Reviewed previous hypotheses / 5
  hypotheses found" (the new tool actually used, in a real run), and
  produced three hypotheses with exactly the qualitative outcomes described
  in item 5 above — real, freshly-generated reasoning, not scripted. Total
  wall-clock time for this second (follow-up) run: **~57 seconds**.
  Reloading the page afterward confirmed refresh reconstruction: the
  timeline showed all 5 original hypotheses unchanged plus 3 new "UPDATED
  INVESTIGATION" entries with their status badges, in correct chronological
  order — proving both "old hypothesis remains historical" and "refresh
  reconstructs without rerunning the model" against real persisted state,
  not a fixture.
- **UX issue discovered, not fixed here (out of this ticket's UI-only
  scope)**: immediately after "Run again" completes, the Investigation
  Timeline panel does **not** yet show the new run's hypotheses/status
  badges — it only picks them up on the next full page load/revalidate,
  because the timeline is fetched server-side in `page.tsx` while the live
  agent run is pure client-side SSE state (`WorkspaceState`). The main
  Investigation panel above it updates live and correctly; the timeline
  lags one refresh behind. Worth a follow-up ticket (e.g. append a
  synthetic timeline entry client-side from the same `hypothesis.created`
  SSE events already being applied to `WorkspaceState`) rather than fixing
  opportunistically here.
- Files/areas added: `src/app/cases/[caseId]/investigation/{actions,
  record-observation-form,investigation-timeline,
  describe-hypothesis-update}.tsx` + matching `*.test.tsx` where
  applicable, `src/lib/investigation/{record-observation,timeline,
  mvp11.integration.test}.ts`. Files/areas changed:
  `src/lib/domain/schema.ts` (`hypothesisUpdateStatusSchema`,
  `investigationObservationInputSchema`), `src/lib/hypotheses/schema.ts`
  (`hypothesisUpdateSchema`, optional `update` on `finalHypothesisSchema`),
  `src/lib/analysis/events.ts` (optional `update` on
  `hypothesisCreatedPayloadSchema`), `src/lib/analysis/run-analysis.ts`
  (forwards `update` into the emitted event), `src/lib/agents/schema.ts`
  (`previousHypothesisId`/`hypothesisUpdateStatus` on
  `agentHypothesisSchema`), `src/lib/agents/tools.ts`
  (`getPreviousHypotheses`), `src/lib/agents/investigation-agent.ts`
  (system-prompt update, display name/pluralization/registry wiring for the
  new tool), `src/lib/agents/validate-agent-output.ts` (OBSERVED
  classification, `update` assembly, `previousHypothesesById` registry),
  `src/app/cases/[caseId]/investigation/{hypothesis-card,
  investigation-panel,investigation-workspace,page}.tsx` (update badge,
  Record-result placement, timeline wiring).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - `getPreviousHypotheses` as a new 7th tool rather than folding hypotheses
    into `getPreviousInvestigations`'s return shape — keeps each tool
    single-purpose (matching MVP-10B's own stated design) and keeps
    `PreviousInvestigationSummary`'s existing contract/description
    (investigation *events*) honest rather than silently widening it.
    `MAX_AGENT_STEPS` (9) was deliberately left unchanged, per this
    session's explicit "do not optimize MVP-10B latency yet" — the model
    simply spends one of its existing 9 steps on this tool when relevant,
    same budget as before.
  - `previousHypothesisId`/`hypothesisUpdateStatus` are required-but-
    nullable on the model output schema (not `.optional()`), matching
    `clarificationQuestion`'s existing convention exactly, so "the model
    must explicitly decide, never silently omit" stays consistent across
    the whole agent output contract.
  - `getInvestigationTimeline` takes an explicit `SupabaseClient` parameter
    rather than building its own via the cookie-based
    `@/lib/supabase/server` convention `cases/queries.ts` uses — the same
    testability tradeoff MVP-10A made for `listEngineeringDocuments`, for
    the same reason (a ticket-mandated behavior needed a real integration
    test, not just a browser walkthrough).
  - The "Record result" action lives once, panel-level, below all
    hypotheses rather than duplicated per-hypothesis — an observation isn't
    naturally scoped to one specific hypothesis in the data model
    (`investigation_events` has no hypothesis foreign key), and one clear
    action reads more like real engineering software than N identical
    buttons.
- Remaining: the timeline's one-refresh-behind lag after a live run
  (documented above) is the only known gap; no blockers for the next
  ticket.
- Next recommended ticket: engineering change + second measurement /
  before-after comparison (features.json's pre-existing MVP-11) — explicitly
  **not** started this session per direct instruction. STOPPING here.
- Commit: (see git log)
