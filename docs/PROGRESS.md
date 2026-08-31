# Claude Progress

## Current state
MVP-01 through MVP-07 done. Auth, workspace isolation, the full core domain
schema, product/revision/fact entry, failure-case + measurement entry, the
deterministic harmonic correlation engine, and the AI structured hypothesis
service all work, tested, against a local Supabase instance
(`supabase start`). MVP-07's service is not yet wired into a UI/route —
that's MVP-08 (streaming) and MVP-09 (workspace UI).

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
