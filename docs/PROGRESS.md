# Claude Progress

## Current state
MVP-01 through MVP-04 done. Auth, workspace isolation, the full core domain
schema, and product/revision/fact entry (clocks, radios, power, cables) work
end-to-end against a local Supabase instance (`supabase start`).

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
