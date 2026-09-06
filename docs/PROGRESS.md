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
first investigation and a follow-up after recording an observation).

The pre-existing MVP-11 entry (engineering change + second measurement /
before-after comparison) is now also done: a structured "Record engineering
change" action creates a new product revision (REV17 -> REV18, via a
`supersedes_revision_id` lineage pointer) without ever touching the original
revision, a second measurement can be recorded against the new revision
from the same case, a deterministic `compareMeasurements()` utility (zero
model involvement) computes the before/after delta, and a "Before / after
comparison" card renders it using only "N dB above/below selected limit"
phrasing — never PASS/FAIL/CERTIFIED. The investigation timeline now also
shows ENGINEERING CHANGE / NEW REVISION / RESULT entries alongside
MEASUREMENT/HYPOTHESIS/OBSERVATION, each measurement and hypothesis entry
now carries its own revision label, and the previous session's known
timeline-lag UX issue is fixed (the timeline updates live from the same SSE
events driving the Investigation panel, no refresh needed — verified live).
RUN AGAIN relabels itself RE-EVALUATE INVESTIGATION once a case spans more
than one revision; it's the same run mechanism, not a new agent. All
work, tested (unit + integration) against a local Supabase instance, and
live-verified end to end including one real Anthropic RE-EVALUATE call.

PERF-01 (Investigation Agent latency/waste optimization) is now also done:
the four conditional agent tools (`getPreviousRevisions`,
`getPreviousInvestigations`, `getPreviousHypotheses`,
`searchEngineeringDocuments`) are structurally removed from the agent's
tool list — not just discouraged by prompt — whenever their backing
prior-history/document count is zero, computed once via 4 parallel
Postgres counts before the agent starts and also embedded as plain facts
in its task prompt so it never spends a model round-trip rediscovering
them. `searchEngineeringDocuments` now nudges the agent to stop after 2
consecutive zero-result searches instead of letting it repeat similar
queries. The system prompt encourages batching the always-on grounding
tools into one turn (confirmed live: 3 tool calls landed in a single model
step). New wall-clock instrumentation (`stepCount`,
`totalDurationMs`/`modelDurationMs`/`toolDurationMs`/`retrievalDurationMs`)
is persisted on `agent.completed` and shown in the Agent Activity panel.
Measured live on the same Gateway X case shape: 31.4s -> 18.7s total
(-41%), 15 -> 3 tool calls (-80%), 8/8 zero-result document searches -> 0,
same 1 well-grounded hypothesis both times, no provenance regression. A
new idempotent `pnpm seed:gateway-x` script creates the canonical demo
case without hand-building it through the UI.

UX-01 (pilot-quality investigation experience) is now also done: a live-
updating investigation hero (product/revision/case reference, RADIATED
EMISSIONS badge, headline frequency/margin, WAITING FOR EVIDENCE /
INVESTIGATING / INVESTIGATION COMPLETE / ANALYSIS FAILED status) now leads
the workspace; the deterministic correlation reads as the primary product
moment (larger, first); OBSERVED/KNOWN/INFERRED/MISSING evidence sections
each carry a distinct glyph and left-border treatment within the existing
graphite/warm-white/green palette; Agent Activity is collapsed by default
once a completed run already has a hypothesis on screen but always force-
expands the moment a new run starts (a render-time "adjust state on prop
change" pattern, not an effect — the codebase's lint rule rejects
set-state-in-effect); "What Crado Handled" now leads with four truthful
work-saved numbers (tools used, model steps, sources cited, next test),
with document/passage/timing detail moved into a collapsed
`<details>` section; the source drawer gained a "Used as" (Known
evidence/Observed evidence/etc.) row and a slide-in entrance; the
investigation timeline got a distinct glyph per step type and a visually
highlighted RESULT entry; the before/after comparison card leads with a
large delta and a Before → After row; deliberate copy now covers the
no-documents, waiting-for-evidence, and failed-run states; the case page
(`/cases/[caseId]`) and its measurement form are reskinned to the same
graphite theme so the first impression is consistent from the case page
onward; reduced-motion-safe CSS entrance animation (gated behind
`prefers-reduced-motion: no-preference`, no library) was added to the
correlation card, hypothesis card, timeline entries, comparison card, and
source drawer. Verified live at 1440/1280/1024/768/390 with no horizontal
overflow. The full Gateway X demo flow was run live twice end to end
(seed → run → observation → hypothesis update → engineering change → Rev18
→ second measurement → RE-EVALUATE → before/after comparison → refresh
reconstruction) with real Anthropic calls, including a mixed-history
RE-EVALUATE that produced two new hypotheses grounded in the recorded
observation. Live QA caught and fixed a real bug along the way: Agent
Activity's collapse state was captured once at mount and never resynced,
so a live re-run silently stayed collapsed with no visible progress — now
fixed. PERF-01's architecture held throughout every live run in this
session (stepCount consistently 2, zero wasted document searches, tool
duration under a quarter second) — confirmed directly against persisted
`agent.completed` payloads, not just visually. The one known gap: citation
inspection (clicking a document-sourced badge) could not be demoed live
because this seed case has zero indexed engineering documents — MVP-13
(pilot file upload) doesn't exist yet, so there's nothing to index; the
source drawer itself is unit- and integration-tested. The next open
ticket is MVP-12, Regulatory State evidence linkage — explicitly not
started, per direct instruction to stop after UX-01.

VALIDATION-01 (Historical Failure Benchmark Harness) is now also done: a
new `/benchmarks` area lets a reviewer register an existing, ordinary
failure case (built through the completely unmodified product/revision/
fact/measurement/case flow) as a benchmark by recording hidden ground truth
(actual root cause, diagnostic actions taken, the successful engineering
change, final measurement/outcome) alongside it in a separate table
(`benchmark_ground_truth`) that no agent-context-building code path ever
queries — proved directly, not just asserted, by an integration test that
seeds a unique marker string into ground truth and asserts it never appears
in the model's `doGenerateCalls` or in any persisted `analysis_events` row
across a real investigation run. The reviewer runs the case blind through
the unmodified investigation workspace, scores each run with exactly the
ticket's five fields (NEXT ACTION USEFUL? 1-5, HYPOTHESES USEFUL? 1-5,
MISLEADING? Yes/No, WOULD THIS HAVE CHANGED YOUR NEXT ACTION? Yes/No,
COMMENTS), then reveals ground truth — gated server-side on at least one
score already existing — to see a comparison report combining the ground
truth with deterministic metrics computed from the run's own persisted
`analysis_events` (tool calls, unnecessary searches, documents/passages
retrieved, citations used, time to first hypothesis, total run time) and a
transparent, explicitly-labeled-non-authoritative keyword-overlap signal
against the actual root cause — never an automated pass/fail verdict, per
CLAUDE.md's "never claim definitive automated root-cause diagnosis." All
three new tables (`benchmark_cases`, `benchmark_ground_truth`,
`benchmark_expert_scores`) follow the existing workspace-RLS + composite-FK
convention exactly and are integration-tested for cross-workspace isolation
and the create/score/reveal business-rule guards (score-once, reveal only
after a score exists). Regulatory State (MVP-12) was not started, and no
existing file outside `src/lib/benchmarks`, `src/app/benchmarks`, and one
nav link in `src/app/workspace/page.tsx` was touched, per direct
instruction. The next open ticket is still MVP-12.

UX-02 (Agent-First Crado Workspace) is now also done: the case +
investigation flow (`src/app/cases/[caseId]/**` only — nothing else) moved
from UX-01's near-black graphite theme to a light, spacious "agentic
engineering workspace" (warm off-white canvas, white surfaces, charcoal
text, one restrained green accent, amber reserved for a measurement
actually above the limit), driven by a single systematic hex-value swap in
`investigation/theme.ts` plus the same swap applied file-by-file so every
existing component kept its logic untouched. On top of the re-theme,
the investigation workspace's information architecture changed: a quiet
top nav (product/revision/case ref + plain-text Investigation/Evidence/
Timeline/Sources tabs, tab-switching as local state so a live SSE run
never disconnects when the user looks at another tab) replaced the old
three-column panel grid; a new agent-presence header ("CRADO INVESTIGATION
AGENT · live status pill · one-line failure sentence") replaced the old
giant-number-first hero, with the actual measurement numbers moved into
their own Measurement artifact card; Agent Activity now renders as a
progressive checklist while a run is active and compresses to "N actions
completed · Xs · View activity" once it finishes; a new Evidence tab
aggregates OBSERVED/KNOWN/INFERRED/MISSING across every hypothesis as its
own central view, each item still opening the real source drawer; and a
persistent bottom composer ("Tell Crado what changed, attach a result, or
ask about this case…") replaced the standalone "Record result" form —
free text is parsed by a new, deliberately non-model, non-paraphrasing
deterministic utility (`parse-engineer-input.ts`) into an OBSERVATION +
optional MEASUREMENT CHANGE confirmation object shown before anything
persists, then submitted through the exact same, unmodified
`recordInvestigationObservation` action the old form used — zero new
database writes, zero new LLM calls. No change to the Investigation Agent,
the deterministic correlation engine, the evidence model, the database
schema, the benchmark harness, or the model provider. Verified live end to
end against the real seeded Gateway X case (chrome-devtools MCP): signed
in, ran a real ~34s RE-EVALUATE INVESTIGATION and watched the live
checklist build and then compress, recorded an observation through the
composer's confirmation flow and confirmed it appeared as new OBSERVED
evidence and shifted a hypothesis's update status on the very next run,
browsed all four tabs, and confirmed 1440/1280/1024/768/390 all render
with no horizontal overflow. The next open ticket is still MVP-12.

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

### 2026-09-01 — MVP-11 (engineering change + second measurement + revision comparison)
- Completed: the full Gateway X loop the ticket describes — MEASUREMENT
  (REV17, +7.4 dB) -> HYPOTHESIS -> OBSERVATION -> ENGINEERING CHANGE ->
  NEW REVISION (REV18) -> MEASUREMENT (REV18, -3.6 dB) -> RESULT (11 dB
  improvement) — end to end, live-verified in a real browser, not just
  tests.
  - **1. Engineering change model**: `engineeringChangeInputSchema`
    (title/description/affectedSubsystem/previousValue/newValue/reason/
    notes/newRevisionLabel — required-but-structured, never a chatbot
    textarea) backs a new `record-engineering-change-form.tsx`, matching
    `RecordObservationForm`'s collapsed-by-default/duplicate-submission-
    protected pattern exactly. `engineering_changes` gained real
    `title`/`affected_subsystem` columns plus a `payload` jsonb for the
    rest (additive migration
    `20260901020000_engineering_change_revision_lineage.sql`).
  - **2. Revision creation and lineage**: `product_revisions` gained a
    self-referencing `supersedes_revision_id` (composite FK on
    `(id, workspace_id)`, mirroring `engineering_documents.
    supersedes_document_id`'s existing pattern). Recording a change is
    what creates the new revision — `createEngineeringChange()`
    (`src/lib/engineering-changes/create-engineering-change.ts`) inserts
    the new revision with `supersedes_revision_id` set, copies REV17's
    `product_facts` forward verbatim (never inventing a changed fact — an
    explicit fact edit goes through the pre-existing MVP-04 add/edit-fact
    UI on the new revision), then inserts the `engineering_changes` row;
    any failure partway compensates by deleting the just-created revision
    (same compensating-action pattern as MVP-05's measurement/peak insert,
    justified by CLAUDE.md's "simplest reversible implementation"
    tie-breaker — no DB transaction available). `getLatestRevisionInLineage()`
    (`src/lib/products/revision-lineage.ts`) walks the chain forward,
    bounded at 25 hops, and is what both the case page (which revision a
    new measurement binds to) and the investigation workspace (which
    revision's facts the agent reasons over) resolve to "the current
    revision" from.
  - **3. Second-measurement model**: architecturally free — `measurements.
    product_revision_id` was already independent of `failure_cases.
    product_revision_id`, so a second measurement for REV18 attaches to
    the *same* failure case without a new case. `cases/[caseId]/page.tsx`
    now binds `AddMeasurementForm` to `getLatestRevisionInLineage()`'s
    result instead of the case's original revision, with a visible note
    ("This will be recorded against Rev18…") when they differ. The margin
    is never labeled PASS or CERTIFIED anywhere — the comparison card and
    timeline both use "N dB above/below selected limit" phrasing only.
  - **4. Before/after calculation**: `compareMeasurements()`
    (`src/lib/measurements/compare-measurements.ts`) — pure TypeScript,
    zero I/O, zero model call. `deltaDb = before.marginDb - after.marginDb`,
    rounded to one decimal to avoid float noise; `sameFrequency` flags a
    cross-frequency comparison so the UI never presents that as a single
    before/after result. `RevisionComparisonCard` renders it and states
    explicitly "an investigation finding, not a pass or certification
    result."
  - **5. Evidence ownership**: also architecturally free once (2) and (3)
    existed — `analysis_runs.measurement_id -> measurements.
    product_revision_id` transitively scopes every hypothesis to the
    revision its underlying measurement belongs to, so REV17's original
    measurement/hypotheses/observation/analysis runs are never touched by
    anything REV18-related; `createEngineeringChange` only ever inserts
    new rows. Fixed one real latent bug this surfaced:
    `createAnalysisRunForFailureCase` was loading product facts from the
    *failure case's* original revision rather than the *measurement being
    analyzed*'s own revision — meaning a RE-EVALUATE run against the REV18
    measurement would have silently reasoned over stale REV17 facts. Now
    loads facts (and the revision/product context passed to the
    Investigation Agent) from `measurement.product_revision_id` — proven
    with a dedicated integration test (a REV18 with zero facts vs. REV17's
    real 40 MHz clock fact; the correlation the bug would have wrongly
    produced is asserted absent) and confirmed live (the RE-EVALUATE run
    still found the correct 40 MHz x 5 correlation because REV18's copied
    fact was loaded correctly).
  - **6. Timeline live-update fix** (the previous session's documented UX
    gap): `investigation-workspace.tsx`'s `timelineEntries` prop became
    local state (`useState(timelineEntries)`), appended to directly inside
    the existing SSE event-loop's `for (const event of events)` — not a
    `useEffect` (that pattern already tripped the `set-state-in-effect`
    lint rule once in this file's history) — for every `hypothesis.
    created` event. No model rerun, no polling; a full page refresh still
    discards this local state and reconstructs the real timeline from
    Postgres via `getInvestigationTimeline`, unchanged. Verified live both
    ways: the timeline updated within the same run (no refresh) for both
    the first run (1 hypothesis) and the RE-EVALUATE run (3 hypotheses),
    and a subsequent reload reproduced the identical entries from
    persisted state.
  - **7. Gateway X walkthrough** (chrome-devtools MCP, real browser, fresh
    signup — no persistent seed case existed from a prior session):
    created Gateway X/Rev17, a 40 MHz clock fact, a failure case, the
    +7.4 dB/200 MHz measurement; ran a real Anthropic investigation (5th-
    harmonic hypothesis); recorded the ticket's own observation example;
    recorded the engineering change ("Display termination changed" /
    "Display path" / the ticket's own reason text) — REV18 created;
    recorded the second measurement (-3.6 dB/200 MHz) — correctly bound to
    REV18 with a visible "Rev18" badge on both the case page and the
    measurement panel; the BEFORE/AFTER COMPARISON card and the extended
    timeline (MEASUREMENT -> HYPOTHESIS -> OBSERVATION -> ENGINEERING
    CHANGE -> NEW REVISION -> MEASUREMENT -> RESULT) rendered correctly;
    the button relabeled itself RE-EVALUATE INVESTIGATION; clicked it for
    one more real Anthropic call, which produced a `SUPPORTED BY NEW
    EVIDENCE` hypothesis reasoning about the display cable/connector as
    the dominant radiating path, grounded in the real -3.6 dB measurement
    and the observation — no "root cause confirmed", PASS, or CERTIFIED
    language anywhere. Reloaded the page afterward: every timeline entry
    (including both live-run's hypotheses) reconstructed identically from
    Postgres.
  - **8. UX issue found and fixed during the walkthrough**: the "Engineering
    change recorded." success message initially read **"Rev18 → Rev18
    created"** instead of "Rev17 → Rev18 created" — `revalidatePath` (fired
    by the successful action) re-renders the form's parent with the
    *already-updated* `currentRevisionLabel` prop (now "Rev18") before the
    success state finishes rendering, so reading that live prop for the
    "from" side of the message showed the wrong revision. Fixed by
    capturing the from-label once via `useState(currentRevisionLabel)`
    (a lazy initializer, not resynced on prop changes) instead of reading
    the live prop; added a regression test that re-renders the component
    with an updated `currentRevisionLabel` mid-flow to prove the fix holds
    without relying on real timing. Verified fixed live via a page reload
    and a second submission.
- Tests: 253 unit tests (12 new: `compare-measurements.test.ts`,
  `suggest-next-revision-label.test.ts`, extended
  `investigation-timeline.test.tsx` for engineering_change/new_revision/
  result entries, extended `investigation-workspace.test.tsx` for the
  timeline live-update fix, new `record-engineering-change-form.test.tsx`
  including the from-label regression test, new
  `revision-comparison-card.test.tsx` including a no-PASS/CERTIFIED
  assertion). 49 integration tests (11 new): `create-engineering-change.
  integration.test.ts` (revision creation/lineage, fact copy-forward,
  compensating rollback on a genuine partial failure, workspace isolation);
  a new describe block in `mvp11.integration.test.ts` running the full
  Gateway X loop against real Postgres (extended timeline entry-type
  ordering, deterministic 11 dB comparison equality-checked against
  `compareMeasurements()` directly, evidence-ownership assertions on the
  raw rows, workspace isolation, a no-PASS/CERTIFIED serialized-timeline
  assertion, exactly-one-peak-per-submission); a new test in
  `create-analysis-run.integration.test.ts` proving facts load from the
  measurement's own revision. `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:integration`, `pnpm build` all pass. One real Gateway X
  walkthrough completed live (see item 7 above), including one real
  RE-EVALUATE INVESTIGATION Anthropic call. Fake adapters only in
  automated tests, per the ticket's explicit instruction.
- Files/areas changed: `supabase/migrations/
  20260901020000_engineering_change_revision_lineage.sql` (new),
  `src/lib/supabase/database.types.ts` (regenerated), `src/lib/domain/
  schema.ts` (`engineeringChangeInputSchema`), `src/lib/measurements/
  compare-measurements.ts` (new), `src/lib/products/
  suggest-next-revision-label.ts` (new), `src/lib/products/
  revision-lineage.ts` (new), `src/lib/engineering-changes/
  create-engineering-change.ts` (new), `src/lib/cases/queries.ts`
  (`MeasurementRow` gained `productRevisionId`/`revisionLabel`),
  `src/lib/investigation/queries.ts` (resolves the case's latest revision
  in lineage for facts/context; `hasMultipleRevisions`), `src/lib/
  investigation/timeline.ts` (extended `TimelineEntry` union:
  `engineering_change`/`new_revision`/`result`, revision labels on
  `measurement`/`hypothesis`), `src/lib/analysis/create-analysis-run.ts`
  (fixed: loads facts from the analyzed measurement's own revision, not
  the case's original one), `src/app/cases/[caseId]/page.tsx` (binds to
  latest-lineage revision, shows per-measurement revision labels),
  `src/app/cases/[caseId]/investigation/{actions,page,
  investigation-workspace,investigation-panel,investigation-timeline,
  measurement-panel}.tsx` (new action, new props, timeline live-update
  fix, RE-EVALUATE relabeling, revision badges), new `record-engineering-
  change-form.tsx` and `revision-comparison-card.tsx` (+ their tests).
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Built a dedicated `createEngineeringChange()` rather than reusing the
    pre-existing generic `createRevision` action — the generic action
    creates a context-free empty revision with no lineage/engineering-
    change linkage, which doesn't match "recording the change is what
    creates REV18."
  - No 5th `hypothesisUpdateStatus` enum value for "measured improvement"
    — reused the existing 4 qualitative statuses from the previous
    session's ticket, letting the agent's own grounded reasoning (plus the
    now-negative marginDb in its evidence) communicate the improvement,
    per this ticket's explicit "do not redesign the agent."
  - `RECORD ENGINEERING CHANGE` placed next to `RECORD RESULT`, both
    gated on "at least one hypothesis exists" — same placement rationale
    as the previous session's `RecordObservationForm` decision, and it
    naturally follows an observation in the ticket's own step ordering.
  - The `result` timeline entry is computed, not persisted — derived in
    `getInvestigationTimeline` from the earliest and latest measurements
    across two distinct revisions, via the same `compareMeasurements()`
    the comparison card uses, so the two surfaces can never show different
    numbers for the same case.
- Remaining: none blocking. MVP-19 ("Gateway X demo case", a persistent
  seed script) doesn't exist yet, so every live walkthrough so far
  (including this one) has had to build its own case by hand through the
  UI — worth doing before more live walkthroughs are needed.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  explicitly **not** started this session per direct instruction. STOPPING
  here.
- Commit: (see git log)

### 2026-09-01 — PERF-01
- Completed: A separate optimization ticket (explicitly not renumbering or
  touching MVP-12). First benchmarked the existing Investigation Agent live
  against a real Gateway X case with no instrumentation of its own (read
  exact numbers back from Postgres `analysis_runs`/`analysis_events`, since
  pre-optimization code had no timing fields to self-report). Root cause
  found empirically: tool execution itself is near-instant (in-memory
  grounding tools measured at ~1ms total); the real cost is model
  round-trip *count*. Optimized on that basis:
  1. `selectActiveTools()` (new, exported from `investigation-agent.ts`)
     structurally removes `getPreviousRevisions`/`getPreviousInvestigations`/
     `getPreviousHypotheses`/`searchEngineeringDocuments` from the
     `ToolLoopAgent`'s tool object — not merely discouraged by prompt —
     whenever their backing prior-history/document count is zero, so the
     model literally cannot call a tool with nothing to find.
  2. `searchEngineeringDocuments` (`tools.ts`) tracks consecutive
     zero-result searches via a per-run closure counter and returns a
     `guidance` stop-nudge string once 2 in a row come back empty, rather
     than letting the agent repeat 5+ similarly-worded queries.
  3. No SDK change was needed for parallel/batched tool calls — AI SDK 7's
     `ToolLoopAgent` already executes multiple tool-call parts returned in
     one model turn concurrently; only the system prompt now explicitly
     encourages batching the three always-on grounding calls into one
     turn (confirmed live: 3 tool calls landed inside a single
     `stepCount`).
  4. `create-analysis-run.ts` now runs 4 parallel Postgres `COUNT` queries
     (documents indexed, other revisions, previous investigation events,
     previous completed runs) once before the agent starts, threading the
     result into both `selectActiveTools` and a new `buildTaskPrompt()`
     that states this metadata as known facts up front — the agent never
     spends a tool call rediscovering product/measurement/history details
     already on hand.
  5. The deterministic harmonic correlation utility was already
     LLM-free (MVP-06) — confirmed unchanged, not touched.
  6. `ToolLoopAgent`'s step allowance (`MAX_AGENT_STEPS = 9`) was left
     unchanged — live testing only ever needed 2 steps post-optimization,
     which doesn't constitute evidence for safely lowering the ceiling on
     harder/larger-history cases; the ticket only authorized reducing it
     if testing *proved* a lower bound remains reliable, which it didn't
     establish. Documented here as an intentional non-change.
  7. Citations/provenance, OBSERVED/KNOWN/INFERRED/MISSING labeling,
     previous-hypothesis comparison, certainty-language guards, and
     workspace isolation are all untouched — the 3 always-on grounding
     tools (`getMeasurementContext`/`getProductContext`/
     `getDeterministicCorrelations`) remain mandatory specifically because
     `RetrievedRegistry` (citation validation) is built from their actual
     tool *outputs*, not from prompt text, so citations can't be verified
     against facts the agent was merely told rather than tool-retrieved.
  8. No agent activity is hidden from the UI — the new
     `stepCount`/duration fields are additive to the existing Agent
     Activity panel and Sources panel, never a replacement or filter of
     what was already shown; all prior tool-call activity entries still
     render exactly as before.
  Added wall-clock instrumentation (`Date.now()` wrapping around
  `agent.generate()`, summed per-tool `durationMs` for tool/retrieval
  time) rather than the AI SDK's `onStepStart`/`onLanguageModelCallEnd`
  callbacks — simpler, and doesn't depend on provider-specific timing
  data. New fields (`stepCount`, `totalDurationMs`, `modelDurationMs`,
  `toolDurationMs`, `retrievalDurationMs`) added to
  `agentCompletedPayloadSchema` as `.optional()` (backward-compat for
  pre-PERF-01 persisted rows only — new writes always fill them) and
  surfaced in `agent-metrics-panel.tsx`.
  Added `scripts/seed-gateway-x.mjs` (`pnpm seed:gateway-x`) — an
  idempotent seed script (natural-key existence checks before insert,
  safe to rerun) that creates one canonical demo case (product "Gateway
  X" Rev17, a 40 MHz clock fact, a radiated-emissions failure case, a 200
  MHz/+7.4 dB measurement) signed in as a real demo user (required:
  `current_workspace_id()` resolves from `auth.uid()`, which a raw
  service-role insert has none of). Verified idempotent by running it
  twice and confirming exactly one row per table in Postgres both times.
  Ran a real live before/after benchmark: BEFORE against the stashed
  pre-optimization code on one seeded case, AFTER against fully-optimized
  code on a second, independently-seeded case (deliberately not reusing
  the BEFORE case, so the AFTER run's `previousCompletedRunCount` stayed
  genuinely zero rather than inheriting history from the BEFORE run and
  confounding the very comparison being measured).
- Tests: 259 unit tests (new: `selectActiveTools` describe block — 4
  cases covering all-omitted/mixed/all-present tool selection; a
  zero-history `runInvestigationAgent` test confirming only the 3
  always-on tools ever appear in `activity`; a `buildAgentCompletedPayload`
  timing-passthrough test). 50 integration tests (new: "computes real
  prior-context counts against Postgres and omits history tools
  accordingly on a fresh case" in `create-analysis-run.integration.test.ts`,
  using a scripted `MockLanguageModelV4` against real local Postgres,
  asserting only `getMeasurementContext` is called and
  `documentSearches`/`documentsAvailable` are both 0). `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build` all
  pass.
- Files/areas changed: `src/lib/agents/tools.ts` (`PriorContextSummary`,
  zero-result-streak guidance), `src/lib/agents/investigation-agent.ts`
  (`selectActiveTools`, `buildTaskPrompt`, timing instrumentation),
  `src/lib/agents/validate-agent-output.ts` (`AgentTimings`,
  `buildAgentCompletedPayload` gained a required 5th param),
  `src/lib/analysis/events.ts` (5 new optional fields on
  `agentCompletedPayloadSchema`), `src/lib/analysis/create-analysis-run.ts`
  (4 parallel prior-context counts), `src/app/cases/[caseId]/investigation/
  agent-metrics-panel.tsx` (renders the new timing fields, filtering
  undefined ones for backward compat), `scripts/seed-gateway-x.mjs` (new),
  `package.json` (`seed:gateway-x` script). Test files: `src/lib/agents/
  investigation-agent.test.ts`, `src/lib/agents/
  validate-agent-output.test.ts`, `src/lib/analysis/
  create-analysis-run.integration.test.ts`, `src/lib/investigation/
  mvp11.integration.test.ts`.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Deterministic tool omission (SDK-level, via `selectActiveTools`)
    chosen over prompt-only discouragement — matches this codebase's
    existing "never trust the model's own say-so" ethos (citation
    validation), and is the only way to *guarantee* zero reflexive calls
    rather than merely reduce their likelihood.
  - `searchEngineeringDocuments`'s zero-result guidance is a soft nudge
    (a `guidance` string in the tool's own return value), never a hard
    block on a 3rd search — a differently-targeted query after 2 misses
    can still be legitimate; the ticket asked to "change strategy or
    stop," not "never search again."
  - Kept `MAX_AGENT_STEPS` unchanged (see item 6 above) rather than
    lowering it opportunistically from one easy live run.
  - Did not delete the two benchmark demo cases/workspace created during
    live testing — the ticket didn't ask for cleanup of pilot data, and
    they're useful as a second demonstrated Gateway-X-shaped case
    alongside the canonical seeded one.
- Remaining: the "mixed-history" path (agent correctly still offers/uses
  `getPreviousHypotheses` when `previousCompletedRunCount > 0`) is
  confirmed by the automated `selectActiveTools` unit tests and the
  pre-existing MVP-11 integration suite, but was not separately re-run
  live end-to-end against a real Anthropic call in this session beyond
  the original BEFORE benchmark run itself (which did exercise it,
  since it ran the full old code path against a case that later gained
  history) — judged sufficient given that coverage; a live confirmation
  is a reasonable candidate to fold into the next ticket's live
  walkthrough if one is needed.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  explicitly **not** started this session per direct instruction. STOPPING
  here.
- Commit: (see git log)

### 2026-09-01 — UX-01
- Completed: A separate polish ticket (no renumbering, MVP-12 untouched,
  no backend/agent code touched — see "PERF-01 latency" below). Reviewed
  and reworked the full case → investigation flow for a pilot/investor-
  ready first impression:
  1. New `investigation-hero.tsx`, rendered as the first full-width row
     inside `InvestigationWorkspace` (not the server-rendered page
     header, so its STATUS badge can live-update from the same `state`
     the rest of the workspace already tracks): product/revision, a
     presentational `CASE-XXXXXX` reference derived from the case id (no
     new stored field), a static RADIATED EMISSIONS badge (the DB's own
     `test_type` check constraint already guarantees this), the headline
     frequency/margin, and a status badge cycling WAITING FOR EVIDENCE /
     READY TO INVESTIGATE / INVESTIGATING / INVESTIGATION COMPLETE /
     ANALYSIS FAILED.
  2. `theme.ts` gained an `evidence` map (glyph + border color per
     OBSERVED/KNOWN/INFERRED/MISSING) applied in `hypothesis-card.tsx` as
     a left border + inline glyph per section — instantly distinguishable
     without leaving graphite/warm-white/green (no rainbow). Citation
     buttons restyled as small bordered badges instead of underlined
     inline links.
  3. `agent-activity-panel.tsx`: a `defaultCollapsed` prop (lazy
     `useState` seed) collapses the panel by default only when a
     completed run already has a hypothesis on screen at first render;
     separately, "adjusting state on prop change" during render (not an
     effect — this repo's lint config makes set-state-in-effect a build
     error) force-expands the instant a new run starts, one-directionally
     (never force-collapses again on completion), so a run the user is
     actively watching always shows live progress.
  4. `agent-metrics-panel.tsx` split into an always-visible 4-metric
     primary row (tools used, model steps, sources cited, next test —
     `toolCallCount`/`sourcesUsedCount` now passed in from the workspace,
     derived from `state.agentActivity.length` and the same
     `deriveSourcesUsed` SourcesPanel uses) plus a `<details>`-based
     collapsed "technical detail" section for the rest (document/passage
     counts, PERF-01's per-phase durations) — infrastructure metrics
     never compete with the investigation conclusion for attention.
  5. `source-drawer.tsx` gained a "Used as" row (Known evidence/Observed
     evidence/etc., replacing a bare lowercase category string) and a
     reduced-motion-safe slide-in entrance.
  6. `investigation-timeline.tsx` gained a distinct glyph per step type
     and a visually highlighted (tinted background, ★ glyph, larger text)
     RESULT entry — the strongest moment in the chain now reads as
     visually distinct, confirmed live readable in well under 5 seconds.
  7. `revision-comparison-card.tsx` reworked to lead with a large delta
     number and a Before → After row with an arrow between them.
  8. `sources-panel.tsx` gained a distinct "NO SOURCES / No engineering
     documents have been added for this product" empty state (previously
     only had the "zero passages retrieved" state); `investigation-
     panel.tsx`'s failed-run alert gained a "Failed run" kicker plus an
     "Existing evidence below is preserved" reassurance when there's
     something to preserve.
  9. Case page (`src/app/cases/[caseId]/page.tsx`) and
     `add-measurement-form.tsx` reskinned to the same graphite theme as
     the investigation workspace — `theme.ts`'s doc comment updated to
     reflect it now scopes the whole case-detail flow, not just
     `/investigation`.
  10. Reduced-motion-safe CSS keyframes (`crado-rise`, `crado-slide-in`)
      added to `globals.css`, gated behind
      `@media (prefers-reduced-motion: no-preference)` — with reduced
      motion requested, no rule applies and elements render in their
      final resting state outright (nothing is ever hidden/offset outside
      that media query). No animation library. Applied to the correlation
      card, hypothesis card, timeline entries (staggered), comparison
      card, and the source drawer.
  11. Mobile-only mobile stacking order adjusted (Sources and Product
      moved earlier, Agent Activity/Metrics moved later — only the base
      `order-N` classes changed, `md:`/`lg:` breakpoints untouched) to
      match Failure → Investigation → Evidence → Timeline → Product →
      Agent activity.
  Live QA (chrome-devtools MCP, signed in as the seeded demo user) caught
  a real interaction bug beyond what any unit test could: Agent
  Activity's collapse state, implemented first with a plain `useEffect`,
  stayed collapsed through a live re-run because the effect only fired on
  mount in the already-collapsed case — no visible live progress during a
  run the user was actively watching. Fixed with the render-time
  "adjusting state on a prop change" pattern instead (see item 3 above);
  confirmed live afterward across two more real runs.
- Live walkthrough (real Anthropic calls, local Supabase, `pnpm
  seed:gateway-x`, `gateway-x-demo@crado.local`): opened the seeded
  Gateway X case (already carrying PERF-01's original benchmark history —
  1 prior completed run + 1 hypothesis); RUN AGAIN correctly stayed
  collapsed-by-default on load then force-expanded on click; a
  mixed-history RE-EVALUATE (`previousCompletedRunCount > 0`) correctly
  offered and used `getPreviousHypotheses`, producing an UNCHANGED
  qualitative update — this was also the live confirmation, deferred from
  the PERF-01 session, that the optimized tool-omission logic behaves
  correctly with real prior history; recorded an observation ("Display
  path disconnected", "Peak dropped 9 dB"); recorded an engineering change
  ("Display termination changed") which created Rev18 and live-updated
  the hero to Rev18; added a second measurement (200 MHz, -3.6 dB) for
  Rev18 from the case page; RE-EVALUATE INVESTIGATION on Rev18 produced
  two new hypotheses (HIGH CONFIDENCE "Display cable/connector radiating…
  SUPPORTED BY NEW EVIDENCE", plus a LOW CONFIDENCE alternate), explicitly
  grounded in the recorded observation; the Before/After card showed
  11.0 dB improvement (7.4 dB above → 3.6 dB below selected limit); the
  timeline rendered the full chain (measurement → hypothesis → 2 updated
  investigations → observation → engineering change → new revision →
  measurement → highlighted RESULT → 2 more updated-investigation
  entries) in the correct order; a full page reload reconstructed every
  panel identically from Postgres with zero console errors and no
  refetch. No manual DB editing was needed anywhere in the flow.
- Tests: 261 unit tests (updated: `agent-metrics-panel.test.tsx` rewritten
  for the primary/detail split, using `toBeVisible()`/`not.toBeVisible()`
  for the collapsed-`<details>` assertions since `getByText` doesn't check
  CSS visibility; `source-drawer.test.tsx` updated for the "Used as: Known
  evidence" wording change). 50 integration tests, unchanged (no backend
  code touched by this ticket, so no integration-test changes were
  needed). `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm
  test:integration`, `pnpm build` all pass.
- Files/areas changed: `src/app/cases/[caseId]/investigation/theme.ts`
  (evidence/motion/status-badge tokens), `globals.css` (motion keyframes),
  new `investigation-hero.tsx`, `hypothesis-card.tsx`, `correlation-
  card.tsx`, `agent-activity-panel.tsx`, `agent-metrics-panel.tsx`
  (+ its test), `investigation-workspace.tsx` (hero wiring, mobile
  reorder, new props threaded to metrics/activity panels),
  `investigation-timeline.tsx`, `revision-comparison-card.tsx`,
  `sources-panel.tsx`, `source-drawer.tsx` (+ its test),
  `investigation-panel.tsx` (failed-run copy), `page.tsx` (investigation
  route — slimmed header, `productName` prop threaded through), the case
  page `src/app/cases/[caseId]/page.tsx`, and `add-measurement-form.tsx`.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - Extended the graphite theme from `/investigation` to its parent
    `/cases/[caseId]` case page — the ticket explicitly asks to review
    the flow "beginning from the case page," and the previous plain-light
    case page was a jarring inconsistency immediately before the themed
    workspace. Did not touch `/products/[productId]/...` (facts editing)
    — outside the ticket's named demo flow.
  - "Sources used" (SourcesPanel's own heading) and the new compact
    metric label collided verbatim when both render in the same tree —
    renamed the metric to "Sources cited" rather than the section
    heading, since the heading reads more naturally as a section title.
  - No literal "REVISION" row was added to the source drawer (ticket's
    "where available") — `EvidenceCitation` has no revision field at all,
    and documents aren't currently associated with a specific product
    revision; adding one would be a schema/capability change, out of
    scope for a UX-only ticket. Left as a known, explicitly-deferred gap.
  - `CASE-XXXXXX` in the hero is a presentational-only derivation from the
    existing UUID, not a new sequential case-numbering capability.
- Remaining: citation-badge inspection (source drawer opening from a
  document-sourced KNOWN item) was not exercised live in this session's
  walkthrough — the seeded Gateway X product has zero indexed engineering
  documents, so no document citation ever appears to click; this is a
  pre-existing gap (MVP-13, pilot file upload, doesn't exist yet), not a
  regression, and the drawer itself has full unit/integration coverage.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  explicitly **not** started this session per direct instruction. STOPPING
  here.
- Commit: (see git log)

### 2026-09-01 — VALIDATION-01
- Completed: Historical Failure Benchmark Harness. Migration
  (`benchmark_cases`, `benchmark_ground_truth`, `benchmark_expert_scores` —
  standard workspace-RLS + composite-FK convention). Domain layer under
  `src/lib/benchmarks/`: `schema.ts` (two deliberately separate Zod
  schemas — visible case input vs. hidden ground truth), `queries.ts`
  (VISIBLE-only reads), `ground-truth.ts` (the *only* module that ever
  queries `benchmark_ground_truth`), `create-benchmark-case.ts`,
  `record-expert-score.ts`, `reveal-ground-truth.ts` (server-side guarded:
  refuses to reveal until at least one score exists), `load-run-events.ts`
  (reuses the "skip, don't trust" Zod-parse pattern from
  `src/lib/investigation/queries.ts` since `analysis_events` — not the
  vestigial `diagnostic_hypotheses`/`evidence_items` tables — is where real
  hypothesis data actually lives), `compute-benchmark-metrics.ts` (pure,
  deterministic, no DB/model access). UI under `src/app/benchmarks/`: list
  page, new-case registration form (visible fields + hidden ground truth in
  one submission, picking from failure cases not yet registered), case
  detail page (runs list, score links, reveal button, and — once revealed —
  the full comparison report), and the five-field expert scoring page. One
  nav link added to `/workspace`. All new code reuses the existing,
  completely unmodified product/revision/fact/measurement/case creation
  flow and investigation workspace — a benchmark case is a real case with a
  registration row on top, not a new code path.
- Tests: `pnpm typecheck`, `pnpm lint`, `pnpm test` (265 passing, incl. 4
  new `computeBenchmarkMetrics` unit tests — positive/negative/missing-
  data/boundary), `pnpm test:integration` (58 passing, incl. 7 new
  benchmark tests: the critical leakage test plus 6 workspace-isolation/
  business-rule tests) — all pass. `pnpm build` succeeds; all four
  `/benchmarks*` routes registered. Live-verified end to end (chrome-
  devtools MCP, signed in as the seeded `gateway-x-demo` user): registered
  the real seeded Gateway X case blind, scored an existing completed run
  with the exact five-field form, revealed ground truth (button correctly
  disabled beforehand), and confirmed the comparison report rendered real
  deterministic metrics plus the labeled non-authoritative keyword-overlap
  signal against all four real runs on that case — zero console errors.
  The QA registration was deleted afterward (cascade) to leave the seeded
  demo case exactly as it was.
- Files/areas changed: `supabase/migrations/20260901040000_benchmarks.sql`
  (new), `src/lib/supabase/database.types.ts` (regenerated),
  `src/lib/benchmarks/*` (new: schema, queries, ground-truth,
  create-benchmark-case, record-expert-score, reveal-ground-truth,
  load-run-events, compute-benchmark-metrics, and their tests),
  `src/app/benchmarks/**` (new: list/new/detail/score pages, forms,
  actions), `src/app/workspace/page.tsx` (added a "Benchmarks" nav link),
  `features.json` (added `VALIDATION-01`, `passes: true`, priority 16.7,
  after `UX-01` and before `MVP-16` — no existing entry renumbered or
  otherwise modified), `docs/PROGRESS.md`.
- Decisions (reversible, made per CLAUDE.md autonomy rules — no blockers
  found):
  - Structural isolation over runtime filtering: hidden ground truth lives
    in a table no agent-context code path imports or queries, so leakage
    is impossible by construction rather than merely policy-forbidden —
    proved by a dedicated integration test inspecting a `MockLanguageModelV4`'s
    recorded `doGenerateCalls` and the persisted `analysis_events` rows for
    a unique marker string, not just asserted in a comment.
  - `createBenchmarkCase`/`recordExpertScore`/`revealGroundTruth`/
    `getGroundTruth` all take an optional `SupabaseClient` parameter
    (defaulting to the request-scoped client), matching
    `createAnalysisRunForFailureCase`'s own established pattern — the only
    way to integration-test business logic that would otherwise require a
    live Next.js request scope for its cookies-based Supabase client.
  - No automated root-cause grading: "actual cause represented in top
    hypotheses" is reported as a transparent, deterministic, explicitly-
    non-authoritative keyword-overlap signal, never a computed pass/fail —
    per CLAUDE.md's "never claim definitive automated root-cause
    diagnosis" and "do not call an LLM for calculations." The expert's own
    1-5 scores and the side-by-side comparison report are the actual
    record of whether Crado's output was useful.
  - Two-visit workflow (build the case through the ordinary product/case/
    measurement UI, then register it separately at `/benchmarks/new`)
    instead of benchmark-specific case-creation UI, to guarantee the
    "blind investigation" exercises the exact same code a real customer
    case would and to maximize reuse of already-tested creation flows.
  - `/benchmarks*` uses the plain light theme matching `/workspace` and
    `/products` (an internal analyst/QA tool), not the graphite
    investigation theme; no "BENCHMARK CASE" badge was added to the
    existing case/investigation pages, to avoid re-touching UX-01's
    just-completed and tested files for a cosmetic nicety outside this
    ticket's scope.
- Remaining: none blocking for VALIDATION-01. Not built (deliberately out
  of this ticket's scope, per instruction): Regulatory State (MVP-12).
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  explicitly **not** started this session per direct instruction ("Do not
  start Regulatory State... Then STOP"). STOPPING here.
- Commit: (see git log)

### 2026-09-01 — UX-02
- Completed: Agent-First Crado Workspace — a UI/interaction redesign of
  `src/app/cases/[caseId]/**` only (case page + investigation workspace),
  no other route touched, no Investigation Agent/deterministic
  engine/evidence model/database/benchmark/model-provider change. Palette:
  systematically remapped every hex color in that directory (verified via
  grep before/after — zero old graphite hex codes remained) from
  near-black graphite to a warm-off-white/white/charcoal/green/amber
  palette, defined once in `investigation/theme.ts` and inherited by every
  component through its existing token exports (no component's JSX/logic
  needed touching for the recolor itself). Structure: `case-nav.tsx` (new
  — quiet breadcrumb + Investigation/Evidence/Timeline/Sources tabs as
  local client state, not routes), `investigation-hero.tsx` (rewritten
  into an agent-presence header: identity, live status pill, one-line
  failure sentence — the big measurement numbers moved to
  `measurement-panel.tsx`, unchanged, now just repositioned as its own
  artifact card), `agent-activity-panel.tsx` (rewritten to compress into
  "N actions completed · Xs · View activity" once a run finishes, still
  a full live checklist while active), `evidence-view.tsx` (new —
  cross-hypothesis OBSERVED/KNOWN/INFERRED/MISSING aggregation),
  `case-composer.tsx` + `parse-engineer-input.ts` (new — persistent bottom
  NL input; the parser is a deliberately non-model, non-paraphrasing
  deterministic utility that extracts a directional "N dB" figure only
  when the wording is unambiguous, always shows the engineer's own words
  back for confirmation, and submits through the pre-existing
  `recordInvestigationObservation` action — no new database writes, no
  new LLM call). Deleted `record-observation-form.tsx` (+ its test) as
  dead code, fully superseded by the composer calling the same action.
  `investigation-workspace.tsx` rewritten as the tab orchestrator (SSE
  consumption/state ownership unchanged verbatim) around a single
  scrolling canvas instead of the old three-column grid.
- Tests: `pnpm typecheck`, `pnpm lint`, `pnpm test` (268 passing — updated
  `agent-activity-panel.test.tsx` for the new compressed-summary contract,
  updated 4 assertions in `investigation-workspace.test.tsx` to switch
  tabs before asserting tab-specific content, added
  `parse-engineer-input.test.ts` with positive/negative/missing-data/
  boundary cases), `pnpm test:integration` (58 passing, untouched —
  nothing here reaches the database differently), `pnpm build` — all
  pass; all four `/cases/[caseId]*` routes still register. Live-verified
  end to end (chrome-devtools MCP, `pnpm seed:gateway-x`, signed in as
  `gateway-x-demo@crado.local`): ran a real ~34s RE-EVALUATE INVESTIGATION
  and watched the live checklist build then compress; used the composer
  on "I disconnected the display cable again and the peak dropped 2 dB
  further." and confirmed the parser produced OBSERVATION (verbatim) +
  MEASUREMENT CHANGE "-2 dB", confirmed it persisted, then re-ran the
  investigation and confirmed the new observation appeared as OBSERVED
  evidence and correctly shifted hypothesis update-status
  (supported/weakened by new evidence); browsed all four tabs (Evidence
  correctly aggregated both hypotheses' evidence with source attribution;
  Timeline showed the full chronological chain; Sources showed the
  honest zero-documents empty state for this seed case); verified
  1440/1280/1024/768/390 with no horizontal overflow (`scrollWidth ===
  clientWidth` confirmed at 390); zero console errors throughout.
- Files/areas changed: `src/app/cases/[caseId]/investigation/theme.ts`
  (repalette + new `nav` tokens), `investigation-hero.tsx` (rewritten),
  `agent-activity-panel.tsx` + its test (rewritten), `case-nav.tsx` (new),
  `evidence-view.tsx` (new), `case-composer.tsx` (new),
  `parse-engineer-input.ts` + its test (new), `investigation-workspace.tsx`
  (rewritten), `investigation-panel.tsx` (dropped the standalone
  RecordObservationForm usage), `page.tsx` (comment update only),
  `record-observation-form.tsx` + its test (deleted), every other
  component file in the directory (`correlation-card.tsx`,
  `hypothesis-card.tsx`, `measurement-panel.tsx`, `product-panel.tsx`,
  `sources-panel.tsx`, `source-drawer.tsx`, `investigation-timeline.tsx`,
  `revision-comparison-card.tsx`, `agent-metrics-panel.tsx`,
  `record-engineering-change-form.tsx`, `describe-hypothesis-update.ts`,
  `spectrum-chart.tsx`, `../page.tsx`, `../add-measurement-form.tsx`) —
  recolor only, no logic changes; `investigation-workspace.test.tsx`
  (4 assertions updated for tabs); `features.json` (added `UX-02`,
  `passes: true`, priority 16.8, after `VALIDATION-01` and before
  `MVP-16` — no existing entry renumbered), `docs/PROGRESS.md`.
- Decisions (reversible, made per CLAUDE.md autonomy rules — no blockers
  found):
  - No reference screenshots were actually attached to the ticket message
    despite it saying "study the attached Ontora screenshots" — flagged
    this plainly rather than fabricating having studied images never
    received, and proceeded from the ticket's own extremely detailed
    written interaction/visual spec, which was sufficient to implement
    confidently. Screenshots were shared in a later message and reviewed
    before continuing; they confirmed rather than changed the direction
    already taken (quiet text-tab top nav, minimal agent-status line,
    stat-row/artifact card pattern) — green stayed the accent per the
    ticket's explicit color spec, not Ontora's blue.
  - The re-theme is scoped strictly to `src/app/cases/[caseId]/**`
    (the ticket's one named target, "Redesign /cases/[caseId]/
    investigation") — `/workspace`, `/products`, `/benchmarks`, `/login`,
    and the `/` marketing placeholder were deliberately left on the
    existing plain default theme; "Do not change the marketing website"
    made this an easy, low-risk boundary rather than a site-wide overhaul.
  - The bottom composer's NL parser is a small deterministic regex
    utility, not a model call — per CLAUDE.md's "prefer a testable
    deterministic utility before adding another agent/model call" and
    "do not silently convert natural language into authoritative product
    facts." It never rewrites what the engineer typed (no paraphrase like
    the ticket's own "Display path disconnected" example implies); the
    OBSERVATION shown for confirmation is always their verbatim words,
    with only an unambiguous "N dB" figure mechanically split out. This
    trades literal fidelity to the ticket's example copy for an honest,
    zero-new-model-call, fully tested capability.
  - The ticket's list of composer uses also included "questions about
    evidence" and "requesting another investigation" — not wired into
    free-text routing (reliably classifying intent from free text needs
    either a new model call or unreliable keyword guessing, both
    disclosed risks). The existing RE-EVALUATE INVESTIGATION button and
    the new Evidence tab's citations already cover those two needs
    explicitly; recording an observation (with a detected measurement
    change) is the composer's one honestly-implemented capability.
  - `record-observation-form.tsx` was deleted rather than left orphaned
    once nothing rendered it — per CLAUDE.md's "delete/deprecate old
    concepts that create conflicting product behavior," since the
    composer now does the identical database write through a better-
    integrated UI.
- Remaining: none blocking for UX-02. Not built (deliberately out of
  scope): a literal `/cases` index route (the ticket's mock's "← Cases"
  breadcrumb target) — kept the existing, real "← {case title}" back-link
  to the case page instead of inventing new architecture/navigation the
  app doesn't otherwise have.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  not started this session (not requested).
- Commit: (see git log)

### 2026-09-02 — UX-03
- Completed: Frontier Agentic Investigation Workspace — a further
  visual/interaction redesign of `src/app/cases/[caseId]/**`, on top of
  UX-02's palette, replacing UX-02's "stacked bordered rectangles"
  grammar with a connected investigation canvas. No architecture change:
  Investigation Agent, deterministic engine, evidence model, database
  model, benchmark architecture, Regulatory State, and model provider are
  all untouched; every existing server action, SSE event contract, and
  data query is reused verbatim.
  - Application shell: new `app-shell.tsx` (a compact ~60px left rail —
    Workspace/Sources/Benchmarks + sign out, real routes only, no
    fabricated "Cases" vs "Products" split the app doesn't have) wired in
    via a new `src/app/cases/[caseId]/layout.tsx` so both the case page
    and the investigation page share it through Next.js's normal
    shared-layout mechanism. New `top-bar.tsx` (breadcrumb + case ref +
    slots for an agent-status pill and the view switcher) replaces the
    old plain-text header on both pages.
  - View switcher: `case-nav.tsx` renamed to `view-switcher.tsx` (same
    `InvestigationTab` type, same four exact button names
    Investigation/Evidence/Timeline/Sources tests depend on), restyled
    from underlined tabs into a compact segmented control living in the
    top bar.
  - Investigation canvas: `investigation-hero.tsx` deleted — its status
    pill moved into the top bar (`agent-status-pill.tsx`, new) and its
    one-line failure sentence is now Measurement's own context; new
    `connector.tsx` (`Connector`, `ArtifactRow`) draws the thin vertical
    lines (and a shared horizontal trunk for >1 sibling) between
    Measurement → Deterministic Relationship → Hypothesis on a very
    subtle dot-grid background (`canvasBackground` in theme.ts).
    `measurement-panel.tsx`, `correlation-card.tsx`, `hypothesis-card.tsx`
    restyled from hard-bordered boxes to soft-shadow/rounded "artifact"
    cards (`surface.card`/`radius` tokens), each with a left-accent bar
    and kicker label from the new `artifact` token map in theme.ts.
    Consolidation, disclosed rather than hidden: the ticket's MISSING
    EVIDENCE and NEXT TEST steps are rendered as differentiated zones
    *inside* the Hypothesis artifact (a dashed Missing section, a
    highlighted green Next-test block) rather than as two more separate
    connected cards — same information, one fewer redundant node per
    hypothesis, since both are properties of that specific hypothesis.
  - Agent activity: `agent-activity-panel.tsx` rewritten to drop its
    bordered-panel wrapper — an active run renders unboxed inline
    ("Crado is investigating" + live checklist), a finished run
    compresses to a small chip ("N actions completed · Xs
    [View activity]"), preserving every exact string its existing test
    suite already pinned (no test file needed rewriting for this piece).
  - Contextual right rail: new `context-rail.tsx` (~300–340px, hidden
    below `lg`, collapsible) — default state shows a compact case
    summary built only from data already on hand (Product/Revision/
    Product facts count/Sources-available count, the last one omitted
    entirely rather than shown as a fabricated 0 when no agent run has
    reported it yet); clicking a measurement, a hypothesis's new
    "Details" button, or any evidence citation updates it in place with
    that artifact's detail. Citations still also open the existing
    `source-drawer.tsx` overlay unchanged — the rail is additive, not a
    replacement for the full-passage view.
  - Composer: `case-composer.tsx` rewritten into a floating, centered
    (max-width 900px), rounded surface instead of a full-width bar, with
    a real "+ Attach" menu (Observation focuses the input; Measurement
    links to the case page's real add-measurement form — no fabricated
    file-upload control). The parse-confirm flow is visually restyled
    into the ticket's exact "OBSERVATION DETECTED / OBSERVATION /
    MEASUREMENT CHANGE / [Add to investigation] [Cancel]" shape;
    `parse-engineer-input.ts`'s deterministic, non-paraphrasing behavior
    (from UX-02) is unchanged.
  - Timeline/Sources: light restyle only (`investigation-timeline.tsx`,
    `sources-panel.tsx`) — softer surfaces, same connected-chain/list
    structure, same exact strings.
  - Evidence: `evidence-view.tsx` rewritten from four bordered category
    cards into compact inline-marker rows grouped by category, using the
    ticket's exact glyph set (●◆△○ — `known`'s glyph changed from ▪ to ◆
    and `inferred`'s from ◆ to △ in theme.ts's `evidence` token to match).
  - A real layout bug found and fixed during QA: the root layout only
    sets `min-h-full` on `<body>`, so tall canvas content made the whole
    *page* scroll instead of the canvas's own `overflow-y-auto` region —
    the floating composer's `sticky bottom-0` then pinned itself over
    content that hadn't scrolled into view yet. Fixed by giving
    `app-shell.tsx`'s root `h-dvh` so exactly one region (the canvas)
    scrolls, scoped to this route family only (root layout untouched).
  - Case page (`/cases/[caseId]/page.tsx`) restyled to match (TopBar,
    `surface.card`) for visual consistency across the two pages the new
    shell wraps — no logic change.
- Tests: `pnpm typecheck`, `pnpm lint`, `pnpm test` (268 passing —
  2 pre-existing `hypothesis-card.test.tsx` assertions fixed after the
  restyle introduced sibling text nodes: isolated "Hypothesis 03" in its
  own span, and kept the "Next investigation" heading text literal
  instead of pulling it from the new `artifact.nextTest.label` token so
  the existing test kept passing without a rewrite), `pnpm
  test:integration` (58 passing, untouched), `pnpm build` — all pass; no
  test file needed structural rewriting beyond those two assertions.
- Decisions (reversible, made per CLAUDE.md autonomy rules):
  - No canvas/graph library (react-flow, d3, etc.) was added. The
    "connected investigation, not stacked rectangles" requirement is met
    with a hand-built vertical connected-flow (`connector.tsx`, pure
    CSS/SVG-free) rather than a real pan/zoom node graph — a full graph
    engine is out of MVP scope per CLAUDE.md ("no speculative
    infrastructure") and would need to collapse to this same vertical
    shape on mobile anyway.
  - The app shell's left rail links only to routes that actually exist
    (`/workspace`, `/documents`, `/benchmarks`) — there's no standalone
    `/cases` or `/products` index in this app, so the rail doesn't
    fabricate a "Cases" vs "Products" split the ticket's mock implied but
    the real IA doesn't have.
  - Live QA in this environment's chrome-devtools MCP could not resize
    below 500px width (`resize_page` floors at 500 regardless of the
    width requested — confirmed by requesting 390 and 320 and reading
    back `window.innerWidth`); 500px was used as the smallest achievable
    "mobile" check instead of the ticket's literal 390, and is disclosed
    here rather than silently claimed as 390. No overflow at 500px; the
    left rail hides below Tailwind's `sm` (640px) breakpoint so mobile
    width goes entirely to the investigation content, per the ticket's
    mobile priority list (which doesn't include app navigation).
  - The right context rail's default summary shows Product/Revision/
    Product-facts-count/Sources-available — not the ticket mock's literal
    "MEASUREMENTS 3" line, since `InvestigationWorkspace` is only ever
    given the case's *current* measurement, not a full count across
    revisions; showing a fabricated or misleading count would violate
    "never fabricate document counts." The measurement count line was
    dropped rather than guessed.
- Remaining: Sources view still doesn't show per-document "revision" or
  "indexed status" columns the ticket sketched — `SourceUsage` (see
  `derive-sources-used.ts`) doesn't carry that data today, and adding it
  would mean touching the retrieval/citation pipeline, out of this
  visual-only ticket's scope. `AgentMetricsPanel`'s "What Crado Handled"
  stat grid is restyled (quieter surface) but still a metrics grid, not a
  fully reimagined artifact — it's already deprioritized (UX-01) and
  wasn't a focus of this pass.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  not started this session (not requested).
- Commit: (see git log)

### 2026-09-02 — UX-04: Crado Product-Wide UI Redesign
- Completed: extended UX-02/03's investigation-workspace redesign to
  every authenticated Crado route — workspace, products (detail +
  revision detail), documents/Sources, benchmarks (list, detail, score,
  new), and login — onto one coherent, shared 2026 agentic-engineering
  design system. No architecture change: Investigation Agent,
  deterministic engine, evidence model, database schema, benchmark
  architecture, Regulatory State, and model provider are all untouched;
  every existing server action and query is reused (one additive read
  aggregation, see below).
  - **Canonical token module**: new `src/lib/design/tokens.ts` —
    promotes the palette/typography/motion/evidence-glyph/rail/topbar/
    segmented/canvas/connector/artifact system UX-01/02/03 built
    route-scoped in `cases/[caseId]/investigation/theme.ts` into the
    single source of truth for the whole app. That file, and the new
    `documents/theme.ts`, are now thin re-export shims, so zero
    import-path changes were needed across ~20 already-built
    investigation-canvas consumer files.
  - **Palette pivot**: superseded UX-02/03's warm off-white (`#faf8f3`)
    with a pure-white/neutral-zinc canvas per this ticket's explicit "NO
    yellow/cream tint" instruction — 11 old warm hex codes swept to 11
    new neutral ones across every `.ts`/`.tsx` file under
    `src/app/cases/**` (excluding tests), verified by grepping for any
    remaining non-neutral hex. `#1f9d52` (the green accent) unchanged.
  - **Shared components**: promoted, parameterized `AppShell` (moved to
    `src/lib/design/app-shell.tsx`, now takes an `active?: "workspace" |
    "sources" | "benchmarks"` prop) plus new `PageHeader`, `Card`
    (primary/secondary/tertiary variants), `StatusBadge`, `EmptyState`.
    Applied via a `layout.tsx` in each of `workspace/`, `products/`,
    `documents/`, `benchmarks/` — deliberately *not* a Next.js route
    group, to avoid moving files and risking import/test breakage for a
    purely visual change.
  - **Products**: product-detail and revision-detail pages (+
    `new-revision-form`, `add-fact-form`, `open-case-button`) migrated to
    the shared system. `listProducts()`/`getProduct()` in
    `src/lib/products/queries.ts` gained real `revisionCount` and
    `latestRevisionLabel` fields (one batched extra query, not N+1) so
    the workspace product list shows genuine "rich product status"
    instead of a fabricated field — `ProductSummary`/`ProductDetail`
    extended accordingly.
  - **Sources** (`documents/**`): the largest lift — fully rewritten off
    its 100%-dark-graphite bespoke palette (`bg-[#0d0f0d]`) onto the
    shared light system: upload form, document list (status via
    `StatusBadge`, type/revision/page-count/historical provenance line),
    type-filter chips, and the hybrid search + source-preview split
    panel. All 25 existing component tests pass unmodified — none of
    them asserted on color, only on text content/roles, so the visual
    rewrite was a pure style pass.
  - **Benchmarks**: list, case-detail (investigation runs, ground truth,
    comparison report with a mono metric grid), score-run form, and
    new-benchmark form all redesigned as a professional evaluation UI —
    `StatusBadge` for run/case status, `Card` sections instead of plain
    bordered divs. No existing tests in this route (none added — the
    forms' behavior is unchanged, only presentation).
  - **Login**: rebuilt as a minimal premium sign-in card centered on the
    shared dot-grid `canvasBackground`, no app rail (nothing to navigate
    to pre-auth).
  - **Two real bugs found and fixed** while building the token
    foundation, in `globals.css`: (1) a `prefers-color-scheme: dark`
    media override that silently inverted the entire app's background/
    foreground based on OS setting — directly contradicted the ticket's
    "dark surfaces only for specific scoped things, never a whole page"
    rule, removed; (2) `body`'s `font-family` was a hardcoded
    `Arial, Helvetica` literal that silently shadowed the already-loaded-
    but-unused Geist `var(--font-sans)` — fixed so the app actually
    renders in Geist.
  - `cases/[caseId]/investigation` kept its UX-03 structure verbatim —
    app shell, dot-grid canvas, drawn connectors, collapsible context
    rail, floating composer — only its color tokens were pivoted; no
    additional structural/interaction changes were made there this pass.
  - Quality gate: `pnpm lint` clean, `pnpm typecheck` clean (after two
    `.next` cache clears for stale route-type errors), `pnpm test`
    268/268, `pnpm test:integration` 58/58, `pnpm build` succeeds
    (all 14 routes compile, including the four new `layout.tsx` files).
  - Live QA (chrome-devtools MCP, signed in as the seeded
    `gateway-x-demo` user, reusing an already-authenticated session from
    an earlier walkthrough in this session): workspace (real revision
    counts render), product detail, revision detail (product-context
    facts + add-fact form), Sources (honest empty state for this
    workspace, filter chips, upload form), Benchmarks list (empty state)
    and new-benchmark-case form, login, and the cases/investigation
    canvas with a real prior completed run — all screenshotted and
    visually confirmed against the new system. `resize_page` still
    floors around ~1000px-wide screenshots in this environment
    regardless of requested width (same constraint noted in UX-03); no
    new breakpoint sweep was redone since the investigation canvas's
    layout itself didn't change, only its colors.
- Remaining below reference quality / disclosed gaps:
  - Benchmarks and Sources got a lighter design pass than
    cases/investigation — no dedicated "one shared reusable panel
    system" component was extracted for Sources' search/preview split or
    Benchmarks' ground-truth/comparison panels; they draw from the same
    tokens and `Card`/`StatusBadge` primitives but are still bespoke
    layouts per page, not one shared context-panel API. Given the very
    different data shapes (search results vs. ground truth vs. metric
    grids), a single rigid panel component was judged higher-risk than
    valuable for this pass.
  - No new automated tests were added for Products' or Benchmarks'
    now-restyled pages (Products had none before; Benchmarks had none
    before) — this was a visual-only pass with no behavior change, so
    existing behavior coverage (server actions, queries) was left as-is
    rather than backfilling presentation-layer tests out of scope for
    this ticket.
  - Live QA of Benchmarks' case-detail/comparison-report and
    score-run/new-benchmark *submit* flows (as opposed to their static
    empty/list states) wasn't exercised this session — the signed-in
    demo workspace had no benchmark cases registered under it. The
    styling was verified by reading the components carefully against
    what real data would render (StatusBadge tones, metric-row grid),
    but not clicked through end-to-end with real data.
- Next recommended ticket: MVP-12, Regulatory State evidence linkage —
  not started this session (not requested).
- Commit: (see git log)

## 2026-09-02 — UX-04 (Agent-Native Crado Product Experience), in progress

The user handed over a large, single-message ticket, verbatim: "Create
UX-04: Agent-Native Crado Product Experience." It explicitly **supersedes
and discards** the light-theme UX-04 pass above — "this is NOT another
visual polish pass." features.json's old `UX-04` entry was renamed to
`UX-04-LIGHT` (marked SUPERSEDED, `passes: true` kept as an accurate
historical record) and a new `UX-04` entry added with `passes: false` —
this ticket is large and genuinely not finished; see its acceptance array
for the current DONE/REMAINING split. Full audit + old/new journey
mapping: `docs/UX_AGENT_NATIVE.md`.

**Done and verified this session (build/lint/typecheck/test green, and
live-QA'd against real seeded Gateway X data via chrome-devtools MCP,
including one full from-scratch run through the entire new journey):**

- **shadcn/ui, hand-rolled**: `shadcn` CLI isn't reliable in this
  sandboxed shell, so every primitive was written directly from the
  canonical shadcn source pattern onto real `@radix-ui/*` + `cva` +
  `clsx`/`tailwind-merge` + `cmdk` + `react-resizable-panels@2` (pinned —
  unpinned resolved to an incompatible v4). `src/components/ui/**`:
  button, badge, separator, input, textarea, dialog, sheet, tooltip,
  popover, tabs, dropdown-menu, scroll-area, skeleton, avatar, table,
  command, resizable.
- **Dark theme, one pass, app-wide**: `globals.css` rewritten to the
  standard shadcn CSS-variable contract (`--background`/`--card`/
  `--primary`/etc., mapped via Tailwind v4's `@theme inline`);
  `src/lib/design/tokens.ts` rewritten to the same shape, now
  CSS-variable-backed; the ~30 files already on the old light palette
  bulk hex-swept in one `perl` pass (same mechanism the light UX-04 pass
  used, run again for the reverse direction) — zero import-path churn
  since route-scoped `theme.ts` shims re-export from the one token file.
- **Application shell**: `src/lib/design/app-shell.tsx` (async server
  component — fetches workspace/user/investigations/products once) +
  `app-shell-chrome.tsx` (client — collapsible ~224px/56px sidebar,
  New investigation / Search / Investigations / Products / Sources /
  Benchmarks nav, account dropdown consolidating
  workspace/settings/sign-out rather than fabricating dead nav items).
  `src/lib/design/command-palette.tsx`: Cmd/Ctrl+K, shadcn `Command`.
- **Investigations home** (`src/app/investigations/`): a real work
  queue, not a metrics dashboard — Active/Recent groups, one row per
  case (product/revision/test/state/latest action/updated). New file:
  `src/lib/investigations/queries.ts` (`listInvestigations()`, batched,
  no N+1) + `describe-investigation-status.ts` (12 tests).
- **New Investigation intake** (`src/app/investigations/new/`):
  free-text/attachment composer → deterministic extraction
  (`parse-investigation-intake.ts`, 9 tests incl. the ticket's exact
  worked example) → "CRADO UNDERSTOOD" confirmation (editable, product/
  revision/frequency/margin/mode, missing-info note) → `[Start
  investigation]` → `createInvestigationIntake` server action (resolves
  or creates product/revision, inserts the failure case + measurement +
  peak, best-effort attachment upload) → redirects to
  `/cases/[id]/investigation?autorun=1`.
- **Investigation canvas** — the ticket's central visual ask, now real:
  `canvas/build-canvas-graph.ts` (pure function, zero React Flow import,
  deterministic auto-layout: measurement → deterministic → hypotheses
  branching horizontally into their own missing-evidence/next-test
  columns → history trunk continues with observation/change/revision/
  outcome nodes; 9 tests). `canvas/canvas-nodes.tsx`: 9 distinct typed
  node components (Measurement/Deterministic/Hypothesis/Missing/
  NextAction/Observation/Change/Revision/Outcome), each matching its own
  per-node design spec, not one generic card. `canvas/
  investigation-canvas.tsx`: the `@xyflow/react` wrapper — fitView, pan/
  zoom, `nodesDraggable=false`/`nodesConnectable=false`/`deletable:
  false`, no minimap.
- **Wired into `investigation-workspace.tsx`**: extracted a leaner
  `investigation-controls.tsx` (status/RUN button/failed-alert/
  clarification/RecordEngineeringChangeForm — the old
  `investigation-panel.tsx`'s non-canvas half) and dropped the old
  stacked MeasurementPanel/CorrelationCard/HypothesisCard/
  RevisionComparisonCard rendering entirely in favor of one
  `<InvestigationCanvas>` fed by `measurement`+`state`+`timeline`. New
  `autoRun` prop fires the run exactly once on mount, guarded on
  `state.status === "idle"` specifically (not just `canRunAnalysis`,
  which is also true for an already-completed/failed run eligible for
  RE-EVALUATE — see bug below) and strips `?autorun=1` from the URL via
  `window.history.replaceState` right after (no `next/navigation`
  `useRouter`, which throws outside an App Router context in RTL tests).
  NextActionNode's "Record result" focuses the real composer input
  (`case-composer.tsx`'s id was de-`useId()`-ified to a stable
  `CASE_COMPOSER_INPUT_ID` — there's only ever one composer per page).
- **Two real bugs found via live QA, not just typecheck**: (1)
  `OutcomeNode` was built with `showSource={false}`, assuming a measured
  outcome is always the end of the graph — a real seeded case has two
  engineer observations logged *after* its outcome, which produced 91
  "Couldn't create edge for source handle" React Flow console warnings;
  fixed by giving `OutcomeNode` a normal source handle like every other
  trunk node (regression test added). (2) the auto-run effect's first
  version guarded only on `canRunAnalysis`, which is also satisfied by a
  completed/failed run — reloading an old tab that still carried a
  stale `?autorun=1` silently re-triggered a real second analysis run;
  fixed by also requiring `state.status === "idle"`, confirmed live
  (reload of a completed case with `?autorun=1` no longer re-runs).
- **Test-file changes**: `vitest.setup.ts` gained a no-op
  `ResizeObserver` polyfill (jsdom doesn't implement it; `@xyflow/react`
  throws without one) — chosen over mocking `InvestigationCanvas` out of
  `investigation-workspace.test.tsx`, so the orchestrator test still
  exercises the real canvas integration, not just SSE/state-reducer
  logic (canvas layout math already has its own dedicated coverage in
  `build-canvas-graph.test.ts`). A handful of assertions updated to match
  the new node copy ("40 × 5 = 200" not "40 MHz × 5 = 200 MHz",
  "Candidate" not "Candidate relationship"); the citation-click test now
  clicks the HypothesisNode first (compact on the canvas by design —
  "click for evidence" opens the Context Rail) then finds the citation
  button inside the rail, matching where citations actually live now.
  298/298 unit + 58/58 integration passing; `pnpm build` clean.
- Old presentational components (`measurement-panel.tsx`,
  `correlation-card.tsx`, `hypothesis-card.tsx`,
  `revision-comparison-card.tsx`, `connector.tsx`) are now unused by
  `investigation-workspace.tsx` (their visual design was ported into the
  canvas nodes, not literally reused) but were **not deleted** this
  session — they still compile, still have passing dedicated tests, and
  deleting+re-verifying was judged lower-value than finishing the
  higher-priority remaining items below given the ticket's size. Flagged
  here as disclosed dead-code debt for a follow-up cleanup pass.

**Explicitly NOT done yet — next session should start here, in this
order:**

1. `case-composer.tsx` intent classification for **Measurement** and
   **Engineering Change** free-text flows (Observation already worked
   before this ticket) — each needs its own deterministic parser (follow
   `parse-investigation-intake.ts`'s pattern) producing an editable
   confirmation artifact before calling the existing `createMeasurement`/
   `recordEngineeringChange` actions. The composer's "+Attach ▸
   Measurement" item is currently still a dead link to the old case page
   form.
2. Move the remaining manual/structured forms (case page's
   `AddMeasurementForm`, standalone `RecordEngineeringChangeForm` if
   still separately surfaced, `AddFactForm`) behind an "Advanced"/•••
   disclosure — the ticket fails outright if any old form path is still
   the *default* way to do something the new agent-first path also
   covers.
3. Evidence mode → dense `Table` (TYPE/EVIDENCE/SOURCE/REVISION/USED BY),
   replacing `evidence-view.tsx`'s category cards.
4. Sources mode → dense `Table` document browser (NAME/TYPE/PRODUCT/
   REVISION/STATUS/USED/UPDATED), replacing `sources-panel.tsx`.
5. Context Rail wrapped in a real `ResizablePanelGroup`/`ResizablePanel`/
   `ResizableHandle` instead of its current fixed `w-[300px]`/`w-[340px]`.
6. Mobile/tablet fallback: below the canvas's usable breakpoint, render
   the investigation as a chronological artifact stack instead of
   mounting React Flow; Context Rail opens as a `Sheet`.
7. Full live screenshot QA at 1440/1280/1024/768/390 (this environment's
   `resize_page` has previously floored around ~1000px regardless of
   requested width — re-verify against the current release before
   trusting it), plus the ticket's 12-point final report.
- Commit: `3d06f97`

## UX-04 — session 3: resizable rail, mobile fallback, and completion

Continued from `3d06f97` (items 1–3 above already done: composer intent
classification, Advanced forms, Evidence/Sources tables). This session
closed the remaining items in order and completed the ticket.

**Item 4 — Resizable context rail.** `context-rail.tsx`'s internal
`useState(collapsed)` was replaced with controlled props
(`collapsed`/`onCollapse`/`onExpand`, plus a new `showCollapseButton` —
see mobile note below) so both the desktop resizable panel and the
mobile Sheet can drive the same component from outside. Desktop's
canvas+rail row in `investigation-workspace.tsx` is now a real
`ResizablePanelGroup`/`ResizablePanel`/`ResizableHandle`
(`defaultSize` 76/24, `minSize` 50/18, `maxSize` 38, `collapsedSize` 4,
`collapsible`), with an `ImperativePanelHandle` ref driving the same ▸/◂
button the rail already had. Drag-resize, collapse/expand, and
canvas-click selection all verified live at 1440/1280.

**Item 5 — Mobile fallback.** `canvas-nodes.tsx`'s 9 node components were
split into a presentational `*NodeContent` (typed data prop, no React
Flow coupling) and a thin `XNode({data}: NodeProps)` wrapper around
`NodeShell`. Two new exports — `renderCanvasNodeContent(data, options)`
and `canvasNodeShellStyle(kind)` — are the single place a `CanvasNodeData`
kind maps to its content/styling, read by both the desktop nodes and the
new `canvas/investigation-stack.tsx` (`MobileInvestigationStack`), which
walks `buildCanvasGraph`'s node array (its insertion order is already the
correct chronological/grouped reading order — no separate sort needed)
and renders each artifact as a plain list item, interactive for
measurement/hypothesis (opens the same `selection` state a canvas click
would) and inert for everything else.

`investigation-workspace.tsx` picks exactly one of the desktop
(`InvestigationCanvas`+resizable rail) or mobile (`MobileInvestigationStack`,
no rail) branches per render, via a new `useBelowLgBreakpoint()` hook —
**not** two CSS-hidden branches always mounted. That distinction mattered:
the first version used `hidden lg:flex`/`lg:hidden` on both branches
simultaneously, which is how the codebase handles responsive layout
everywhere else, but jsdom (the unit-test environment) doesn't evaluate
CSS media queries at all, so both branches' content was simultaneously
queryable and 17 pre-existing tests failed on duplicate-element errors.
Fixed by switching to real conditional rendering keyed off `belowLg`,
which also avoids ever mounting React Flow inside a zero-size
`display:none` container. `useBelowLgBreakpoint` itself is backed by
`useSyncExternalStore` (matchMedia's `change` event as the external
store), not a `useState` + `setState`-in-`useEffect` — the latter is a
hard ESLint error in this repo (`react-hooks/set-state-in-effect`) and
was caught by the lint gate, not by inspection.

Mobile's substitute for the persistent rail is a bottom `Sheet` that
reuses `ContextRail` verbatim (same component, `showCollapseButton={false}`
since the Sheet's own ✕ makes the rail's ▸ redundant and, outside the
resizable rail, mislabeled) — never a second, divergent implementation of
hypothesis/measurement detail. It's gated on `belowLg && selection !== null`
(not just an `lg:hidden` className on the Sheet) so Radix's overlay/
focus-trap never activates on desktop, where the persistent rail already
shows the same selection.

**Item 6 — Verification.** New/updated tests: `investigation-stack.test.tsx`
(6, MobileInvestigationStack ordering/interactivity/empty-state),
`context-rail.test.tsx` (5, controlled collapse contract — this component
had no prior coverage), 3 new cases in `investigation-workspace.test.tsx`
(mobile branch renders the stack not the canvas, tapping an artifact opens
the Sheet with the same detail, composer stays reachable on mobile — all
via a `matchMedia` mock). Full gate: `pnpm lint` / `pnpm typecheck` clean;
`pnpm test` 358/358 (was 298 at `309858b`, +46 from items 1–3, +14 this
session); `pnpm test:integration` 61/61 (unchanged from items 1–3);
`pnpm build` clean.

Live QA (chrome-devtools MCP, signed in as `gateway-x-demo@crado.local`,
real seeded Gateway X cases — `resize_page` correctly hit every requested
width this session, unlike the ~1000px floor noted after `309858b`):
- **1440**: resizable rail — collapsed via the ▸ button (canvas expanded
  to fill the freed space, separator `value` went to its max), expanded
  again via ◂, clicked a hypothesis node and confirmed the rail's detail
  view updated; console clean apart from one pre-existing React Flow
  attribution warning (present before this session, not a regression).
- **1280**: full Investigation tab with rail, no layout issues.
- **1024** (the `lg` boundary itself): confirmed desktop layout, matching
  the `(max-width: 1023px)` query's intended boundary.
- **768**: mobile investigation stack renders (no React Flow, no rail);
  tapped the hypothesis card, confirmed the bottom Sheet opened with the
  exact same hypothesis detail as the desktop rail, no `▸` button present;
  console clean (no React Flow warning either — it's genuinely not
  mounted on this branch).
- **390**: same stack layout holds; Evidence table's `USED BY` column
  confirmed to scroll inside its own `overflow-x-auto` container via a
  `document.body.scrollWidth === window.innerWidth` check (the page body
  itself never scrolls horizontally); ran a real composer round-trip —
  typed "Retested Rev18 today and it now measures 4.2 dB above the limit",
  classified as MEASUREMENT, margin extracted as 4.2, frequency correctly
  left blank (not fabricated), "Recorded against Rev18" shown, cancelled
  without persisting (kept the seed case's demo data untouched for future
  QA); console clean.
- Case page (`/cases/[caseId]`, 1440): confirmed the Advanced disclosure
  ("MANUAL ENTRY (ADVANCED)") from items 1–3 still renders correctly,
  collapsed by default, composer-first copy intact.

No duplicate analysis runs or unintended state mutations were observed
during any of the above (the composer confirmation was cancelled, not
submitted, specifically to avoid mutating the shared demo dataset).

**Outcome**: all six ordered items complete and verified. `UX-04.passes`
set to `true` in `features.json`; `UX-04-LIGHT`'s superseded entry left
untouched.

- Commit: `d77d737`

## UX-04 — reopened: investigation-canvas visual correction

Reopened after pilot review flagged three defects from screenshots: the
investigation canvas rendered as a narrow, vertically-stretched single
chain (excessive empty horizontal space, cards small enough to need
manual zoom), and the Observation/Next-test area was clipped at the
canvas's bottom edge.

**Root cause (diagnosed, not assumed to be `rankdir`)**: three independent
issues stacked on top of each other, not one:
1. `build-canvas-graph.ts`'s layout was purely top-to-bottom — every trunk
   node (measurement, correlation, each hypothesis, every history entry)
   was placed at `x = 0`, one below the previous. Hypotheses fanned out
   *horizontally* into their own columns instead of stacking under a
   shared stage, so anything after the fan-out collapsed back onto a
   single vertical trunk. Available viewport width was never used.
2. Static per-kind height estimates (`missing: 130`) were too small for
   real multi-item missing-evidence content, so raw-coordinate overlap
   between a hypothesis's missing-evidence card and the next lane's
   cards was a real, reproducible defect, not a visual illusion.
3. `<ReactFlow fitView>` (boolean prop) takes precedence over
   `defaultViewport` on mount and centers on the *entire* bounding box;
   for a graph taller/wider than fits at the configured `minZoom` floor,
   that crops symmetrically from *both* ends rather than anchoring to
   the graph's natural reading-start (the Measurement node) — this is
   what produced both "must zoom in to read anything" and "bottom
   section clipped," on the X and Y axes respectively depending on
   which dimension overflowed first.

**Layout changes** (`build-canvas-graph.ts`, rewritten): stage/column
layout — Measurement, Deterministic correlation, Hypothesis,
Missing-evidence/Observation, Next-test, Change/Revision, Outcome each
get one fixed column in that left-to-right reading order. Multiple nodes
at the same stage (parallel hypotheses, a run of history entries) stack
*vertically* within that one column via per-column cursors, never
sideways into their own columns. A hypothesis and its own
missing-evidence/next-test cards share one visual row ("lane") across
three columns, grouped by shared `y`; a lane's height is the tallest of
its three cards, so the next lane starts only after every card in the
previous one has actually ended — this structurally fixes the
overlap (missing/next-action columns are now distinct from
observation's column, so that specific pairing can never overlap
regardless of content length). `NODE_WIDTH` widened 320→360px so real
copy reads without forcing extra height. Two-pass sizing: a static
`ROW_HEIGHTS` estimate for first paint (still what the pure-function
tests exercise), then a second `buildCanvasGraph` pass once
`useNodesInitialized()` reports true, backed by real measured DOM
heights via a pluggable `getNodeHeight` lookup — implemented as a
`useMemo` reading `getNodes()` at render time, not `setState` inside a
`useEffect` (this repo's `react-hooks/set-state-in-effect` rule hard-
errors on that pattern; xyflow's own docs example uses it, but the
lint-compliant equivalent here is a pure derived value).

**Zoom / navigation**: added `<Controls>` (zoom in/out, fit-view,
interactive-lock hidden) plus two custom `ControlButton`s — "Fit
investigation" (`fitView` with padding/minZoom) and "Reset to readable
zoom" (`setViewport` back to a fixed origin-anchored `{CANVAS_PADDING,
CANVAS_PADDING, DEFAULT_ZOOM}`, deliberately distinct from Fit: Reset
always returns to the same place, Fit adapts to however large the
investigation currently is). `colorMode="dark"` added — without it
`<Controls>` rendered using xyflow's own light-theme CSS variable
defaults (a plain white panel) since it's the only canvas element that
reads xyflow's theme tokens rather than this app's own classes.

**Clipping fix**: removed the `fitView`/`fitViewOptions` boolean props
from `<ReactFlow>` entirely — mount now uses a fixed
`defaultViewport={{x: CANVAS_PADDING, y: CANVAS_PADDING, zoom:
DEFAULT_ZOOM}}`, anchored at the graph's origin (the Measurement node),
never an auto-fit that can leave both ends of a too-wide/too-tall graph
symmetrically cropped. Live-verified: on a 5-hypothesis-free chain the
Measurement node, previously invisible off-screen at load, now renders
first and fully in view. For graphs too large to read in full at once
(verified against a real seeded case with 2 hypothesis lanes + 6 history
entries), the reachable-not-hidden requirement holds: every node is
reachable by pan (confirmed programmatically — wheel-pan in each of the
four directions moves the correct, matching amount) even when "Fit
investigation" itself has to crop to stay within the readable `minZoom`
floor, consistent with the ticket's own "show main path at sensible zoom
with panning available" allowance for content that doesn't fit
overview-legible on one screen.

**Responsive breakpoints redesigned** (`investigation-workspace.tsx`):
generalized the old single `useBelowLgBreakpoint()` into a
`useMediaQuery(query)` hook (`useSyncExternalStore`-backed, SSR-safe),
with two independent thresholds instead of one binary split —
`CANVAS_QUERY = (max-width: 767px)` (below → mobile stack fallback) and
`RAIL_QUERY = (max-width: 1023px)` (below → no persistent side rail,
Sheet substitutes). The canvas-usability threshold moved down from
1024px to 768px: the new horizontal, pan/zoom-capable layout is usable
at tablet width, so laptop/tablet viewports (768–1023px) now get the
real canvas full-width with the Sheet standing in for the rail, instead
of falling back to the vertical stack. Narrow mobile (<768px) keeps the
existing stack/Sheet fallback unchanged.

**Domain/product truth**: unchanged — no OBSERVED/KNOWN/INFERRED/MISSING
labeling, hypothesis ranking, or evidence semantics touched; this was a
pure layout/rendering correction. `UX-04-LIGHT`'s entry left untouched.

**Tests**: `build-canvas-graph.test.ts` rewritten (9→20 tests) —
left-to-right column ordering, lane grouping (shared `y`, increasing
`x`), lane-height-driven vertical stacking (a direct regression test
using a custom height lookup returning 900 for one card, asserting the
next lane starts past it, not at a fixed guess), a direct regression
test asserting missing-evidence and observation nodes can never land in
the same column, height/width reflecting the pluggable lookup.
`investigation-workspace.test.tsx` — 3 existing tests updated to the new
mock-viewport helper, 2 new tests added covering the laptop/tablet tier
(real canvas + Sheet, no persistent rail) and the large-desktop tier
(canvas + persistent resizable rail), 23/23 passing.

**Automated results**: `pnpm exec tsc --noEmit` clean · `pnpm run lint`
clean · `pnpm exec vitest run` 365/365 (48 files) · `pnpm run
test:integration` 61/61 (12 files) · `pnpm run build` succeeds.

**Live QA** (chrome-devtools MCP, real seeded Gateway X cases):
- **1440**: fresh load — Measurement node visible first, readable
  default zoom, dark-themed Controls, no clipping. Loaded a richer real
  case (2 hypothesis lanes, missing-evidence, next-test, engineer
  observations, an engineering change, a new revision, and a measured
  outcome) — hypothesis lanes render side by side with correct
  HIGH/LOW badges, missing-evidence and next-test columns fully
  separated from each other with zero overlap, "Fit investigation" and
  "Reset to readable zoom" both verified (Reset returns to the exact
  origin-anchored view), pan verified in all four directions.
- **1280 / 1024**: persistent resizable rail present (1024 is the
  boundary itself, correctly still desktop-tier per `(max-width:
  1023px)`), canvas readable, no clipping, no page-level horizontal
  overflow.
- **768**: canvas renders full-width horizontally (not the mobile
  stack), no persistent rail — matches the new laptop/tablet tier.
- **390**: mobile stack fallback renders (no React Flow mounted),
  vertical full-width cards, `scrollWidth === clientWidth` confirmed (no
  page-level horizontal overflow).
- Console clean at every breakpoint apart from the one pre-existing,
  documented React Flow attribution warning (`proOptions.hideAttribution`
  is intentional; present before this session, not a regression).

**Outcome**: all 8 implementation items complete and live-verified.
`UX-04.passes` restored to `true` in `features.json`; `UX-04-LIGHT` left
untouched.

## UX-04 — reopened #2: real-time agentic flow correction

Reopened after live testing (baseline `d6df97a`) showed a critical
execution defect distinct from the earlier visual-layout correction: after
confirming intake, the first activity step appeared, then the UI froze for
several seconds, then every remaining activity step appeared simultaneously
and the status jumped straight to `CRADO · COMPLETE` — while the React Flow
canvas stayed empty until the browser was refreshed.

### Diagnosis (proven, not assumed)

The server-to-client transport itself was already real: `POST
/api/analysis-runs` (route.ts) already returned a genuine SSE stream
(`JsonToSseTransformStream`), and `create-analysis-run.ts`'s
`persistAndYield` generator already persisted each event to
`analysis_events` **before** yielding it, so transport/persistence
ordering was never the problem. The client (`investigation-workspace.tsx`)
already read the stream incrementally (`reader.read()` in a loop,
`setState` per parsed event) and passed the live `state` straight into
`InvestigationCanvas`, whose `graph` is a `useMemo` over that same `state`
— so the canvas was already wired to re-render on every event in
principle.

**Root cause A — batched activity (live-reproduced via chrome-devtools
MCP polling a real Gateway X run, 100–250ms samples, `docs/PROGRESS.md`
timestamps below):** `runInvestigationAgent`'s `onToolExecutionEnd`
callback fired correctly *during* the SDK's internal multi-step tool loop,
but only ever pushed into a local, in-memory `activity: []` array —
nothing was observable outside that one `await agent.generate({...})`
call until it fully resolved. `run-analysis.ts` then looped over that
already-complete array with no `await` between iterations. A live run
proved this exactly: DOM polling showed the activity list and node count
frozen for **15.6 seconds** (2 nodes, 1 activity row, unchanged), then
every remaining item (5 tool completions, `agent.completed`,
`hypothesis.created`, `run.completed`) landed inside a single ~250ms
polling window. This is "events generated only after the whole [agent]
phase completes" — true for exactly the phase that dominates a run's real
wall-clock time.

**Root cause B — canvas requiring a refresh / requiring manual panning to
find new content:** the canvas's `defaultViewport` (fixed at the graph's
origin, a deliberate fix from the prior visual-correction ticket to avoid
`fitView`'s both-ends-clipping bug) is applied once, at mount, and never
moves again on its own. Once Root Cause A is fixed and a burst of new
nodes can legitimately still arrive together (a whole hypothesis lane from
one `hypothesis.created` event), nothing ever panned the viewport toward
them — they landed in the canonical graph and the DOM, just outside the
still-origin-anchored visible window, which is indistinguishable from
"empty" without deliberately panning to find them (item 7 in the ticket's
own defect list, "users must manually pan and move around to find them,"
independently corroborates this exact mechanism). A full page refresh
"fixed" it only because a fresh SSR mount starts the same fixed-origin
anchor over from scratch on a graph that, by then, already has everything
— not because anything was structurally different about a refresh's data.

### Architecture implemented

**Real incremental agent-activity streaming**
(`src/lib/agents/investigation-agent.ts`): added `investigateStreaming`,
an async generator that bridges the SDK's synchronous
`onToolExecutionEnd` callback to genuine incremental yields via a small
pull-queue + one-slot wake-up promise (`agent.generate()` runs
concurrently with a loop that yields each tool's completion the instant
it happens, and only returns the final validated result once
`agent.generate()` itself resolves). `runInvestigationAgent` is now a
thin wrapper that drains this generator silently, so every existing
caller/test that awaits one Promise needed no change.
`InvestigationAgentRunner.investigate` (`run-analysis.ts`) changed from
`Promise<RunInvestigationAgentResult>` to
`AsyncGenerator<AgentToolCompletedPayload, RunInvestigationAgentResult>`;
`runAnalysis` now delegates into it with `agentGenerator.next()` in a
loop, `yield emit("agent.tool.completed", ...)` for each value as it
arrives — never collected into an array first. `create-analysis-run.ts`'s
real `agentRunner` now calls `investigateStreaming` directly.
Live-verified: the same real Gateway X pipeline now shows activity items
completing seconds apart (proven again via polling: activity count
progressing 1→4→6 across real, separated timestamps, not one frozen
block) instead of a multi-second freeze followed by a single batch.

**Canvas follow-agent + empty-state placeholder**
(`investigation-canvas.tsx`): a `followAgent` toggle (default on) tracks
previously-seen node ids in a ref; a `useEffect` (calling the imperative
`setCenter` API, never `setState`, so it doesn't trip this repo's
`react-hooks/set-state-in-effect` rule) diffs newly-added canvas nodes
against that ref on every graph change and, when following is enabled,
centers the viewport on the new nodes' bounding box at the same fixed
`DEFAULT_ZOOM` every other view in this canvas uses — deliberately
`setCenter`, not `fitBounds`/`fitView`, so revealing new work never
shrinks the graph to keep fitting it in (the ticket's explicit
requirement). The very first population of the graph is recorded without
moving the viewport, since `defaultViewport`'s fixed origin anchor
already handles that moment correctly. `onMoveStart` distinguishes a real
user gesture from a programmatic move via xyflow's own documented
convention (`event` is `null` for a call this code made itself, the real
DOM event for a genuine drag/wheel/pinch) and pauses following only on
the latter; a `ControlButton` re-enables it. A `graph.nodes.length === 0`
empty-state overlay (role="status", the same real `lastEventSummary`/
`errorMessage` already shown elsewhere, never a fabricated per-node
guess) replaces the previous bare `return null`, but only for a run that
has actually started — a genuinely idle case (no measurement, no run
ever attempted) still renders nothing, since there's no "current genuine
state" worth describing there.

Live-verified against a real completed run with a hypothesis: on
completion, the canvas had already auto-panned to center the
Hypothesis/Missing-evidence/Next-test lane (the newest content) — fully
readable, no manual panning needed, matching the screenshot evidence in
this ticket's report almost exactly inverted. A real drag gesture
(synthetic `mousedown`/`mousemove`/`mouseup` on the pane, exercising
xyflow's actual D3-drag handling, not a fake state flip) correctly
flipped the Follow-agent button's `aria-pressed` to `false`; clicking it
again correctly restored `true`.

### What was not rebuilt

The existing SSE transport, `analysis_events` persistence-before-yield
ordering, and refresh-reconstruction (`reconstructFromPersistedEvents`)
were already correct and are unmodified — this ticket's fix is entirely
about (a) not batching the agent phase's own activity behind one
unobserved `await`, and (b) making the canvas viewport follow live
growth instead of staying fixed at its first-paint anchor. No new
database tables, no new event types, and no second competing state model
were introduced. Server-side cross-request idempotency (an idempotency
key preventing two different tabs/clients from starting two runs for the
same failure case within the same instant) was **not** implemented —
the existing client-side guard (`runInFlightRef`, disabled button) still
correctly collapses rapid same-tab double-clicks to exactly one POST
(re-verified live: 3 rapid clicks on RUN AGAIN produced exactly one
network request), but a genuinely concurrent request from two separate
tabs would still create two rows today. This is a known, documented
remaining limitation, not a silent gap.

### Tests

`investigation-agent.test.ts`: new `investigateStreaming` suite proves
real incremental yielding — a tool call's completion is consumed via
`.next()` before an artificially slower *second* model step (60ms,
`setTimeout`, never a fake timer) even resolves, which a
collect-then-replay implementation could not satisfy.
`run-analysis.test.ts`: `fakeAgentRunner`/`throwingAgentRunner` updated
to the generator interface (behavior-preserving — all 12 existing
assertions about event order/fallback/failure unchanged and still pass).
`investigation-canvas.test.tsx` (new): empty-state placeholder shows the
real `lastEventSummary`, disappears the instant a real node exists, and
is never present once the run is complete with a non-empty graph; the
Follow-agent button defaults pressed and toggles both directions.
`investigation-workspace.test.tsx`: new test proves the React Flow node
count grows strictly between the click and completion (not a 0→everything
jump) and is non-empty once complete.

### Automated results

`pnpm exec tsc --noEmit` clean · `pnpm run lint` clean ·
`pnpm exec vitest run` 373/373 (49 files) · `pnpm run test:integration`
61/61 (12 files) · `pnpm run build` succeeds.

### Live end-to-end verification

Two full, real Gateway X runs (real Anthropic model, real deterministic
correlation, real Supabase persistence — no mocked browser responses),
submitted through the actual intake flow, polled via chrome-devtools MCP
at 100–250ms resolution:

- Run 1 (first submission): activity progressed 1→4→6 items across real,
  separated timestamps (t≈0, t≈3.0s, t≈3.1s) — no multi-second freeze —
  before completing with 5 canvas nodes; the canvas had already
  auto-panned to center the new Hypothesis/Missing/Next-test lane by the
  time of the first post-completion screenshot, no refresh, no manual
  pan.
- Run 2 (RUN AGAIN, 3 rapid clicks): exactly one `/api/analysis-runs`
  POST fired (network tab confirmed); activity again progressed across
  separated timestamps, completed with 5 nodes, canvas non-empty.
- Refresh after Run 1: reconstructs the identical persisted state
  (`reconstructFromPersistedEvents`, unmodified) — "5 actions completed ·
  17.3s", full graph, same origin-anchored view a fresh mount always
  starts at.
- Follow-agent: default on (`aria-pressed="true"`); a real drag gesture
  paused it (`aria-pressed="false"`); the control button re-enabled it.
- Breakpoints 1440/768/390 re-checked live: no regressions, console clean
  apart from the one pre-existing, documented React Flow attribution
  warning at every size.

### Outcome

Both proven root causes are fixed and live-verified without a browser
refresh. `UX-04.passes` restored to `true`; `UX-04-LIGHT` untouched.
Remaining limitation: no server-side cross-tab/cross-client idempotency
key (see above) — documented, not silently dropped.

## UX-05 — Decision-centred investigation workspace (partial)

New, bounded ticket (not a continuation of UX-04 bug-fixing): redesign
the investigation journey to be failure-first and decision-first, not
graph-navigation-first. `UX-05` is a new `features.json` entry;
`UX-04`/`UX-04-LIGHT` are untouched. Baseline confirmed before any edit:
HEAD was exactly `e6cb8c2`, all 8 named UX-04 invariants intact, no
`AGENTS.md` exists anywhere in the repo. No SSE/event-store/persistence
rework was performed — every new surface below consumes the existing
`WorkspaceState`/`TimelineEntry[]` projection (`reconstruct.ts`,
`timeline.ts`) unmodified, per the ticket's own explicit instruction not
to rebuild working streaming infrastructure.

### What shipped

- **New default tab: Decision** (`decision-view.tsx`). Reuses four
  fully-built-but-dead UX-03 components verbatim — `MeasurementPanel`,
  `CorrelationCard`, `HypothesisCard`, `RevisionComparisonCard` — found
  during audit to be referenced by nothing live (superseded by
  `canvas-nodes.tsx`'s compact registry for the canvas/mobile-stack, but
  never deleted). Composes them into one readable stack: Measurement →
  What Crado knows (real correlations only) → Leading hypotheses (real
  hypotheses only, ranked) → Recommended next test (new — the only truly
  new content) → Outcome (most recent real `result` timeline entry, via
  the existing `RevisionComparisonCard`). Every section renders nothing
  until the real data behind it exists — no placeholder implies content
  that isn't there yet.
- **`src/lib/investigation/rank-hypotheses.ts`**: deterministic
  leading/plausible/weakened/unresolved ranking from the run's own real
  `confidenceBand` + `update.status` fields. A hypothesis explicitly
  weakened by later evidence always ranks last regardless of its
  original confidence; absent an update, strength follows confidence
  band directly. No invented percentage, score, or "contradicting
  evidence count" (the domain has no such field).
- **`src/lib/investigation/derive-workflow-state.ts`**: replaces the old
  5-state Complete/Ready/Investigating/Failed/Waiting vocabulary with the
  ticket's truthful set (awaiting_measurement / idle /
  analysis_in_progress / analysis_failed / interrupted /
  more_evidence_needed / ready_for_next_test / change_ready_to_verify /
  outcome_ready_for_review / resolved). Derived from real `RunStatus` +
  timeline `engineering_change`/`result` ordering (a second change after
  a result correctly reverts to `change_ready_to_verify`, not a stale
  `outcome_ready_for_review`) + the `failure_cases` row's own
  `status` — `resolved` is never inferred from an agent run finishing.
  `AgentStatusPill` now reads this, wired through `page.tsx`'s real
  `failureCase.status`.
- **Tab rename + no forced navigation**: `"investigation"` relabeled
  `"Map"` (Decision is now the default/first tab). The RUN-start forced
  tab-switch was removed — both Decision and Map now render live from
  the same state, so starting/re-running a run no longer yanks the
  engineer to a specific tab; whichever tab they're on keeps updating in
  place. `AgentMetricsPanel` was added to the Decision tab (previously
  Investigation-tab-only) so agent metrics don't regress for engineers
  who land on the new default.
- **Record result**: the Decision view's RECORD RESULT button reuses the
  existing `handleRecordResult` (focuses the composer) — one entry
  point, not a second divergent one.

### Tests

`derive-workflow-state.test.ts` (14 cases incl. the change-after-result
boundary), `rank-hypotheses.test.ts` (10 cases), `decision-view.test.tsx`
(7 cases), `agent-status-pill.test.tsx` (5 cases) — 36 new tests, all
passing. `investigation-workspace.test.tsx`'s pre-existing 24 tests
updated (not weakened) for the new default tab and the
`"Investigation"`→`"Map"` rename — each updated test still asserts
exactly what it asserted before, just via the tab that now hosts that
behavior.

### Automated results

`pnpm exec tsc --noEmit` clean · `pnpm run lint` clean ·
`pnpm exec vitest run` 408/409 (53 files) — the one failure
(`case-composer.test.tsx`) is a pre-existing full-run timing flake,
confirmed passing 14/14 in isolation; that file was not touched by this
ticket · `pnpm run build` succeeds. Integration tests were not re-run:
no backend/query/schema code changed.

### Live end-to-end verification

A brand-new Gateway X investigation was created through the real intake
flow (chrome-devtools MCP, signed in as the seeded demo user, no mocks)
and RUN INVESTIGATION clicked from a fresh Decision tab. Timestamped
polling proved sequential, non-batched arrival:

```
t=0ms     "Reviewed previous revisions / 3 revisions found"   pill: Agent analysis in progress
t=4560ms  hypothesis appears                                  pill: Agent analysis in progress
t=4711ms  run completes                                       pill: Ready for next test  (never "Complete")
```

Decision was populated with real Measurement/correlation content
*during* the run, not only after. At completion, Decision showed the
full stack (Measurement, What Crado knows, Leading hypotheses with the
real evidence grid, Recommended next test, agent metrics) with no
refresh; switching to Map showed 5 real canvas nodes fully connected
with no refresh either, reconfirming the UX-04 reopened-#2 fix still
holds under the new default tab. RECORD RESULT correctly focused the
composer. Breakpoints 1440/1280/1024/768/390 all screenshotted: layout
reflows correctly at every size (persistent rail ≥1024, Sheet-based
selection below), no horizontal overflow, zero new console
errors/warnings (the one pre-existing React Flow attribution dev warning
reappeared, unrelated to this ticket, not a regression).

### Deferred (not built this session, not silently dropped)

- Investigations work-queue's four-bucket filters and a literal per-row
  "required next action" string.
- A dedicated Before/After comparison screen beyond the Decision view's
  Outcome section, and a dedicated resolved-trajectory narrative view
  beyond Decision + the existing Timeline tab.
- Investigation Map minimap / jump-to-active-step control and its own
  readable-default-zoom tuning pass.
- A real `agent.tool.started` durable event: no reliable SDK lifecycle
  callback was located this session for a genuine per-tool active state.
  Per the ticket's own explicit instruction, this was **not** synthesized
  client-side — the honest overall "Working…" state plus the completed
  tool sequence was retained as-is.
- A full WCAG/keyboard-navigation audit specific to the new Decision
  surface (it reuses existing heading/landmark/focus/live-region
  patterns, but wasn't independently re-audited beyond that).
- Cross-tab/cross-client run-start idempotency remains unenforced
  server-side — unchanged from UX-04, and out of scope here since this
  ticket never touched the run-start boundary.

### Outcome

A coherent, fully-verified core slice shipped: the failure-first Decision
view is real, live, and truthful, reusing 100% existing data with zero
new event types or backend changes. `UX-05.passes` is `false` — several
sections of the full ticket (above) remain unbuilt. `UX-04`/`UX-04-LIGHT`
are untouched.

## UX-05 continuation — enterprise investigation shell, recent work, and live reasoning trace

Continuation of the same `UX-05` ticket (`features.json` entry unchanged,
`passes` stays `false`). Baseline confirmed before any edit: HEAD was
exactly `bbe83c2` (the partial UX-05 commit above), `UX-04`/`UX-04-LIGHT`
untouched throughout. This session shipped Workstreams A, B, and C in
full plus part of D (queue filters), and — importantly — found and fixed
two genuine, previously-undetected bugs via live QA against a real
Anthropic call, which is the most consequential outcome of this session.

### What shipped

- **Workstream A — Sidebar shell**: `src/components/ui/sidebar.tsx`, a
  full shadcn Sidebar port (`SidebarProvider`/`Sidebar`/`SidebarTrigger`/
  `SidebarRail`/`SidebarInset`/`SidebarHeader`/`SidebarContent`/
  `SidebarGroup(Label)`/`SidebarMenu(Item/Button/Badge)`/`SidebarFooter`,
  `useSidebar`). `app-shell-chrome.tsx` rewritten around it: Cmd/Ctrl+B
  toggle, collapsed icon mode with tooltips promoted to real
  `aria-label`s (collapsed nav items were losing their accessible name
  until this was added), off-canvas mobile Sheet, real destinations only
  (Investigations, Resolved cases, Products & revisions, Sources,
  Benchmarks — no fabricated nav items), workspace switcher in the
  footer. Real Crado logo (white mark on the dark sidebar) via
  `public/brand/crado-mark-{black,white}.png`. `SidebarMenuBadge` shows
  a real, computed open-investigations count, never a placeholder
  number. Several live-QA'd fixes along the way: badge rendering on its
  own line (fixed via absolute positioning), collapsed-mode label text
  bleeding as illegible fragments (fixed via
  `group-data-[collapsible=icon]:[&>span]:hidden`), the collapse trigger
  disappearing entirely when collapsed (kept visible, stacked under the
  logo).
- **Workstream B — Recent investigations**: `New investigation`'s large
  empty lower region now shows a real `RecentInvestigations` section
  (`src/app/investigations/new/recent-investigations.tsx` +
  `actions.ts`'s `loadRecentInvestigations()`), ordered by latest
  meaningful activity, each card showing product/revision, a restrained
  generic `DeviceGlyph` (`src/lib/design/device-glyph.tsx` — deliberately
  generic, never a fabricated antenna/PCB/sensor icon, since the schema
  carries no device-category data), the case's truthful workflow state,
  recency, and a real required-next-action string, one click to resume.
  Proper loading/empty/error states.
- **Workstream C — Investigation Trace**: `agent-activity-panel.tsx`
  replaced by `investigation-trace-panel.tsx` — a collapsible,
  enterprise-styled live trace (visually adapted from the shadcn
  Chain-of-Thought pattern, never labeled that in-product, never model
  reasoning text) populated only by genuine server events. New
  `agent.tool.started` event added via an additive migration
  (`supabase/migrations/20260903000000_analysis_events_agent_tool_started.sql`),
  bridged from the AI SDK's real `onToolExecutionStart` callback
  (confirmed present and symmetric with the already-used
  `onToolExecutionEnd` by inspecting the installed package's own
  `.d.ts`) in `investigateStreaming` (`investigation-agent.ts`), threaded
  through `run-analysis.ts` → `reconstruct.ts`
  (`WorkspaceState.activeTools`, cleared the instant the matching
  `agent.tool.completed` arrives) → the same canonical persisted-then-
  streamed SSE pipeline Decision/Map/status already share — a live run
  and a page-refresh replay produce the identical trace.
- **Workstream D (partial)**: real queue filter buckets — Active / Needs
  evidence / Ready for review / Resolved
  (`src/lib/investigations/derive-queue-workflow-state.ts`,
  `queue-filter-tabs.tsx`) — with real counts and a truthful required-
  next-action string per row, wired into `/investigations`. Deliberately
  a separate, lighter batched-input function rather than calling the
  expensive per-case `deriveWorkflowState`/`getInvestigationTimeline`
  once per queue row, with its own 23-case test suite proving
  equivalence. Not built this session: dedicated Before/After screen,
  dedicated resolved-trajectory view, Map minimap/jump-to-active, a full
  WCAG audit (see Deferred below).

### Two real bugs found and fixed via live QA (the important part)

Live-verifying Workstream C against a genuinely new investigation and a
real Anthropic call (chrome-devtools MCP, no mocks) surfaced two defects
neither unit tests nor the earlier partial-ticket session had caught:

1. **Duplicate React key / `event.callId` misuse.** The system prompt
   correctly asks the model to call several tools "together in the same
   turn" (`getMeasurementContext` + `getDeterministicCorrelations` +
   `getProductContext` + history tools). A live run of exactly that
   shape threw `Encountered two children with the same key,
   'call-dzk5KePjTqYjFOGUV7aA8Jvp'` in the browser. Root cause, confirmed
   against the DB and the AI SDK's own type declarations: `investigation-
   agent.ts` was reading `event.callId` in both `onToolExecutionStart`
   and `onToolExecutionEnd` — but the SDK documents `callId` as "Unique
   identifier for this **generation call**", i.e. shared by *every* tool
   executed within one model step, not a per-tool-call id. All 5
   concurrently-called tools in that step got the identical id. Fixed by
   reading the real per-call id, `event.toolCall.toolCallId`, instead
   (verified against real Anthropic `toolu_...` ids in
   `analysis_events` after the fix — six distinct ids, correctly
   started→completed paired). Added a regression test
   (`investigation-agent.test.ts`: "gives each tool call its own
   distinct toolCallId ... never the shared per-generation callId") that
   scripts a single model step requesting two tools together — the exact
   shape that exposed this — and a defensive dedup-by-key backstop in
   `buildSteps` (`investigation-trace-panel.tsx`) so a duplicate/stale id
   from any future source can never render or key a step twice (own
   regression test added).
2. **`useSyncExternalStore` contract violation → "Maximum update depth
   exceeded."** Immediately after fixing (1), the *next* live run
   crashed with a real infinite-render-loop error inside
   `InvestigationTracePanel`. Root cause: `useElapsedTime`'s
   `getSnapshot` computed `Date.now() - startedAt` directly — a value
   that changes on literally every call, which violates
   `useSyncExternalStore`'s requirement that `getSnapshot` return a
   *stable* value between actual store-change notifications; React kept
   re-rendering trying to reach a snapshot that never stabilized. Fixed
   by caching the elapsed value in a ref, written once per second inside
   `subscribe`'s own interval tick, with `getSnapshot` only ever reading
   that cached value. Re-verified live end-to-end afterward: elapsed
   timer ticked correctly (1.0s → 2.0s → 8.0s → 17.0s), all 6 real tool
   steps streamed in with correct per-call durations (1ms/1ms/1ms/39ms/
   56ms/57ms), run completed to a truthful "Ready for next test" status,
   zero console errors throughout, and a page refresh reconstructed the
   identical persisted trace ("6 actions completed · 18.9s") with no
   re-run.

Both fixes are in code this session already believed was live-verified
(the original UX-05-continuation trace implementation) — a reminder that
the earlier "no console errors" checks in this same session had not yet
exercised a real multi-tool-in-one-step model turn, which is what
actually triggered both defects.

### Tests

New: `app-shell-chrome.test.tsx` (10), `device-glyph.test.tsx` (4),
`derive-queue-workflow-state.test.ts` (23), `recent-investigations.test.tsx`
(6), `investigation-trace-panel.test.tsx` (14, incl. the duplicate-key
regression above). Updated: `investigation-agent.test.ts` (started/
completed pairing rewritten for the real kind-tagged stream, plus the new
multi-tool-in-one-step regression test), `run-analysis.test.ts`,
`reconstruct.test.ts` (`activeTools` cases), `investigation-workspace.
test.tsx` ("Agent activity" → "Investigation trace" rename),
`describe-investigation-status.test.ts`,
`create-analysis-run.integration.test.ts` (new started-before-completed
real-Postgres case). One cross-test-pollution flake was found and fixed
in `recent-investigations.test.tsx` during development (a never-resolving
mocked promise leaking a pending async task across the test file) — the
same class of bug as the ticket's own documented
`case-composer.test.tsx` full-suite-only flake. That specific file was
re-run 3 times back-to-back as part of 3 full-suite runs this session
(464/464 passing all 3 times) and did not reproduce; it was not modified,
since there was nothing reproducible to fix and CLAUDE.md's testing
doctrine rules out speculative changes to a passing test.

### Automated results

`pnpm exec tsc --noEmit` clean · `pnpm run lint` clean ·
`pnpm exec vitest run` 464/464 (57 files), run 3 times, all green ·
`pnpm test:integration` 62/62 (12 files) · `pnpm run build` succeeds.

### Live end-to-end verification

Real Gateway X cases (seeded + one newly created through the intake
flow), signed in as the seeded demo user, chrome-devtools MCP, real
Anthropic calls throughout — no mocks:

- A brand-new investigation with no product facts correctly produced "No
  harmonic correlations were found ... so no investigation hypotheses
  were generated" and never ran the agent phase at all (confirmed
  against `analysis_events`: only `run.started`/`measurement.loaded`/
  `run.completed`) — the deterministic-correlation gate on the agent
  phase working exactly as documented, not a bug.
- A `RUN AGAIN` on an existing Rev17/Rev18 case (real 40 MHz clock
  product fact, 200 MHz measurement, 5th-harmonic match) was used to
  reproduce and then re-verify both bugs above end-to-end, including a
  full post-fix run: live streaming trace, real elapsed timer, page
  refresh reconstructing an identical trace, zero console errors.
- Sidebar + New investigation + Investigations queue filters
  (real counts: All 11 / Active 1 / Needs evidence 9 / Ready for review 1
  / Resolved 0) all re-screenshotted this session with zero console
  errors.
- Breakpoints 1440/1024/768/390 swept on the Trace/Decision surfaces:
  clean reflow, no horizontal overflow, zero console errors at any size.
  One pre-existing, unrelated cosmetic issue noted but not fixed this
  session: at 390px the fixed composer bar's "+ Attach" label clips to
  "tach" — not introduced by this session's changes, not part of
  Workstream A/B/C.

### Deferred (not built this session, not silently dropped)

- Dedicated Before/After comparison screen beyond the Decision view's
  Outcome section.
- Dedicated resolved-trajectory narrative view beyond Decision + the
  existing Timeline tab.
- Investigation Map minimap / jump-to-active-step control.
- A full WCAG/keyboard-navigation audit across the new surfaces (the
  accessible-name fixes made to the collapsed sidebar were live-verified,
  but a systematic audit of every new surface was not performed).
- Cross-tab/cross-client run-start idempotency remains unenforced
  server-side — unchanged from UX-04, out of scope here.

### Outcome

Workstreams A, B, and C shipped in full and are live-verified against a
real Anthropic call, including two genuine bugs found and fixed that
would otherwise have shipped silently. Workstream D is partially done
(queue filters). `UX-05.passes` stays `false` — the Before/After screen,
resolved-trajectory view, Map minimap, and full WCAG audit remain for a
future session, in that dependency order (Before/After and resolved-
trajectory are independent of each other and of the Map minimap; the WCAG
audit is best done last, once every surface it needs to cover exists).
`UX-04`/`UX-04-LIGHT` remain untouched.

## Enterprise Investigation UI Revamp — theme system, scroll/clipping root cause, Map fixes (partial)

Ad hoc principal-design/staff-frontend ticket (not a `features.json` id —
no entry added there; this is additive polish/correctness work on top of
UX-05, not a new product-scope feature). Baseline: HEAD was `13e1141`
(UX-05 continuation) before any edit, confirmed clean via `git status`.
Scope actually completed this session is a bounded, fully-verified slice
of the full 12-section brief — not the whole thing. Documented honestly
below, in the "Deferred" section, per CLAUDE.md's explicit permission to
stop at a clean checkpoint rather than claim more than was done.

### What shipped

**1. Dual-theme design system (Light/Dark/System)** — the app had exactly
one hardcoded dark theme before this session. `src/app/globals.css`
rewritten into three token blocks sharing one name set: bare `:root`
(light, the default/fallback), `@media (prefers-color-scheme: dark)`
guarded by `:not([data-theme="light"])` (follows the OS until the user
pins a choice), and `:root[data-theme="dark"]` (an explicit choice wins
over the OS in both directions). Added a real `--success`/
`--success-foreground` pair (was missing — green was previously just
`--primary`) and repointed `--primary`/`--ring`/`--sidebar-primary`/
`--sidebar-ring` from green to a restrained cobalt/indigo
(`#4f46e5` light / `#818cf8` dark) per the ticket's explicit "stop using
green as the general brand/action color... green: verified success only"
rule. `src/lib/design/theme-provider.tsx` (new): a hand-rolled
`ThemeProvider`/`useTheme()` — no `next-themes` dependency needed for a
~150-line contract this codebase already had 90% of the pattern for.
Persists to `localStorage` (`crado.theme`), a blocking inline script
(`THEME_INIT_SCRIPT`, inlined into `<head>` by `layout.tsx`) applies the
saved theme to `<html>` before first paint so a returning dark-mode user
never sees a light flash, and the React-side state itself is read via
`useSyncExternalStore` (reusing the exact matchMedia-subscription pattern
`use-media-query.ts` already established for the sidebar/canvas
breakpoints) rather than `useState`+`useEffect` — this repo's lint config
hard-errors on synchronous `setState` inside an effect
(`react-hooks/set-state-in-effect`), which a naive
"read localStorage, then setState" implementation hit immediately.
`useTheme()` outside a `ThemeProvider` returns a safe inert
light default instead of throwing, specifically so the ~30 existing
component tests that render `InvestigationCanvas`/`AppShellChrome` in
isolation (no full app tree) keep passing unmodified. Theme control added
to the workspace/account dropdown menu (`app-shell-chrome.tsx`) as a
three-way segmented control (Light/Dark/System, `role="radiogroup"`),
deliberately plain buttons rather than `DropdownMenuItem`s so picking a
theme doesn't close the menu (comparing themes side-by-side).
**Live-verified**: theme switches instantly across sidebar/topbar/cards/
canvas/composer/dropdown with zero console errors and zero layout shift,
persists across reload and across navigation, System correctly shows
"System" selected in the menu.

**2. Root cause of the reported "sometimes impossible to scroll to the
final content" clipping bug — found and fixed.** Diagnosed via live DOM
geometry (chrome-devtools MCP), not guessed: at a constrained viewport
height, the Decision content pane's `.overflow-y-auto` div reported
`scrollHeight === clientHeight === 1906px` (i.e. "no overflow") while its
own `getBoundingClientRect()` extended to y=1957 — far past the 700px
viewport — meaning it was rendering at its full, unclamped content
height instead of being constrained to available space. Walking the
ancestor chain found the actual cause: `react-resizable-panels`'
`<Panel>` renders a plain `display: block` wrapper div with its own
`overflow: hidden` (for resize clipping); `flex-1`/`min-h-0` on our
content pane are flex-context-only CSS and are inert inside a
`display: block` parent, so the child sized to its content instead of
its available space, and the *panel's own* `overflow: hidden` then
silently clipped everything past ~571px with no scrollbar and no way to
reach it — precisely the reported defect. Fixed once at the shared
primitive (`src/components/ui/resizable.tsx`): `ResizablePanel` now
always renders `flex h-full min-h-0 flex-col` (merged with any caller
`className`), establishing the flex column context both of its current
consumers (the Decision/Map content pane and `ContextRail`) already
assumed existed. **Proof, not just a fix**: re-measured live after the
change — the same div now reports `clientHeight: 571` (correctly
clamped) / `scrollHeight: 1906` (real content) / `overflowing: true`;
`scrollIntoView({block:"end"})` on the wrapper's actual last section
("What Crado handled") landed it fully above the composer (`bottom:622`
vs `composerTop:630`) and fully inside the viewport — screenshotted.
Regression test: `src/components/ui/resizable.test.tsx` (2 cases) locks
in the className contract; jsdom does not run real CSS layout so the
geometry proof itself lives in this session's live QA, not a unit test.

**3. Investigation Map (React Flow) — real bug found and fixed, plus the
requested minimap.** Added `<MiniMap>` (themed via the same CSS
variables as the rest of the app — `bgColor`/`maskColor`/`nodeColor`/
`nodeStrokeColor` all `var(--...)` references, not xyflow's default light
chrome) and made `colorMode`/the dot-grid background theme-aware
(`useTheme()` instead of a hardcoded `"dark"`/hardcoded
`rgba(245,246,247,...)`). Live-verifying the minimap surfaced a second
real, previously-invisible bug: it rendered zero nodes despite the main
canvas showing all 5 correctly. Traced into `@xyflow/react`'s own source
(`node_modules/.pnpm/@xyflow+system@0.0.82/.../getNodeDimensions`/
`nodeHasDimensions`): a node's height comes from
`measured.height ?? height ?? initialHeight`. This canvas's own two-pass
layout-correction `useMemo` (real, pre-existing, unrelated to this
session) rebuilds its returned `nodes` array from the original
`initialNodes` objects every render — which only ever carried `width`,
never `height` — discarding whatever `.measured` React Flow had attached
internally. The main `<ReactFlow>` node renderer tolerates this fine (it
positions/sizes from its own internal measurement pass regardless), but
`<MiniMap>`'s node list reads the `height` field directly off each node
object and silently drops any node where it's `undefined` — so every
node vanished from the minimap specifically, with no error. Fixed by
adding an explicit `height: ROW_HEIGHTS[node.data.kind]` (the same
per-kind estimate `build-canvas-graph.ts`'s own default layout pass
already uses) alongside the existing `width: NODE_WIDTH` on
`initialNodes`, so height no longer depends on `.measured` surviving the
rebuild. Verified live in both themes: minimap now shows all 5 nodes,
correctly styled. `Fit investigation`/`Reset to readable zoom`/
`Follow agent` (all pre-existing, unchanged) reconfirmed still distinct
and working. New tests: 3 cases in
`canvas/investigation-canvas.test.tsx` (minimap renders + node count,
Fit/Reset stay distinct controls, canvas honors the resolved theme
instead of a hardcoded `colorMode`).

**4. Semantic color sweep (green → success-only, cobalt for
action/nav/active) across the investigation workspace and home queue.**
The ticket's rule — "Green: verified success/pass/resolved/completed
only. Blue/cobalt: navigation, focus, selection, primary actions, active
agent work" — meant the single old `--primary` (green, used for
literally every accent) had to split into two real tokens with per-call-
site judgment, not a blind find-replace. Mechanically swept ~150
hardcoded-hex occurrences (`#22c55e`, `#f59e0b`, and 8 other raw grays
that were the *same* single dark palette hand-duplicated as literal hex
across ~20 files) to the matching semantic Tailwind utility, then
individually reclassified every green occurrence as either `success`
(genuinely "verified/pass/resolved/completed" — e.g. `heroStatusStyle
.complete`, the queue's ✓ glyph, a completed trace step's checkmark, an
improved before/after result, a passing margin) or `primary`/cobalt
(action buttons, navigation, active-run indicators, citation/link
chips). One deliberate re-labeling beyond a pure color swap: the
"Candidate relationship" badge (both `correlation-card.tsx` and its Map-
view twin in `canvas-nodes.tsx`) was green before — but a "candidate" is
explicitly *not yet confirmed* per this codebase's own product-truth
comment ("never root cause... a coincidence worth investigating, not a
diagnosis"), so labeling it success-green would have been a real
semantic lie; recolored neutral instead, consistent with the existing
evidence-glyph convention where KNOWN facts are already neutral, not
green. Also fixed three call sites that were *already* using the
semantic `text-primary` class (not hardcoded hex, so invisible to the
grep-based sweep) for genuinely success-tone content — found only by
live-viewing the app in Light theme, where the reused-old-green-as-
primary intent became visually obvious: `investigations/page.tsx`'s
queue-row ✓ glyph, `recent-investigations.tsx`'s `complete` tone, and
`login/page.tsx`'s Sign-in button/mark (outside the ticket's stated
"home and investigation experience" scope, but a two-line fix left
unfixed would have put a glaringly inconsistent green button on literally
the first screen every user sees, undermining the whole redesign).

**5. Diagnosed, not "fixed", the reported 390px composer "+ Attach"
clipping.** Live DOM measurement at a true 390px viewport
(`getBoundingClientRect` on the real button) showed zero horizontal
overflow and the full "+ Attach" label rendering correctly — the bug did
not reproduce as a layout defect. Found the actual cause: Next.js's
dev-only build-activity indicator (`<nextjs-portal>`, shadow DOM,
fixed bottom-left, `Open Next.js Dev Tools`) sitting exactly on top of
the composer's Attach button in dev mode — confirmed by locating it
inside the portal's shadow root and comparing its rect
(`x:22–54, y:790–822`) against the Attach button's rect
(`x:25–92, y:783–819`): near-total overlap. This indicator does not
exist in a production build. Moved it out of the way rather than leaving
it to keep tripping up dev-mode QA:
`devIndicators: { position: "bottom-right" }` in `next.config.ts`.

### Automated results

`pnpm exec tsc --noEmit` clean · `pnpm run lint` clean ·
`pnpm exec vitest run` 479/479 (59 files) · `pnpm test:integration`
62/62 (12 files) · `pnpm run build` succeeds. 15 new tests this session:
`theme-provider.test.tsx` (10), `resizable.test.tsx` (2), 3 new cases in
`investigation-canvas.test.tsx`.

### Live end-to-end verification (chrome-devtools MCP, real seeded
Gateway X data, no mocks)

- Theme: Light/Dark/System switched live from the workspace menu at
  1440px on `/investigations`, `/investigations/new`, and the case
  investigation page (Decision + Map tabs) — zero console errors, theme
  persisted across a full page reload and across client-side navigation,
  System correctly reflected as selected.
- A real `RUN AGAIN` on an existing Gateway X case, timestamped: run
  started with a live "Crado is investigating" elapsed timer, 7 real
  tool-trace steps streamed in with correct per-call durations
  (3/2/2/68/100/103/16 ms) and green success checkmarks, status pill
  correctly flipped `analysis in progress` (cobalt) → `Investigation
  complete`/`Ready for next test` (green/neutral), zero console errors
  beyond one pre-existing, unrelated React Flow attribution dev warning.
- Breakpoints 1440/1280/1024/768/390 swept on the Decision/Map surfaces:
  zero horizontal overflow at any size (`document.documentElement
  .scrollWidth === window.innerWidth` verified programmatically, not
  eyeballed), clean reflow, composer's "+ Attach"/"SEND" both fully
  legible at 390px.
- The scroll-ownership/clipping proof (see item 2 above): DOM geometry
  captured before and after the fix, final section's `scrollIntoView`
  landing fully above the composer and inside the viewport, screenshotted.
- Map view: minimap node count verified via DOM query (0 → 5 after the
  fix) in both themes; Fit/Reset/Follow controls re-confirmed distinct.

### Deferred — NOT built this session, listed in dependency order

This session covered a bounded, high-value slice of the ticket's full
12-section brief — it does not claim the whole thing is done. In rough
dependency order for whoever picks this up next:

1. **Full hex-to-semantic-token sweep on the remaining routes**
   (Products, Sources/documents, Benchmarks) — these still contain
   literal hardcoded `#22c55e` green from earlier UX-04 work, unswept
   this session (out of this ticket's stated "home and investigation
   experience" scope). They will render with the new cobalt `--primary`
   everywhere it cascades automatically via CSS variables, but any
   hardcoded-hex green specific to those pages' own markup stays green,
   inconsistent with the rest of the app. Same mechanical technique this
   session used (enumerate the closed hex palette, map 1:1 to semantic
   tokens, hand-classify only the green occurrences) applies directly.
2. **Homepage/queue information architecture** — largely already matches
   the ticket's "work queue, not a dashboard" spec from prior UX-05 work
   (real filter counts, no KPI cards, row-based); not rearchitected this
   session beyond color tokens. The default (unfiltered) view's per-row
   status still uses the older `latestRunStatus === "completed"` →
   "✓ Investigation complete" vocabulary rather than the more truthful
   `derive-queue-workflow-state.ts` bucket + literal required-next-action
   string the *filtered* view already uses (a real, pre-existing product-
   truth gap, not introduced this session — UX-05's own PROGRESS entry
   flagged the filtered view as the fix and left the default view alone).
   Unifying both rows onto the truthful vocabulary is the natural next
   step here.
3. **Decision-view visual hierarchy** — the current Decision page already
   substantially matches the ticket's target shape live (measurement
   strip → deterministic relationship → leading hypothesis with
   evidence → recommended next test → agent-metrics disclosure → trace),
   inherited from prior UX-03/UX-05 work; this session did not rebuild
   its structure, only fixed the color tokens and the scroll bug beneath
   it. A dedicated pass against the ticket's exact recommended section
   order/emphasis (in particular, "Recommended next action" getting the
   *strongest* visual emphasis, above the leading hypothesis) was not
   performed.
4. **Composer**: bounded-height-then-internal-scroll for long input was
   not verified/changed this session; the 390px Attach/Send legibility
   was confirmed but the "start compact, expand with content, then
   scroll internally" behavior from the ticket's Section 7 was not
   specifically audited.
5. **A full WCAG/keyboard-navigation audit** — not performed as a
   dedicated pass (same gap UX-05 already deferred). The new theme
   toggle uses a real `role="radiogroup"`/`aria-checked` and visible
   focus rings were spot-checked, but a systematic audit across every
   surface (queue rows, tabs, disclosures, trace, inspector, map
   controls, composer) was not done.
6. **"New" affordance for newly streamed content** (a non-color-only
   indicator when a hypothesis/missing-evidence request/recommended
   action arrives mid-run) — not added or verified this session.
7. Cross-tab/cross-client run-start idempotency remains unenforced
   server-side, unchanged from UX-04/UX-05, still out of scope.

### Outcome

Theme system (Light/Dark/System, real persistence, no hydration
mismatch), the scroll/clipping root cause, and the Map's real minimap
bug are all shipped and live-verified, not just proposed. UX-05's own
`passes` field is left untouched (`false`) — this work sits on top of it
and does not itself claim completion of UX-05's remaining deferred
items (Before/After screen, resolved-trajectory view, full WCAG audit)
nor the seven items listed above. Next session should pick up in the
order listed.

---

## 2026-09-04 — Application UI Revamp (Turn 2): Typography + token reconciliation (in progress)

A second, larger revamp ticket landed after the first (Ontora-inspired)
pass above was committed at `a8bfbb7`. It uses a different reference
product (a Replit-style dark-sidebar app) and specifies numeric design
tokens that differ from what the first pass shipped: IBM Plex Sans as
the app font, a tighter typography scale, and a more specific
light/dark surface ramp (warm-neutral light canvas, `#18181A`/`#1F1F21`/
`#252527` dark ramp, opacity-based borders). This entry covers the
first delivery-sequence step only (typography + semantic tokens);
the rest of the ticket (shell/sidebar, homepage, three-pane
investigation workspace, responsive/a11y audit, live QA) is not yet
started — see "Deferred" below.

### What shipped

1. **IBM Plex Sans, self-hosted.** `src/app/layout.tsx` now loads
   `IBM_Plex_Sans` via `next/font/google` (weights 400/500/600, normal
   style, `display: "swap"`, fallback `Arial, Helvetica, sans-serif`,
   CSS var `--font-plex-sans`) in place of `Geist`. `Geist_Mono` is kept
   for technical values (frequencies, margins, IDs, tool names,
   durations, timestamps) — the ticket's own instruction was to keep the
   existing monospace unless IBM Plex Mono was "already available"; it
   isn't, so nothing changed there. `src/app/globals.css`'s
   `@theme inline { --font-sans: ... }` mapping was updated to point at
   `--font-plex-sans` (it still referenced the now-removed
   `--font-geist-sans` after the loader swap, which would have silently
   fallen through to the system fallback stack — caught before any
   verification, not left as a follow-up). Confirmed live via
   `getComputedStyle(document.body).fontFamily` returning
   `"IBM Plex Sans", ...` and by screenshot (both themes).

2. **Typography scale.** `src/lib/design/tokens.ts`'s `typography` export
   bumped to match the new spec: `pageTitle` from `text-xl`/`text-2xl`
   (20/24px) to `text-[22px]`/`text-[26px]` (target 22–28px),
   `sectionHeading` from `text-sm` (14px) to `text-base` (16px, target
   16–20px). `body`/`metadata`/`technical` were already inside spec and
   left unchanged. This is a shared token consumed by ~13 files
   (`PageHeader`, queue/recent-investigation sections, etc.), so the
   change cascades without per-file edits.

3. **Surface/color-ramp reconciliation.** `globals.css`'s three token
   blocks (light `:root`, OS-dark media block, explicit
   `[data-theme="dark"]`) were updated to the new numeric spec:
   - Light: canvas background moved from a cool `#f7f8fa` to a warm
     `#faf9f6`; card/popover stay white; secondary/muted/accent and
     borders retuned to warm neutrals (`#f1efe9`/`#e7e3db`) to match;
     `--muted-foreground` deliberately left at its existing cool
     `#667085` — the spec explicitly wants a warm canvas but a *cool
     neutral grey* for secondary text, so those two were not made to
     match each other.
   - Dark: background `#0d0f12` → `#18181a`, card (main surface)
     `#14171c` → `#1f1f21`, popover (elevated surface) `#181c22` →
     `#252527`, sidebar set a step darker than main (`#19191b`) rather
     than equal to it. `--border`/`--input`/`--sidebar-border` changed
     from flat hex to `rgba(255,255,255,0.09)` (spec: white @ 8–11%).
   - `--primary`/`--sidebar-primary` (cobalt/indigo, `#4f46e5` light /
     `#818cf8` dark) were **not** changed. The ticket asks to "use the
     exact accent extracted from Crado's real logo assets"; both
     `public/brand/crado-mark-black.png` and `-white.png` were checked
     with a pixel color-histogram (PIL `Image.getcolors()`) and are
     provably pure monochrome (black-on-transparent / white-on-
     transparent, zero non-grey pixels) — there is no brand hue in the
     asset to extract. The existing, already-verified cobalt/indigo
     accent from the prior revamp pass was kept, and this discrepancy is
     recorded here rather than silently complied with or silently
     dropped. A comment documenting this is now inline in `globals.css`
     next to `--primary`.

### Verification (this phase only)

- `pnpm exec tsc --noEmit` — clean.
- `pnpm run lint` — clean.
- Targeted unit tests (`theme-provider.test.tsx`, `resizable.test.tsx`,
  12 tests) — pass; these are the tests most likely to catch a
  theme/token regression.
- Live-verified in the running dev server: IBM Plex Sans confirmed via
  computed style and visually (both themes); dark surface ramp and warm
  light canvas confirmed by screenshot on `/investigations/new`.
- Not yet run this phase: full test suite, production build, or any
  breakpoint below desktop — deferred to the end of the full ticket per
  its own "Delivery sequence," not skipped.

### Deferred (remaining Turn-2 delivery-sequence steps, in order)

1. Global shell/sidebar rework (Workstream A): sidebar geometry against
   the new spec (244–264px expanded / 56–64px collapsed / 36–40px nav
   rows / 6px radius), a real "Recent investigations" list inside the
   sidebar itself (not just the composer page), collapse/keyboard/mobile
   Sheet behavior audit.
2. Homepage restructuring (Workstream B): whether the composer
   (currently `/investigations/new`) and the queue (currently
   `/investigations`) should become one page per the reference's
   single-page composition, "What needs attention?" framing, and the
   full required state set (loading/empty/first-investigation/populated/
   filtered-empty/error/partial).
3. Investigation workspace restructuring (Workstream C) — the largest
   remaining item: a genuine three-pane resizable split (Trace ~320–
   420px / Decision main / Inspector ~300–360px collapsible), full-height
   panes, versus the current two-pane layout with Trace embedded inline
   in the Decision scroll flow. Decision-view table/master-detail
   restructuring, Evidence-view table, Map/mobile-fallback re-check
   against the new compact-node spec.
4. Full responsive tier behavior (≥1024 / 768–1023 / <768, including
   Trace/Decision as top-level mobile tabs and no React Flow canvas on
   mobile) and a systematic accessibility/keyboard audit — not yet
   started this phase.
5. Full automated + live-browser QA at 1440/1280/1024/768/390 in both
   themes, the extensive ticket-specified checklist (sidebar modes,
   theme persistence, composer classification/confirmation, trace
   ordering/live-insertion/refresh-reconstruction, resizable panes, map
   containment, mobile fallback) — not yet started.
6. Final 14-item report per the ticket's mandated structure — withheld
   until the above are actually done; this entry is an honest interim
   checkpoint, not that report.

---

## 2026-09-04 (cont.) — Investigation workspace: persistent Trace pane (Workstream C, partial)

Continuation of the same session. This is the ticket's own "largest
structural improvement" item, scoped down to its single highest-value
piece rather than attempted whole: pulling the Investigation Trace out
of Decision's scrolling content and giving it a persistent, full-height
pane so it stays visible switching to Map/Evidence/Timeline/Sources —
not the full Decision-table/master-detail rebuild, trace-step
click-to-focus, or trace-pane-local composer relocation the ticket also
asks for (see "Deferred" below).

### What shipped

- `investigation-workspace.tsx`'s ≥1024px desktop layout changed from a
  two-pane split (canvas/tab-content 76% + ContextRail 24%) to a real
  three-pane `ResizablePanelGroup`: **Trace** (persistent, ~27% default/
  20-35% range, approximating the spec's 320-420px band) / **Decision-or-
  active-tab** (main, flexible) / **Inspector** (ContextRail, unchanged,
  24%/18-38%). `InvestigationTracePanel` is now mounted once outside the
  tab-switched content instead of once per tab body.
- `renderTabContent` gained an `includeTracePanel` boolean so the
  <1024px mobile-stack and tablet (no-persistent-rail) tiers keep their
  original behavior unchanged — Trace still renders inline inside
  Decision's content there, exactly as before this pass. Only the
  ≥1024px tier changed shape.
- A truthful empty state ("No trace yet. Run an investigation to see
  Crado's live agent activity here.") fills the pane before any run has
  happened, instead of an empty void — `InvestigationTracePanel` itself
  still returns `null` when there's nothing to show (untouched), so the
  empty-state text lives in the new wrapper, not the component.

### Verification

- `pnpm exec tsc --noEmit` / `pnpm run lint` — clean.
- 181/181 tests pass across the whole investigation folder (24 files);
  2 new tests added directly for this change (Trace renders exactly
  once and stays present across all 5 tabs; the empty-state text
  appears before any run).
- Live-verified in the running dev server on a real completed case: at
  1440px, Trace's full step list stays visible switching Decision ->
  Map (previously it would have scrolled away/disappeared, since it
  only existed inside Decision's own tab body); Inspector selection
  (clicking a canvas node) still populates correctly; at 900px (tablet
  tier) the original inline-collapsed trace summary is unchanged; both
  themes render the three panes correctly.

### Deferred (from this same Workstream C item)

1. Decision view is still the existing stacked-card layout, not the
   dense hypothesis table/master-detail the ticket asks for.
2. Evidence view not yet rebuilt into the specified table (item/
   classification/source/revision/config/applicability/citations/
   verification/added-by/updated).
3. Trace-step click-to-focus ("selecting a trace step focuses the
   affected workspace item") not implemented — steps aren't
   interactive yet.
4. The trace-pane-local composer (add observation/measurement/change
   from the bottom of the Trace pane itself) not implemented — the
   floating full-width composer is unchanged.
5. "Run/resume" is still per-tab inside `InvestigationControls`
   (duplicated across Decision/Investigation tab bodies), not hoisted
   into the compact contextual case header the ticket describes.
6. Responsive tiers below 1024px were deliberately left exactly as they
   were (not rebuilt to the ticket's mobile-tab-for-Trace/Decision
   spec) — out of scope for this pass, not silently dropped.
7. Homepage restructuring (Workstream B) not started this session.
8. Full accessibility/keyboard audit and live QA at every specified
   breakpoint (1280/768/390) not done this session — only 1440, 900,
   and (for the shell) 390 were spot-checked.

## Workstream C correction — flat Decision workbench (rejected-screenshot fixes, delivery-sequence items 1-7)

The Investigation result page was explicitly rejected after the prior
pass: the three-pane concept was accepted but the centre pane still
read as "the old card-based dashboard" (large Measurement card,
oversized deterministic card, stacked hypothesis cards, page-wide
floating composer, near-empty default Inspector, detached Run/
engineering-change actions). This pass replaces the centre pane's
information architecture — not just its border radii — with a dense,
flat operational workbench, strictly scoped to delivery-sequence items
1-7 (Decision view only; Evidence/Timeline/Map and the homepage are
explicitly deferred until this passes review).

### What shipped

- **Failure strip** (`failure-strip.tsx`, new) replaces the Measurement
  card: a single 88-112px row of compact stat cells (peak frequency,
  margin, selected limit, operating mode, revision) plus a small inline
  spectrum plot — no bordered/rounded card wrapper.
- **Investigation item table** (`investigation-item-table.tsx`, new)
  replaces both the deterministic-relationship card and the hypothesis
  card stack with one master table (Classification / Investigation item
  / Evidence summary / State / Updated by / Updated). Deterministic
  correlations render as `KNOWN` rows, ranked hypotheses (via the
  existing `rankHypotheses`) as `INFERRED` rows — no invented
  confidence percentages, no fabricated per-row timestamps (a
  correlation has no timeline representation at all and renders "—";
  a hypothesis's timestamp is looked up by title match against the real
  timeline and is "—" when no match exists, never guessed). Rows are
  keyboard-selectable (`role="button"`, Enter/Space) and drive the
  Inspector.
- **Pinned next-action bar** (`next-action-bar.tsx`, new) replaces the
  "Recommended Next Test" card: a 72-104px bar pinned below the table
  (outside its scroll region) showing the real leading hypothesis's
  `recommendedNextStep`/title, "Record result", and (relocated
  unchanged, not rewritten) the existing `RecordEngineeringChangeForm`
  trigger. Renders nothing when there's neither a leading hypothesis
  nor engineering-change history — never an empty bar.
- **Case header consolidation**: the standalone status-pill banner and
  detached Run button moved into the 48-52px contextual header
  (`agent-status-pill.tsx` rewritten from a bordered/tinted pill to
  compact text + a small semantic dot; `run-investigation-button.tsx`
  extracted and placed in the header's right slot alongside last-
  event-time text). A separate 44px toolbar directly below the header
  now holds the Decision/Map/Evidence/Timeline/Sources tabs.
  `investigation-controls.tsx` was reduced to only the failed-run/
  clarification/empty-result messages it now exclusively owns.
- **Composer relocated**: the page-wide floating composer is gone on
  the desktop tier; `CaseComposer` is now docked to the bottom of the
  Trace pane itself (mobile/tablet tiers keep their existing sticky-
  bottom composer, unchanged, since their layout doesn't have a
  persistent Trace pane to dock into).
- **Inspector collapsed by default**: `railCollapsed` now starts `true`
  (was `false`) — no more giant empty "CASE" panel on load. Selecting
  any correlation/hypothesis/measurement/citation now calls a new
  `expandInspector()` helper that both drives the resizable-panel ref
  *and* directly sets `railCollapsed`, so expansion is deterministic
  regardless of the panel library's internal resize timing (this
  double-update pattern was required to make the behavior reliably
  testable and is more robust in real browsers too).
- **Trace-step → workspace focus**: clicking a non-active trace step
  now calls `onSelectStep`, routed by an honest keyword match on the
  step label (measurement / hypothesis / deterministic-relationship)
  to either open the Inspector on the measurement or apply a transient
  1.2s highlight to the matching table row(s). This is deliberately a
  category-level routing, not a fabricated precise 1:1 step→row link —
  the wire schema has no structured data to support that, and the
  alternative (inventing one) would violate the no-fabricated-evidence
  rule. Documented as a known limitation in the code itself.
- `RailSelection` gained a `{ kind: "correlation" }` variant and
  `context-rail.tsx` a matching `CorrelationDetail` view; the rail's
  outer chrome was flattened from a bordered/shadowed card surface to
  a plain `border-l` panel, consistent with the "no card containers for
  static sections" rule.
- Panel sizing: Trace 27% (20-35% range) / Main 69% / Inspector
  collapsed-to-4% (18-30% expanded) — rebalanced to sum to 100 after
  raising Main's share to absorb Inspector's smaller collapsed default
  (a `react-resizable-panels` group whose `defaultSize`s don't sum to
  100 logs a normalization warning and can render unpredictably).

### Verification

- `pnpm exec tsc --noEmit` / `pnpm run lint` — clean.
- 185/185 tests pass across the investigation folder (25 files, up from
  181/24 — new files: `next-action-bar.test.tsx` plus rewritten
  `decision-view.test.tsx` and `investigation-workspace.test.tsx`
  covering the collapsed-by-default Inspector and the new table's row
  data/selection/ordering contracts).
- Live-verified in the running dev server on a real completed case
  (`CASE-4FA53E`, Gateway X Rev18):
  - **1440px, dark and light** — full target structure confirmed:
    compact header, 44px tab toolbar, persistent Trace with docked
    composer, flat failure strip, 2-row item table (KNOWN/INFERRED),
    "What Crado handled" metrics, pinned next-action bar, Inspector
    collapsed to a narrow rail by default. All of failure summary +
    correlations + hypotheses + recommended action visible without
    scrolling, as required.
  - **1280px, dark and light** — same structure holds; one minor
    non-blocking cosmetic issue noted (the failure strip's stat cells
    wrap the Revision cell to a second line competing with the
    spectrum-plot/actions cluster) — no clipping, overlap, or scroll,
    left as a deferred polish item rather than blocking on it.
  - **390px (mobile)** — re-verified no regression from the shared
    component changes (status pill, controls, trace panel): header,
    tabs, strip, table, metrics, and pinned action bar with composer
    all stack correctly with no overflow.
  - Row selection → Inspector: clicking an INFERRED row opens real
    "Hypothesis details" content and marks the row `data-state=
    selected`.
  - Trace-step → focus routing: clicking "Loaded measurement context"
    opens the Inspector on the real measurement; clicking "Checked
    deterministic relationships" applies and correctly clears (after
    ~1.2s, confirmed via timed re-checks) a transient highlight on the
    KNOWN row.
  - Manual Inspector collapse: confirmed the table recovers width.

### Deferred (explicitly gated — do not start until this section's items pass review)

1. Evidence/Timeline/Map tabs not yet adapted to the same flat
   workbench grammar (delivery-sequence item 8).
2. Homepage restructuring, Workstream B (item 9).
3. Responsive tiers below 1024px not rebuilt to the full ticket spec
   (item 10) — mobile/tablet composer intentionally left as-is.
4. Systematic accessibility/keyboard audit across every breakpoint
   (item 11) not performed this session; only spot-checks above.
5. The 1280px failure-strip wrap noted above.
6. Trace-step→row linking is honest category-level routing, not a
   precise per-item link — would need a schema change (a real
   step→artifact id) to do better.

## UX-06 — Enterprise authentication redesign

Isolated increment per the explicit override after `ea0ef25`: redesign
Sign in/Sign up (and their real recovery/verification states) to match
the approved application shell; do not touch Evidence/Timeline/Map or
the homepage in the same pass. Scoped strictly to what the current
Supabase auth implementation actually supports — nothing fabricated for
visual completeness.

### Baseline confirmed before editing

- HEAD was exactly `ea0ef25`, worktree clean.
- Auth provider: Supabase Auth, email + password only
  (`supabase.auth.signInWithPassword` / `.signUp`). No OAuth/SSO
  provider is configured (`supabase/config.toml`'s `[auth.external.*]`
  block: every provider present is `enabled = false`), no magic-link
  sign-in, no passkeys.
- Routes/handlers inspected: `src/app/login/page.tsx` +
  `src/app/login/actions.ts` (single page, two buttons — Sign in and
  Sign up sharing one form), `src/app/auth/confirm/route.ts` (exchanges
  a signup-confirmation `token_hash` for a session via `verifyOtp`),
  `src/lib/supabase/middleware.ts` (`src/proxy.ts` — Next 16 renamed
  `middleware.ts` — session refresh + private-route redirect to
  `/login?next=<path>`), `src/app/workspace/actions.ts`'s `signOut`.
- No forgot-password, no password-reset, no email-verification resend,
  no workspace-invitation system anywhere in the codebase (confirmed by
  grep — zero matches for `resetPasswordForEmail`, `reset-password`,
  `invitation`). No `/privacy` or `/terms` routes exist.
- `next`/`error` query params: `middleware.ts` already set `next` on
  its redirect, but `/login` never read either `next` or the confirm
  route's `?error=confirmation-failed` — both were silently dropped.
  Real gaps, not by design; fixed as part of this pass (see below).
- A DB trigger (`handle_new_user`, `20260831034622_workspaces.sql`)
  auto-creates a workspace on signup — "secure access to your
  engineering workspace" is truthful even for a signup-only account.

### What shipped

- **New `/signup` route** (was previously two buttons on one `/login`
  page). `src/lib/auth/actions.ts` (moved from `src/app/login/actions.ts`,
  now shared by both pages) keeps the exact same Supabase calls,
  session-presence check, and credential schema — provider, credential
  strategy and session model are all unchanged.
- **`src/lib/design/auth-shell.tsx`** — the shared two-region shell:
  a restrained Crado context pane (real logo, "Regulation, inside the
  engineering loop.", the three product principles, copyright — no
  Privacy/Terms links, since neither route exists) and a focused,
  card-free auth pane (theme control + contextual Sign in/Create
  account link top-right on desktop, compact top bar + short context
  sentence on mobile). Replaces the old floating premium card on a
  dot-grid canvas.
- **`src/lib/design/themed-mark.tsx`** — picks the real
  `crado-mark-{white,black}.png` asset by resolved theme (the context
  pane's surface actually flips light/dark, unlike the sidebar, which
  always uses the white mark).
- **Honest error mapping** (`src/lib/auth/map-auth-error.ts`, split out
  of `actions.ts` because a `"use server"` file may only export async
  functions): branches only on real `AuthError.status`/`.code`/`.name`
  values Supabase documents — rate limiting (429 /
  `over_request_rate_limit` / `over_email_send_rate_limit`), a
  retryable network/server failure (`AuthRetryableFetchError`), an
  unconfirmed email on sign-in (`email_not_confirmed`), a weak password
  on sign-up (surfaces Supabase's own policy message). Sign-in's
  `invalid_credentials` and sign-up's collision case both still use one
  generic message each — deliberately: Supabase's own anti-enumeration
  behavior (no distinguishing error, `identities: []` on a colliding
  signup) is what makes that correct, and adding a more specific branch
  would leak account existence.
- **`src/lib/auth/redirect.ts`** (`sanitizeRedirectTarget`) — every
  `next` value (from the proxy's redirect, the sign-in/up forms' hidden
  field, and `/auth/confirm`'s query string) now passes through this
  before reaching `redirect()`. Rejects anything but a same-origin,
  single-leading-slash path — absolute URLs, protocol-relative `//`,
  the `/\` backslash bypass, embedded control characters. `/auth/confirm`
  previously passed its `next` query param straight to `redirect()`
  unsanitized — a real open-redirect-shaped gap (low practical risk
  today, since Supabase only ever sets `next` from `emailRedirectTo`,
  currently unset — but sanitized as a scoped defect fix regardless,
  not a new feature).
- **Already-authenticated redirect**: both `/login` and `/signup` are
  now Server Components that check `auth.getUser()` and redirect to
  the sanitized `next` (default `/investigations`) before rendering
  the form at all — previously an authenticated visitor could still
  see the sign-in form.
- **Session-expiry signal**: `middleware.ts` now checks for a
  `sb-*-auth-token` cookie *before* calling `getUser()`
  (`hasSupabaseAuthCookie`) — if one was present but the user came back
  null, the redirect adds `&expired=1`, and `/login` shows "Your
  session has expired. Sign in again to continue." instead of the
  default supporting line. A visitor who was never signed in gets the
  honest default copy instead — this only fires when there really was a
  stale/invalid session cookie, live-verified against the real
  `sb-127-auth-token` cookie name.
- **`error=confirmation-failed`** (already set by `/auth/confirm` on a
  bad token, previously never displayed) now renders as a real error
  banner on `/login`: "That confirmation link is invalid or has
  expired. Sign in below, or create a new account to get a fresh one."
- **Password visibility toggle** (`src/lib/design/password-input.tsx`)
  — keyboard-operable (`aria-pressed`, live-verified via a real Tab +
  Enter sequence in the browser, not just a click), accessible name
  states the action ("Show password"/"Hide password").
- **Preserved entered email after a recoverable error** — a **real
  defect found via live QA**, not anticipated up front: React resets a
  form's uncontrolled fields once its `useActionState` action settles
  (documented React 19 behavior, "similar to a native form reset"), so
  the initial implementation silently cleared the email field on every
  server-side error. Fixed by tracking email as real component state
  instead of an uncontrolled field (password is deliberately left
  uncontrolled/cleared — never re-populate a submitted password).
  Caught live (typed real credentials, submitted, watched the field go
  blank), then reproduced in a unit test and fixed.
- **Fields limited to the real schema**: no name/company/phone field on
  sign-up (schema has none), no password-confirmation field (the
  existing single-`signUp`-call design never needed one), no forgot-
  password link on sign-in (no such route exists — a link would point
  nowhere).
- Typography/tokens/geometry: IBM Plex Sans (already global, untouched),
  existing semantic tokens only, 44px (`h-11`) inputs/buttons, `rounded-
  [6px]` controls, no card wrapper around the form, no gradients.

### Verification

- `pnpm exec tsc --noEmit` / `pnpm run lint` / `pnpm run build` — all
  clean. Production route list now includes `/signup` as its own
  dynamic route.
- Unit tests: 521/521 across 65 files (was 519 before this ticket's
  edits during the session, +new: `redirect.test.ts` (9),
  `map-auth-error.test.ts` (7), `middleware.test.ts` (5, mocking
  `@supabase/ssr` — first test file to do so in this repo),
  `sign-in-form.test.tsx` (7), `sign-up-form.test.tsx` (6)). One real
  test-writing lesson: a submit-button click is silently swallowed by
  jsdom's native HTML5 constraint validation if required fields are
  empty (no error thrown, the mocked action just never fires) — every
  submitting test now fills both fields first, matching the codebase's
  existing pattern in `record-engineering-change-form.test.tsx`. A
  second lesson: a `mockImplementation` promise that never resolves
  measurably leaked React's internal transition tracking into the next
  test in the same file — fixed by using a resolvable deferred and
  resolving it before each such test ends.
- Live QA (chrome-devtools MCP, real dev server, real local Supabase —
  no mocks), signed out via clearing the real `sb-127-auth-token`
  cookie (the sidebar's own "Sign out" menu item turned out not to
  reliably submit via CDP's synthetic click — a pre-existing UI
  quirk unrelated to this ticket, not investigated further since
  clearing the cookie directly is an equally valid signed-out state):
  - **1440 dark/light, 1280 dark/light, 768 dark(light checked)/light,
    390 dark/light** — Sign in and Sign up both screenshotted; flat
    two-pane desktop composition, single-column mobile tier below
    1024px, no horizontal overflow, no clipped footer/primary action at
    any size.
  - Real incorrect-credentials error: "Could not sign in. Check your
    email and password." — confirmed non-enumerating.
  - Real successful sign-up end-to-end: created a throwaway test
    account (`crado-auth-qa@example.com`), got a real session and a
    real auto-created workspace, landed on the genuine empty-state
    `/investigations` page — then **deleted the test account via the
    Supabase admin API** afterward (`auth.admin.deleteUser`), per
    CLAUDE.md's "do not create unnecessary production users" and "clear
    deletion path for pilot data."
  - Real duplicate-email sign-up attempt (the seeded
    `gateway-x-demo@crado.local`): generic "Could not create an account
    with those details." — confirmed it does not disclose the account
    exists.
  - Real expired-session banner: set a stale `sb-127-auth-token` cookie,
    navigated a private route, landed on `/login` with `expired=1` and
    the correct copy.
  - Real invalid-confirmation-link banner via
    `/login?error=confirmation-failed`.
  - Already-authenticated redirect: confirmed live before any other
    change was made (navigating to `/login` while signed in landed on
    `/investigations` instead of showing the form) — this was true
    before this ticket too; the new Server Component check makes it
    explicit and adds the same behavior to `/signup`.
  - `next` preservation live end-to-end: `/login?next=/cases/abc-123/…`
    → Create account → `/signup?next=/cases/abc-123/…` → Sign in →
    back to `/login?next=/cases/abc-123/…`, unbroken.
  - Password visibility toggle exercised via a real Tab + Enter
    keyboard sequence (not just a click), confirmed the field's `type`
    flips and back.
  - Zero console errors across every screenshot. One warning fixed
    during this pass: Tailwind's Preflight `img{height:auto}` fought
    `ThemedMark`'s explicit `height` prop, producing a next/image
    "width or height modified, but not the other" warning — fixed with
    an explicit inline `style={{ width, height }}` override; confirmed
    clean afterward. (The sidebar's own `Image` in
    `app-shell-chrome.tsx` likely has the same latent warning — out of
    scope for this ticket, not fixed.)

### Deliberately not fabricated (recorded as absent, per the ticket's own instruction)

1. **Forgot password / password reset** — no `resetPasswordForEmail`
   call or reset route exists anywhere in the codebase. No link, no
   page. Adding one is a real, reversible feature addition (Supabase
   supports it natively) but is new scope, not a redesign of something
   that exists — left for a future ticket rather than added unasked.
2. **Email-verification resend** — the "Check your email to confirm
   your account" state has no resend action; none existed before.
3. **Workspace invitations** (inviting org, inviter identity, intended
   email, role, expiry) — no invitation system exists in the schema or
   codebase at all.
4. **OAuth/SSO/magic-link sign-in** — no provider is configured
   (verified in `supabase/config.toml`); nothing shown.
5. **Privacy Policy / Terms of Service links** — no such routes exist;
   only the copyright text renders, not the two legal links the ticket
   asked for.
6. **Rate-limited state** — implemented and unit-tested
   (`map-auth-error.test.ts`), but not triggered live (would require
   spamming real sign-in attempts against a shared dev Supabase
   project's rate limiter — judged unsafe/disruptive for QA purposes).

### Deferred

- Evidence/Timeline/Map flat-workbench adaptation and the homepage
  restructuring remain untouched, per the ticket's explicit "do not
  start" instruction — this session did not touch either.
- A dedicated `sign-out` reliability check: the sidebar's "Sign out"
  menu item did not reliably submit when clicked via CDP's synthetic
  click during this session's QA (worked around by clearing the auth
  cookie directly). `signOut` itself (`src/app/workspace/actions.ts`)
  was not modified and is outside this ticket's scope (sidebar/global
  shell, not the auth pages) — noted here as a possible real UI defect
  worth a future look, not confirmed as one.

## UX-07 — Decision view, answer-first layout

A layout/information-hierarchy-only rework of the Decision surface —
no change to the Investigation Agent, the deterministic correlation
engine, the OBSERVED/KNOWN/INFERRED/MISSING evidence model, the DB
schema or any server action, the SSE transport/event types, or the
Map/Evidence/Timeline/Sources views' underlying data. Every surface
here still consumes the existing `WorkspaceState`/`TimelineEntry[]`
unmodified. Built per an approved Decision Sheet
(`docs/UX-07-DECISION-SHEET.md`) after its three open questions were
resolved by the requester.

### Why the tab count dropped from five to one page plus a Map toggle

The prior five-tab switcher (Decision/Map/Evidence/Timeline/Sources)
forced an engineer to click across surfaces to answer one question:
what should I do next? Evidence, History (Timeline) and Sources were
never destinations in their own right — they're support for the
Decision — so they became closed-by-default disclosures *inside*
Decision instead of peer tabs. Map is different: it's an alternate
*rendering* of the same reasoning objects Decision already shows (the
same correlation/hypothesis data as a graph), so it stays reachable
but as a local toggle next to what it renders, not a tab that competes
with Decision for being "the page." `view-switcher.tsx` was deleted
outright once nothing imported it.

### Why `investigation-item-table.tsx` was retired

It was built deliberately in a prior pass (see "Workstream C
correction — flat Decision workbench" above) in direct response to a
rejection of the old card-based dashboard. Without a stated reason a
future session would be tempted to rebuild the same table. The reason,
recorded here so that doesn't happen: **arithmetic and machine guesses
must not be rendered as siblings in one table.** A deterministic
frequency relationship (`40 MHz × 5 = 200 MHz`, checked by code) and a
model-generated hypothesis (labeled INFERRED, carrying its own
confidence band) are epistemically different kinds of statement — the
product's core distinction. Flattening both into rows of one table
with shared columns (Classification/Investigation item/Evidence
summary/State/Updated by/Updated) erased that distinction visually,
even though the underlying data already tagged them correctly. The
table is gone; the two kinds of object now render as two visually
distinct card types side by side (`reasoning-section.tsx`, new),
verified live in the browser (not just inferred from "it's not a
table anymore") — see the Condition B verification below.

Two columns the table carried had to be decided deliberately rather
than silently dropped:
- **State** (Verified / Leading-Plausible-Weakened-Unresolved) — kept,
  now rendered directly on each card (`CorrelationCard`'s new `State`
  row; `HypothesisCard`'s new `strength` badge, sourced from the
  existing `rankHypotheses`/`HypothesisStrength`, not a new
  calculation).
- **Updated by** (Deterministic check / Agent) — dropped deliberately.
  Once the two objects are their own visually distinct kind (different
  accent color, different typography, different iconography — see
  below), restating which mechanism produced the row is redundant with
  the whole point of the two-column split.

### What shipped

- **`reasoning-section.tsx`** (new): the two reasoning objects, side by
  side (`grid gap-4 lg:grid-cols-2`), with a "Reasoning" heading and
  the "View as map" toggle in the same row. Threads `focusedCategory`
  (set briefly by a trace-step click) into a highlight wrapper on
  whichever side it names.
- **`decision-view.tsx`** (rewritten): the whole page, top to bottom —
  `InvestigationControls` → `FailureStrip` (prose failure summary,
  moved here from a stat-cell grid) → `NextActionBar` (now rendered
  *inside* Decision, not by the parent) → `ReasoningSection` →
  `RevisionComparisonCard` (only when a real result exists) → a
  `border-t` block of `AdvancedDisclosure` rows: Evidence, History,
  Sources, and a new "What Crado checked" row that only exists once a
  run has actually finished (`!running && (agentActivity.length>0 ||
  agentMetrics!==null)`) — while a run is active the live Trace pane
  already covers the same ground, so showing both would risk drifting
  out of sync mid-run.
- **`failure-strip.tsx`** (rewritten): one prose sentence — `"{freq}
  MHz measured {margin} dB above/below the selected limit, with {mode}
  active."` — plus a second line (test type · revision · measured-when
  · Add measurement). The stored spectrum plot (a single peak + limit
  line, no real trace to draw) was removed from this surface per the
  approved Decision Sheet: at legible size it would occupy prime space
  restating two numbers the sentence already gives; at thumbnail size
  it would be illegible, which the ticket forbids anywhere. It moved,
  not vanished — `SpectrumChart` now renders inside `ContextRail`'s
  `MeasurementDetail`.
- **`next-action-bar.tsx`** (restyled, not restructured): promoted from
  a thin bottom bar with `truncate` classes to a large bordered/
  accented card, `text-xl`/`text-2xl` recommendation text, no
  `truncate` anywhere in its render path. Button order: Record result,
  then Record engineering change.
- **`advanced-disclosure.tsx`**: gained an optional `meta` prop
  (rendered after the label, e.g. "· 7 checks · 16.6s") — backward
  compatible, its own 4 existing tests untouched.
- **`correlation-card.tsx` / `hypothesis-card.tsx`**: gained
  `onSelect`/`isSelected` (whole card becomes the click target,
  replacing `HypothesisCard`'s old small "Details" text-link) and a
  `State`/`strength` field respectively, per the Condition C decisions
  above.
- **`investigation-trace-panel.tsx`**: gained `hideOwnToggle` so the
  copy nested inside "What Crado checked" doesn't render a second,
  redundant "View trace" button.
- **`investigation-workspace.tsx`** (rewritten): the five-way
  `InvestigationTab` type/state and its 40-44px toolbar row are gone,
  replaced by `MainView = "decision" | "map"`. The desktop branch keeps
  **one** `ResizablePanelGroup`, never re-keyed on `running` — the
  Trace panel/handle are the only pieces conditionally included as
  siblings; Main and Inspector keep stable `key`s so neither remounts
  (an earlier draft re-keyed the whole group on `running`, which would
  have remounted the live React Flow canvas — and its pan/zoom/
  Follow-agent viewport — every time a run started or ended; caught
  and fixed before this ticket's live QA pass, not after). `top-bar.tsx`'s
  `backLabel` changed from a duplicated `"Radiated emissions —
  {product} {revision}"` to the plain literal `"Back to case"`
  (criterion 1 — product/revision/case-ref/status each now appear
  exactly once, in the header itself).
- **Composer relocation — a real architectural change, not a layout
  tweak.** The composer used to live docked to the bottom of the Trace
  pane. Once the Trace pane became conditionally unmountable (present
  only while `isRunActive`), anything docked inside it would have
  disappeared and reappeared — and shifted position — every time a run
  started or ended. The composer was pulled out into a new
  `renderMainColumn()` footer shared by all three responsive branches
  (desktop/tablet/mobile), so it now lives at the bottom of the *Main*
  column, a sibling of Decision/Map content, never inside Trace. This
  was forced by Trace's new lifecycle, not chosen for its own sake.
- **Deleted**: `investigation-item-table.tsx`, `view-switcher.tsx` —
  both confirmed via `grep` to have no remaining real importers before
  deletion.

### Condition B — visual distinguishability, checked, not assumed

Live-verified in the browser, both themes, at 1440px on the seeded
Gateway X case: the deterministic card is a plain monospace equation
(`40 MHz × 5 = 200 MHz`) with a neutral/indigo left accent bar and no
color-coded sub-sections. The hypothesis card carries an orange left
accent bar, an orange "⚠ HYPOTHESIS 01 · INFERRED" label, and orange
section markers on its OBSERVED/KNOWN/INFERRED/MISSING bullets.
**Honest answer: yes** — with the text labels covered, a reader could
still tell the arithmetic from the machine guess by accent color,
typography (monospace numerals vs. prose) and iconography alone, not
just a different heading string.

## UX-07 correction — hypothesis and next-test rendering

Rejected on review: the layout order from the first UX-07 pass was
right, but the *rendering* read as a consumer AI product — glyphs,
colored pill badges, an oversized equation, italic prose, and (found
independently while reading the code before touching it) three real
content-assembly bugs. Rendering and content-assembly only, same
scope boundary as the original ticket; the Investigation Agent,
correlation engine, evidence model, schema, and SSE transport were not
touched.

### Content bugs fixed (not evidence-model changes)

1. **Duplicate KNOWN evidence line** — `validateAgentOutput`
   (`src/lib/agents/validate-agent-output.ts`) pushed a hypothesis's
   grounding fact into evidence once via its own correlation candidate,
   then again whenever the model's own `evidenceRefs` cited that same
   fact by id — both pushes were legitimate on their own, but together
   they produced "Product context: 40 MHz system clock" twice in one
   card. Fixed with a new `dedupeEvidence` helper
   (`src/lib/hypotheses/generate-hypotheses.ts`, by `category` +
   `description`), applied at the end of assembly in both
   `validateAgentOutput` and `generateHypothesesForMeasurement`
   (defensive there — no double-push exists in that path today, but the
   same rule should hold everywhere evidence is assembled). This is the
   exact issue MVP-10C's entry above deferred as "a note for a future
   prompt-tuning pass" — it was actually an assembly bug, not a model
   output quality issue. Live-verified: the case's pre-existing
   persisted hypothesis (created before this fix) still shows the old
   duplicate — fixing assembly code doesn't retroactively rewrite
   already-stored rows, which is correct — but a **freshly triggered
   run** on the same case produced a KNOWN section with the fact
   exactly once.
2. **"Why this test" removed entirely** (`hypothesis-card.tsx`) — it
   always reprinted the hypothesis's own INFERRED reasoning verbatim, a
   second copy of the same paragraph already shown above it in the
   Inferred section. The INFERRED section already says it; there is no
   separate "why" to state.
3. **Recommended next test no longer renders inside the hypothesis
   card** — it duplicated `next-action-bar.tsx`'s own pinned copy of
   `recommendedNextStep`. The pinned bar is now the single home for the
   recommended action anywhere on the page; asserted directly in
   `decision-view.test.tsx`'s promoted-recommendation test
   (`getAllByText(...).toHaveLength(1)`).

### Rendering changes

- **New fixed type scale**
  (`src/app/cases/[caseId]/investigation/reasoning-typography.ts`):
  card title 15px/500/1.4, body/evidence text 13px/400/1.55, section
  labels and the eyebrow 11px/500/uppercase/0.06em, technical values
  (frequencies, dB, equations) 13px monospace, next-test text 14px/400
  — applied literally, per the correction ticket's own "apply exactly,
  do not interpret" instruction. This is a deliberate step down from
  the first UX-07 pass's oversized equation (`text-2xl`/`text-3xl`)
  and headline-sized recommendation (`text-xl`/`text-2xl`,
  `next-action-bar.tsx`) — an engineering record reads its numbers,
  it doesn't shout them. The one named exception, left untouched as
  instructed: the failure-strip's peak-frequency/margin sentence
  (`failure-strip.tsx`) was not reduced — it's one flowing clause, so
  splitting it into two different sizes mid-sentence would have looked
  broken rather than restrained; the ticket's own exemption clause
  reads as "leave this line alone," not "shrink everything except two
  numbers inside one sentence."
- **Decoration removed**: the `●◆△○` per-category glyphs, the colored
  left border per evidence section, and the PLAUSIBLE/MEDIUM CONFIDENCE/
  candidate-relationship pill badges are gone from
  `hypothesis-card.tsx` and `correlation-card.tsx`. Each card keeps
  exactly one border — its own 2px outer accent (indigo-neutral for the
  deterministic card, amber for the hypothesis card) — nothing nested
  inside it is its own bordered/background box any more (the old
  NEXT INVESTIGATION block, a bordered box inside a bordered card
  inside a bordered pane, is simply gone along with bug 3 above).
  Confidence/strength/update-status and "Candidate relationship" are
  now plain uppercase text folded into each card's eyebrow line
  (`Hypothesis 01 · Inferred · Leading · High confidence · Unchanged` /
  `Deterministic relationship · Candidate relationship`) — a pill
  implied a precision the confidence band doesn't carry. Italic is gone
  from the INFERRED paragraph.
- **Evidence restructured as a two-column definition list**
  (`hypothesis-card.tsx`): fixed 96px label column, value column to the
  right, 8px row spacing within a section, 16px between sections, 16px
  card padding — all literal, per the ticket. Each value clamps via a
  new `ClampedText` component
  (`src/app/cases/[caseId]/investigation/clamped-text.tsx`, 2 lines for
  OBSERVED/KNOWN/INFERRED, 1 line for MISSING) with a "Show more"
  control that appears only when the text is long enough to plausibly
  need it — a character-length heuristic deliberately chosen over a
  ResizeObserver-based real layout measurement, since jsdom (the unit
  test environment) never performs real layout and a heuristic keeps
  the expand/collapse behavior genuinely unit-testable without an
  environment-detection hack. The hypothesis card's own container caps
  at `max-h-[320px]` (verified live via `getBoundingClientRect()` —
  exactly 320px on a card with enough evidence to need it, at both
  1440 and 1024); the header/title stay always visible above the cap,
  and the evidence list scrolls internally for any real overflow rather
  than clipping content with no way to reach it, or growing the card
  past its cap.
- **Buttons — one primary style, one secondary, both sentence case**,
  13px text, 32px height (`primaryButton`/`secondaryButton` in
  reasoning-typography.ts). The engineering-change trigger button
  (`record-engineering-change-form.tsx`) previously rendered its own
  already-sentence-case source text ("Record engineering change")
  through an `uppercase` CSS transform, which is what made it look like
  a different button system from "Record result" right beside it —
  removing the transform, not the text, fixed it. That file's own
  fields/flow were not touched (still explicitly out of scope);
  restyling its trigger button is a rendering-only change explicitly
  named as a defect in this correction ticket.
- **Overflow/clipping (acceptance criterion 2, explicitly called out as
  failing)**: shrinking the recommendation text from a headline size to
  14px removed the size pressure that caused it; `min-w-0`/`break-words`
  was also added defensively to the recommendation paragraph, its
  caption, and the button row so no container can clip a long label
  regardless of exact cause. Live-verified at 1440/1280/1024/768/390,
  dark and light: no truncated text anywhere, both buttons fully
  legible.

### Verification

- `pnpm run lint` / `pnpm exec tsc --noEmit` / `pnpm run build` — all
  clean. `pnpm test` 531/531 (four new: `dedupeEvidence` collapses two
  identical items into one, keeps two same-category-different-text
  items, preserves order; plus a `validateAgentOutput` regression
  reproducing bug 1 exactly). `pnpm test:integration` 62/62.
- Tests rewritten to the same standard as the original UX-07 ticket's
  own condition A: an assertion whose target moved must still fail if
  the guarantee breaks. `hypothesis-card.test.tsx`'s old "Hypothesis 03
  ... reuses the INFERRED reasoning as ... 'why this test'" test
  asserted the exact behavior this ticket removed — replaced with a
  test asserting the opposite (neither "Next investigation" nor "Why
  this test" render, and the INFERRED paragraph appears exactly once,
  not twice). `decision-view.test.tsx`'s promoted-recommendation test
  gained a `getAllByText(...).toHaveLength(1)` assertion it didn't
  need before (there was always exactly one *other* copy to worry
  about; now there's none).
- Live QA (chrome-devtools MCP, real running dev server, real seeded
  Gateway X case, no mocks): a genuine before/after pair captured by
  `git stash`-ing this ticket's changes, reloading, screenshotting the
  real pre-fix render, then popping the stash and confirming the
  working tree matched the post-fix screenshots already taken — sent to
  the user as files rather than only described. 1440 (dark + light),
  1280, 1024, 768, 390 all swept; a **fresh live run** (not the case's
  pre-existing persisted hypothesis) was triggered specifically to
  confirm bug 1's fix applies to newly-generated evidence, not just the
  unit test.
- **Human gate, answered honestly**: on the fresh run's rendering, yes
  — the failing frequency (200 MHz / 7.4 dB), the calculated
  relationship (40 MHz × 5 = 200 MHz), the leading hypothesis title, and
  the full recommended-next-test text are all visible together at
  1440px with no scrolling and nothing expanded. The clamped "Show
  more" controls only ever hide supporting detail (the INFERRED
  paragraph's later sentences, secondary MISSING items) — never the
  four facts the gate asks about.
- Not fixed, out of scope, noted plainly: the composer's placeholder
  still clips against SEND at 768px/390px (`case-composer.tsx`, a file
  this ticket did not touch, same as the original UX-07 entry already
  recorded).

### Condition A — real test impact, counted before editing

The Decision Sheet's own estimate ("two test rewrites") was flagged in
advance as almost certainly low, and it was: `decision-view.test.tsx`
went from 6 to 11 tests (full rewrite), and 16 existing cases in
`investigation-workspace.test.tsx` needed edits — 10 mechanical
(`{name:"Map"}` → `{name:"View as map"}`), 6 substantively rewritten
for the new disclosure/Trace-lifecycle behavior, plus 2 new tests
added. Every rewritten assertion was checked against the standard: it
must still fail if the underlying guarantee breaks. E.g. "never
duplicates the trace across the Map toggle or the disclosures" asserts
the trace is either exactly-one-present or fully-absent depending on
state (`queryByText(...).not.toBeInTheDocument()`), not merely
"present somewhere"; the not-truncated test asserts the `className`
itself doesn't match `/truncate/`, not just that the visible text
looks right in one snapshot.

### Verification

- `pnpm run lint` / `pnpm exec tsc --noEmit` / `pnpm run build` — all
  clean.
- Unit tests: 527/527 across 65 files. Integration tests: 62/62 across
  12 files.
- Live QA (chrome-devtools MCP, real running dev server, real seeded
  Gateway X case CASE-4FA53E, no mocks):
  - **1440/1280/1024/768/390, both themes** on the completed case:
    header deduplicated to one line; failure summary as prose with no
    spectrum thumbnail; the full 4-line recommended-next-test text
    rendered with no scroll/ellipsis at 1440 and remained fully
    visible (reflowing, never truncating) down to 390; "View as map"
    positioned beside "Reasoning", not in the header; both reasoning
    cards render correctly in light theme with the same visual
    distinction described above; all four disclosures (Evidence,
    History, Sources, "What Crado checked") start closed and, opened,
    render their real content (Sources correctly showed "0 documents
    available · 0 searches performed · 0 passages retrieved" rather
    than fabricating a count).
  - **"View as map"** toggle click-tested both directions: renders the
    existing `InvestigationCanvas` full-width with a working "Back to
    decision" return; the composer's docked position was identical
    before and after the toggle (screenshot-compared, not inferred).
  - **One live run** started against the real seeded case: the Trace
    pane rendered as a genuine separate left `ResizablePanel` (live
    checkmarked steps, "Working…" status) beside the Main column — not
    stacked inline — confirming the 3-pane desktop split is real. Once
    the run completed, the Trace panel unmounted and its content
    reappeared inside "What Crado checked" (verified fully expanded:
    itemized trace list + `AgentMetricsPanel`'s "What Crado handled"
    grid, both matching the completed run's real numbers). **The
    composer's `<form>` never moved** — same docked position, bottom
    of the Main column, confirmed present and unchanged before the run
    started, mid-run beside the Trace pane, and after completion once
    Trace unmounted.
  - Zero console errors observed across the pass.

### Not met / deliberately out of scope

- The composer's placeholder text visually clips against the SEND
  button at 768px and 390px. This is a pre-existing
  `case-composer.tsx` behavior — that file was never touched by this
  ticket (its scope boundary explicitly excludes the composer's own
  internals) — left as-is rather than fixed under a layout-only
  ticket.
- No other acceptance criterion from the ticket was found unmet during
  this live QA pass.

## UX-08 — hypothesis card, remaining corrections

Baseline assumption stated by the ticket was that PR #1
(`ux-07-decision-answer-first-layout`, containing the UX-07 correction
commit) was already merged into `main`. **It was not** — this was the
first real finding of the ticket, not a coincidence to route around
silently.

### Root cause: a merge-timing gap, not a dedupe bug

The ticket's item 1 speculated the shipped `dedupeEvidence()` fix was
"keying on the wrong field." It wasn't. `gh pr view 1` showed PR #1
merged at `05:09:55Z`; the UX-07 correction commit (`a5b8fda`,
containing `dedupeEvidence` and every other UX-07-correction change)
was authored and pushed at `06:41:03Z` — **after** the merge, onto a
branch whose PR had already closed. Confirmed directly:
`git log origin/main..origin/ux-07-decision-answer-first-layout` still
listed `a5b8fda` as absent from `main`, and
`git show origin/main:.../generate-hypotheses.ts` had no
`dedupeEvidence` at all. The fix was real, tested, and correct; it
simply never reached `main`. Recovered cleanly: cut a fresh branch
`ux-08-hypothesis-card-corrections` off a freshly-pulled `origin/main`,
then `git cherry-pick a5b8fda` (clean, no conflicts) — commit
`945b7bf`. Re-verified live against a **freshly triggered run** on the
seeded case (the stale persisted hypothesis still shows the old
duplicate, expected, since assembly-code fixes don't retroactively
rewrite already-stored rows): the KNOWN section now shows "Product
context: system clock — 40 MHz" exactly once.

### This ticket's own delta: full border-colour removal

The UX-07 correction had already removed the glyphs, pills, and italic
(items 3/4/6 of this ticket) and already rendered the four evidence
categories as a single ordered list (item 7) — verified present in the
cherry-picked code by direct grep before writing any new code, so no
changes were needed there. The one thing UX-07 correction had
deliberately kept — "one 2px accent bar on the outer card" (amber for
the hypothesis card, `border-l-warning`) — is exactly what this
ticket's item 2 says to remove, on the reasoning that colour on a card
border reads as a warning state the data doesn't carry, on top of a
glyph-free label and an eyebrow that already say what the card is.

- `hypothesis-card.tsx`: dropped `border-l-2 ${style.accent}` from the
  container class entirely. The card now takes only `surface.card`'s
  own uniform `border-border` on all four sides — identical treatment
  to the deterministic card. `artifact.hypothesis.accent` is no longer
  read anywhere in this component (kept as a doc-comment note, not
  deleted from the token file — `context-rail.tsx` still uses the
  broader `evidence`/`artifact` token set for other purposes, out of
  this ticket's scope).
- `correlation-card.tsx`: same removal (`border-l-2 ${style.accent}`,
  which was `border-l-muted-foreground`, never amber). Not literally
  named by the ticket text, but left in would have meant the two
  reasoning cards used two different border treatments for no
  remaining reason — a hypothesis card with a flat border sitting next
  to a correlation card that still had one colored edge reads as an
  inconsistency, not a deliberate distinction. Flattened for
  consistency; the two cards are told apart by their eyebrow text and
  internal structure (equation vs. evidence list), never by border
  colour, matching the ticket's own stated principle.

Items 3, 5, and the palette sweep were re-verified directly on this
pass, not merely assumed carried over: `grep -i` for `warning|amber`
and for hex literals (`#[0-9a-fA-F]{3,8}`) across both components
returns nothing live (only doc-comment prose mentioning "amber" as a
description of what was removed).

### New regression tests

Two tests added to each of `hypothesis-card.test.tsx` and
`correlation-card.test.tsx`: one asserts the rendered card's
`className` contains no `border-l-*` utility at all (not just "not
amber" — any single-sided accent border), the other asserts the full
rendered HTML contains no `warning`/`amber` class-name fragment, no
hardcoded hex colour, and no `●◆△○` glyph character, plus (on the
correlation card) that "Candidate relationship" carries no
`rounded-full` pill class. Sanity-checked as real regression coverage,
not tautological: `git stash push --keep-index` reverted only the two
component files back to their pre-UX-08 state while leaving the new
tests in place, ran the two test files, confirmed exactly the 4 new
assertions failed (border-l-warning / border-l-muted-foreground
present, "warning" string present in the amber-accent class), then
`git stash pop` to restore the fix and re-ran to confirm all 16 tests
in the two files pass again.

### No hosted deployment exists

The ticket's verification step asks for screenshots "on the hosted
deployment." Checked directly via the Vercel MCP tools before
asserting anything: `list_teams` found one team, `list_projects` for
that team returned zero projects; no `.vercel/project.json` or
`vercel.json` exists in the repo either. This matches `features.json`'s
MVP-16 ("Production deployment") already being `passes: false`. No
hosted deployment has been created for this pilot yet — verification
below was done against the real local dev server instead (chrome-
devtools MCP, no mocks, real seeded Gateway X case), which is the
closest available substitute, not a claim that a hosted check happened.

### Verification

- `pnpm run lint` / `pnpm exec tsc --noEmit` — clean.
- `hypothesis-card.test.tsx` + `correlation-card.test.tsx` run
  directly: 16/16 passing. (A full-suite run in the same pass showed
  one unrelated failure, `case-composer.test.tsx`'s observation-
  confirmation test, under `vitest run` with an unusual arg-passing
  invocation; re-run alone it passed 14/14 — a timing-sensitive test
  behaving differently under a different run mode, not a UX-08
  regression. That file was never touched by this ticket.)
- Live QA (chrome-devtools MCP, real dev server, seeded case
  CASE-4FA53E, no mocks), **1440 and 1280, both themes, before/after**:
  a genuine before pair was captured by stashing only the UX-08 delta
  (component files, not the cherry-picked UX-07-correction code),
  reloading, screenshotting the still-live amber-accented card, then
  popping the stash and reloading again for the after pair — both
  against the same freshly-generated hypothesis, not the case's older
  stale one. Confirmed visually at all four before/after pairs: the
  amber left border is present in every "before" shot and absent in
  every "after" shot; nothing else on the card changed (no glyphs,
  pills, or italics were present in either, confirming those were
  already fixed by the cherry-picked UX-07 correction rather than by
  this pass). The pinned "RECOMMENDED NEXT TEST" bar's own left accent
  is untouched — it belongs to `next-action-bar.tsx`, a different
  component outside both this ticket's named scope ("the hypothesis
  card... the NEXT INVESTIGATION block") and its correlation-card
  extension.

**Can a reader still tell OBSERVED from INFERRED at a glance with all
colour removed?** Yes, verified by looking at the actual screenshots,
not inferred from the code: each label sits alone in a fixed 96px left
column, uppercase, at a consistent row position, immediately followed
by its value in the same row — position and the word itself (four
short, distinct words: Observed/Known/Inferred/Missing) carry the
distinction, and every row reads as clearly at-a-glance in both themes
as it did with the amber border present. No follow-up weight/spacing
change is needed.

### Not met / deliberately out of scope

- No hosted-deployment screenshot exists, for the reason stated above
  (MVP-16 is not yet built). Local dev server verification was
  substituted and disclosed rather than left unstated.
- Every other acceptance criterion in the ticket was checked directly
  against the current code and found met.

## UX-09 — shell depth, sign-out, and the placeholder landing page

Three independent fixes, rendering/dispatch/token-only per the ticket's
own scope — no agent, engine, evidence model, schema, server action
body, SSE, or persistence change (the one server action touched,
`signOut`, keeps its exact original logic; only how it's invoked from
the client changed).

### 1. Placeholder landing page removed

`src/app/page.tsx` was an MVP-01 scaffold — "under construction…" prose
plus a manual "Sign in" link. Replaced its entire body with a pure
dispatcher: an async Server Component that calls `supabase.auth.getUser()`
and `redirect()`s to `/investigations` (signed in) or `/login` (signed
out). Nothing upstream already does this — `middleware.ts`'s own
`PUBLIC_PATHS` list keeps `/` reachable for a signed-out visitor
specifically so this component gets a chance to run, so the redirect
had to live here. `src/app/page.test.tsx` rewritten to match (mocks
`next/navigation`'s `redirect` and `@/lib/supabase/server`'s
`createClient`, asserts the right target per auth state) — the old
test asserted the scaffold heading, which no longer exists.

### 2. Sign-out did not complete — root cause found, not just patched

Confirmed live (chrome-devtools MCP, real local Supabase) before
touching anything: clicking "Sign out" with the pre-existing markup
left the user still on `/investigations`, still signed in — the menu
just closed. Root cause: `app-shell-chrome.tsx`'s account menu wrapped
the sign-out `<form action={signOut}>` around a `DropdownMenuItem
asChild><button type="submit">`. Radix's `DropdownMenuItem` closes the
menu (a Portal-rendered subtree) synchronously on select, in the same
tick a real click would otherwise let the browser use to dispatch the
form's native `submit` — a race the button sometimes loses. This
codebase had already independently identified and routed around the
same Radix quirk once before: `ThemeMenuControl` in the same file uses
plain `<button>`s instead of `DropdownMenuItem` specifically "so
Radix's select-to-close behavior doesn't fire" (pre-existing comment).
This is exactly the defect docs/PROGRESS.md's UX-06 entry left
unresolved ("did not reliably submit... a pre-existing UI quirk...
not investigated further").

Fix: `DropdownMenuItem`'s `onSelect` now calls the `signOut` server
action directly (`startTransition(() => void signOut())`), not via a
native form submission — a plain JS function call that doesn't depend
on the button still being attached to the document when it runs. No
`<form>` any more. `signOut` itself (`src/app/workspace/actions.ts`)
is unchanged: it already awaited `supabase.auth.signOut()` before
`redirect("/login")`, so cookie-clearing and the redirect were already
correctly sequenced — the defect was entirely in how the client
triggered it, never in the action's own logic.

Live-verified both ways, same seeded case, real browser clicks (not
just the unit test): reverted to the old `<form>` markup via `git
stash`, clicked Sign out — stayed on `/investigations`, still signed
in, confirming the bug reproduces exactly as reported. Restored the
fix, clicked Sign out — landed on `/login`; `document.cookie` no
longer contained `sb-127-auth-token`; navigating back to
`/investigations` afterward redirected to `/login?next=%2Finvestigations`
rather than rendering a stale page. All four of the ticket's item-2
checks confirmed this way, not assumed from reading the code.

New regression test (`app-shell-chrome.test.tsx`): opens the account
menu (Radix's trigger needs a real `pointerdown`+`pointerup`+`click`
sequence in jsdom, not a bare `fireEvent.click`, to actually open —
unrelated quirk, noted inline), clicks "Sign out", asserts the mocked
`signOut` was called. Sanity-checked honestly: this test passes
against BOTH the old and new markup under jsdom — jsdom's synchronous,
non-animated DOM updates don't reproduce the real-browser Portal-unmount
timing that causes the actual race, so it cannot serve as the sole
proof the fix works. The live browser reproduction above is the real
evidence; the unit test guards against a future regression back to the
`<form>` pattern, which is still worth having even though it can't by
itself demonstrate the race.

### 3. Sidebar tonal depth

`globals.css`'s own ramp comment already promised "sidebar a step
darker than main" — but the shipped dark-theme `--sidebar` (`#19191b`)
was numerically *lighter* than `--background` (`#18181a`), the exact
opposite of its own stated intent, and light theme's gap (`#f4f2ec` vs
`#faf9f6`, ~6 units) was too subtle to read as a separate surface.
Confirmed via `getComputedStyle` on `[data-slot="sidebar-inner"]`
(the element that actually carries `bg-sidebar`, not the outer
`[data-slot="sidebar"]` wrapper, which is transparent) vs.
`[data-slot="sidebar-inset"]` (`bg-background`) before touching
anything.

Only `--sidebar` moved, in all three places it's declared (bare
`:root`, the `prefers-color-scheme: dark` block, and the explicit
`[data-theme="dark"]` block) — `--sidebar-accent`/`-border`/etc. are
untouched, per the ticket's "use the existing --sidebar token, do not
introduce a new colour" instruction:
- Light: `#f4f2ec` → `#ece9df` (14/16/23 units darker than
  `--background`, up from ~6).
- Dark: `#19191b` → `#0e0e10` (10 units darker than `--background`,
  up from being 1 unit *lighter*).

No shadow, gradient, glow, or raised-card effect added — the existing
`border-sidebar-border` stays exactly as it was; tone alone now does
the separation the ticket asked for. Sidebar width, nav items, logo,
and the Recent list are untouched.

Verified with a genuine before/after screenshot pair (git-stash
technique, same as prior tickets) at 1440, both themes, on the real
`/investigations` page — the first attempt used a ~6-unit dark-theme
step, which held up numerically but read as visually indistinguishable
in an actual screenshot; widened to the values above before accepting
the fix as done, since "reads as a separate surface at a glance" was
the ticket's own bar, not just a nonzero delta.

### Root-route redirect logic (item 1) also live-verified locally

Signed out, visited `/` → landed on `/login` directly, no scaffold
render at any point. Signed in, visited `/` → landed on
`/investigations` directly.

### Hosted-deployment verification — honest split

The ticket asked for hosted verification specifically. The hosted
deployment does exist (`project-easy-company.vercel.app` — the prior
UX-08 entry's "zero Vercel projects" finding was checking a different
account than the one that owns this project; confirmed this time via
`gh api repos/.../deployments`, which shows `vercel[bot]` auto-deploying
Production on every push to `main` and Preview on every PR, most
recently for UX-08's merge commit).

- **Item 1's bug, confirmed live on hosted, unauthenticated**: visited
  `project-easy-company.vercel.app/` — the exact scaffold text ("The
  investigation workspace is under construction…") is live in
  production right now. This is the real target the ticket describes,
  not a stale local assumption.
- **Item 1's fix, item 2, and item 3 — NOT yet verifiable on hosted**:
  this PR has not merged, so the hosted deployment is still running
  UX-08's code; there is nothing there yet to verify. The signed-in
  checks (root route while authenticated, sign-out, sidebar depth)
  additionally need a real hosted session — the demo credentials
  (`gateway-x-demo@crado.local`) that work against local dev's Supabase
  instance (`127.0.0.1:54321`) do not exist in whatever Supabase
  project backs the hosted deployment (confirmed: "Could not sign in"),
  and no `.vercel/project.json` or other credential for that project is
  configured in this environment. Creating a fresh throwaway account
  against a real hosted Supabase project isn't done unilaterally per
  CLAUDE.md's "clear deletion path for pilot data" — deleting it after
  needs a service-role key this environment doesn't have.
- All three fixes were instead fully verified against the local dev
  server per the sections above, and item 1's specific bug was
  additionally cross-checked live against production itself. Once this
  PR merges (auto-deploys per the GitHub integration confirmed above),
  the hosted "after" checks the ticket asks for are straightforward to
  run — flagged to the user rather than skipped silently.

### Verification

- `pnpm run lint` / `pnpm exec tsc --noEmit` / `pnpm run build` — all
  clean.
- Unit tests: 537/537 across 65 files (new: 2 in `page.test.tsx`, 1 in
  `app-shell-chrome.test.tsx`). Integration: 62/62 across 12 files.
- Live QA (chrome-devtools MCP, real local dev server, real local
  Supabase, real seeded Gateway X case, no mocks) as detailed above for
  all three items, plus the hosted cross-check for item 1.

## UX-10 — Sign in and Sign up, enterprise layout

Layout, proportions, and type only, per the ticket — `signIn`/`signUp`
(`src/lib/auth/actions.ts`), `sanitizeRedirectTarget`, `mapAuthError`,
the expired/confirmation-failed banner logic, and both page.tsx server
components are all untouched. This is a chrome/composition change
around the same forms, not a new auth capability.

### What changed

- **`src/lib/design/auth-shell.tsx`** — rewritten. Was a full-bleed
  two-pane shell (context pane left, form right, UX-06). Now a floating
  container (`max-w-[1240px]`, `h-[88vh]`, `rounded-2xl`, soft shadow)
  centred on a `bg-secondary` page background, split 42/58 at `lg:`
  (1024px+): form on the left on `bg-card`, a 58%-wide product panel
  on the right, inset via its own padding wrapper and `rounded-xl`
  (12px). Below 1024px the split collapses to one column and the right
  panel (`hidden lg:flex`) is not rendered at all, not just shrunk.
  Owns the top bar (mark/wordmark left, theme toggle + switch button
  right — wording swaps `Don't have an account? Sign up` /
  `Already have an account? Sign in` by `mode`) and the bottom-left
  copyright line, both previously split across this file and the two
  form components.
- **`src/lib/design/auth-tokens.ts`** (new) — the ticket's literal
  type/control numbers in one place, the same pattern UX-07's
  `reasoning-typography.ts` established for a route-specific scale
  that shouldn't bend the shared `typography` object in `tokens.ts`:
  30px/500 heading, 14px muted supporting line, 13px labels/helper
  text, 44px/8px-radius inputs, and one primary button style
  (`bg-foreground`/`text-background` — near-black fill/white text in
  light theme, the automatic inverse in dark; the exact pairing the
  pre-UX-09 placeholder page's own button already used, not a new
  colour pairing).
- **`src/app/login/sign-in-form.tsx`**, **`src/app/signup/sign-up-form.tsx`**
  — switched to the new tokens; removed the trailing
  "New to Crado? Create account" / "Already have an account? Sign in"
  paragraph each form used to render below its button — that action
  now lives exactly once, in the shell's top bar, per the ticket's
  "Heading, one supporting line, email field, password field, primary
  button. Nothing else" instruction for the form block itself.

### Deliberately not built, and why (per the reference)

- **Google/Apple sign-in buttons + the "Or" divider** — no OAuth
  provider is enabled. Verified in `supabase/config.toml` before
  writing any code: `[auth.external.apple]` is explicitly
  `enabled = false`; Google has no `[auth.external.google]` section at
  all (not configured, not just off). Rendering either button would be
  a fabricated capability.
- **Language switcher** — no i18n exists anywhere in this app.
- **Privacy Policy link** — no `/privacy` route exists (same reasoning
  UX-06 already recorded for Terms of Service). The copyright line
  still renders on its own.
- **The reference's 3D isometric render** — replaced with real product
  content per the ticket's own instruction, not an icon/illustration/
  gradient-mesh substitute. Four rows, each a real string this app
  already produces (not written for this shell): the seeded Gateway X
  case's real leading-hypothesis title and its real composed failure-
  strip sentence (both live-observed on CASE-4FA53E during this
  ticket's own QA), `scripts/seed-gateway-x.mjs`'s `FAILURE_CASE_TITLE`
  constant, and `investigations/new/actions.ts`'s real `case_opened`
  timeline description. See `auth-shell.tsx`'s own comment for exactly
  where each line comes from — a real reader can go verify each one.

### A real defect found and fixed during this ticket's own QA

At exactly 1024px (the tightest point of the 42%-wide split column,
and one of the ticket's own five required breakpoints), the top bar's
"Don't have an account?" sentence plus the outlined switch button left
too little room for the CRADO wordmark, which rendered clipped to
"CR…". Not caught by unit tests (jsdom doesn't lay out real pixel
widths) — caught only by actually screenshotting 1024px, per the
ticket's own verification instruction. Fixed by hiding the prompt
sentence until `xl:` (1280px, where the wider split column has real
room for it); the switch button itself — the only part of that row
that performs an action — is never hidden at any width. Re-verified
via a fresh screenshot at 1024 after the fix.

### Test changes

- `sign-in-form.test.tsx` / `sign-up-form.test.tsx`: the two tests that
  queried the now-relocated "Create account"/"Sign in" link were
  rewritten to assert its absence from these components
  (`queryByRole(...)).not.toBeInTheDocument()`), not deleted — the
  guarantee those tests protected (the switch link exists, carries
  `next` correctly) still needs a home, so it moved with the element.
- `src/lib/design/auth-shell.test.tsx` (new) — the switch-link/`next`-
  preservation coverage that left the two form test files, plus tests
  asserting: no Google/Apple/`Or`/language-switcher/Privacy-Policy
  text renders anywhere in the shell; the four real product-content
  rows render verbatim. `switchHref` itself (already exported, now
  owned by this file) gets its own direct unit tests too.

### Verification

- `pnpm run lint` / `pnpm exec tsc --noEmit` / `pnpm run build` — all
  clean.
- Unit tests: 544/544 across 66 files (new: `auth-shell.test.tsx`, 9
  tests). Integration: 62/62 across 12 files. (One unrelated flaky
  test, `recent-investigations.test.tsx`, failed once under the full
  suite and passed cleanly alone and on a full-suite re-run — a
  pre-existing timing sensitivity in a file this ticket never touched,
  not a regression from this change.)
- Live QA (chrome-devtools MCP, real local dev server, real local
  Supabase, no mocks): `/login` and `/signup` screenshotted at
  1440/1280/1024/768/390, both themes (20 screenshots) — no horizontal
  overflow, no clipped text at any combination once the 1024px defect
  above was fixed, split correctly collapses to one column with the
  right panel absent (not just hidden-but-present) below 1024.
  Functional walkthrough against the new layout, all real, no mocks:
  bad credentials → non-enumerating "Could not sign in..." error,
  email preserved, password field cleared; duplicate email on sign up
  (the seeded `gateway-x-demo@crado.local`) → non-enumerating "Could
  not create an account..." error, email preserved; `next` survives a
  full round trip (`/login?next=/cases/…` → Sign up carries the same
  `next` → Sign in carries it straight back); password-visibility
  toggle exercised via a real Tab + Enter sequence, not a click (focus
  landed on the toggle, `aria-pressed`/label flipped, the field's
  value became visible); a real successful sign-up end-to-end
  (`crado-ux10-qa@example.com`, real session, real auto-created empty
  workspace, landed on the genuine empty-state `/investigations`) —
  then **deleted via the Supabase admin API** afterward, same as
  UX-06's own precedent, per CLAUDE.md's "clear deletion path for
  pilot data."

### Hosted-deployment verification — honest split, same as UX-09

This PR has not merged, so `project-easy-company.vercel.app/login`
currently still serves the pre-UX-10 two-pane shell (confirmed live —
"New to Crado? Create account" appears both top and bottom, the old
context pane is on the left) — there is nothing of this ticket's own
work to check there yet. The ticket's own functional walkthrough (bad
credentials, duplicate email, a real sign-up, `next` survival, the
keyboard password toggle) was instead run in full against the local
dev server, exactly as listed above, against the actual new layout —
the closest available substitute, not a claim that hosted verification
happened. Flagged rather than silently skipped, same as UX-09's own
disclosure.

## UX-12 — auth page redesign, ported from a supplied HTML reference

A follow-up ticket arrived mid-UX-11 explicitly discarding it ("Stop
the current auth page work. Do not continue UX-11... Discard the
in-progress layout") and supplying a complete, self-contained HTML/CSS
mockup as the new visual source of truth. UX-11's PR (#5) was closed
unmerged with an explanatory comment rather than merged and immediately
superseded; this ticket branches fresh off `main` (still at UX-10).

### What changed

- `src/lib/design/auth-shell.tsx` — rewritten from scratch. New header
  (logo left, "Don't have an account?"/"Sign up" — or the sign-up-mode
  inverse — right), a centred icon badge (`User`/`UserPlus` from
  lucide-react, already the app's icon library) above the form, and a
  right-hand marketing panel — all matching the reference's structure
  and proportions. `switchHref` kept as-is (same behaviour, same
  exported signature).
- `src/lib/design/auth-marketing-panel.tsx` (new) — the right panel:
  headline + supporting line, a connected "trace chain" of 4 node
  chips (an SVG dashed path + a drifting particle + gently breathing
  chips), and 3 status rows below. See "Content constraint" and
  "Colour mapping" below.
- `src/lib/design/auth-tokens.ts` — resized to the reference's own
  numbers: heading now `text-2xl font-bold`, centred; inputs/buttons
  now `rounded-xl` (was `rounded-[8px]`); new `authIconCircle` token
  for the badge. Every value still resolves through existing tokens.
- `src/app/login/sign-in-form.tsx` / `src/app/signup/sign-up-form.tsx`
  — one-line change each: the outer wrapper gained `w-full` (needed
  because it now renders inside `AuthShell`'s `items-center` column,
  which turns off the flex-column default stretch that previously kept
  it full width). No text, label, role, or structural change — every
  heading/label/button string these tests assert on is untouched.
- `src/app/globals.css` — one new, clearly-scoped block for the trace
  chain's decorative motion (`auth-trace-node`/`auth-trace-path`/
  `auth-trace-path-glow` keyframes), gated behind
  `prefers-reduced-motion: no-preference` using the exact same pattern
  the file's existing `.crado-rise`/`.crado-fade-in` block already
  uses. Explicitly commented as a one-off for this panel, same
  "deliberate, not reused elsewhere" rule the file's own
  `.crado-canvas-grid` comment already states.

### Colour mapping — every value ported to a token, none literal

The reference is a saturated blue-on-white/glass design
(`#407BF6` logo badge, a blue radial-gradient panel, white/opacity
glass chips). Mapped as follows, with no literal hex left anywhere in
the new files:

- The reference's `#407BF6` accent (logo badge, focus rings) →
  `--primary`/`--ring` — already the documented "cobalt: navigation,
  focus, selection, primary actions" token.
  - The marketing panel's blue fill → `bg-primary` (flat, not a
    gradient from white — see the code comment for why: a gradient
    that touches `--card` would put white/dark-card text on a near-
    white corner in light theme, breaking contrast).
  - The panel's white text/glass-chip overlays → `text-primary-
    foreground` and `bg-primary-foreground`/`border-primary-
    foreground` at low opacity — the token specifically designed for
    contrast against `--primary`, correct in both themes even though
    dark theme's `--primary` is a light periwinkle (so the panel
    becomes periwinkle-with-navy-text in dark mode, not indigo-with-
    white-text — a real visual shift between themes, but every colour
    is still the semantically-correct token pair, not an invented
    one).
  - The one green status dot → `bg-success` — CLAUDE.md's own
    "verified/pass/resolved/completed ONLY" token, used only for the
    row describing an actually-shipped, verified capability.
- The reference's `#F8F9FA` icon-badge fill / `#9CA3AF` icon stroke →
  `bg-secondary` / `text-muted-foreground` — no dedicated token for
  that exact hex, but same role (a quiet neutral fill).
- No literal colour value remains in any new/changed file.

### Content constraint — every marketing-panel string checked against real code

Not explicitly required by this ticket's own text, but continued from
UX-10/UX-11's standing discipline in this same file (and CLAUDE.md's
"product plans are not shipped capability" / no-invented-claims rule):
- Node 1 "Revision → Rev17": the seeded Gateway X case's real revision
  label (`scripts/seed-gateway-x.mjs`), same fixture UX-10/UX-11 used.
- Nodes 2-4 ("Logged"/"Linked"/"Recorded"): honest generic status
  words for real schema relationships (Measurement/EvidenceItem/
  InvestigationEvent), not a specific live metric. Deliberately NOT
  "Approved" (the reference's own word for its 4th node) — Crado
  records engineering decisions, it does not issue a compliance
  approval; a new `auth-shell.test.tsx` test asserts "approved" never
  appears anywhere in the shell.
- The 3 status rows: "Deterministic checks kept separate from AI
  inference" is a real, verified-this-session architectural fact
  (`harmonic-correlation.ts`/`compare-measurements.ts` are plain
  deterministic TypeScript; hypothesis generation is the separate,
  explicitly-labelled inferred step) — exactly the OBSERVED/KNOWN/
  INFERRED/MISSING split CLAUDE.md requires. The other two describe
  real, shipped schema relationships, not a specific live number.
- No "trusted by", logo, testimonial, or specific unverified metric
  anywhere in the panel.

### What was removed from the reference, and why

- Google/Apple sign-in buttons + the "Or" divider — no OAuth provider
  is enabled (`supabase/config.toml`: Apple explicitly
  `enabled = false`, Google not configured at all).
- The "By continuing, you acknowledge [...] Privacy Policy" line — no
  `/privacy` route exists (same reasoning UX-06/UX-10 already
  recorded for Terms of Service).
- The language switcher ("ENG" menu) — no i18n in this app.
- The reference's single-field, placeholder-driven, passwordless-
  shaped "Login with Email" form — replaced with the real Email +
  Password form this product actually has (both fields wired to the
  real `signIn`/`signUp` server actions), per the ticket's own
  instruction.
- The demo-only button spinner/success choreography and the aria-live
  feedback caption — theatre for buttons that no longer exist (OAuth)
  or that already have a real pending state (`useActionState`'s own
  "Signing in…"/"Creating account…").
- The reference's orbiting glow ring, blurred horizontal scan sweep,
  and 3D-transformed isometric grid on the marketing panel — kept the
  connected trace-chain (path + particle + breathing chips) as the
  clearest visual expression of "traceability," dropped the rest as
  embellishment beyond what "match visually" needs. The grid
  specifically was also live-verified to make headless screenshot
  capture hang (`backdrop-blur` + a perspective transform + a blend
  mode is expensive enough to composite that a `Page.captureScreenshot`
  call timed out until it was removed) — not worth keeping for a
  purely cosmetic texture.
- No on-page theme toggle — the reference never had one either; this
  page is still fully theme-aware via the existing stored/system
  preference, just with no manual switcher control on this page.

### A real defect found and fixed during this ticket's own QA

At exactly 768px (the reference's own show/hide breakpoint for the
marketing panel, `md:flex`) the header's "Don't have an account?"
prompt sentence plus the "Sign up" button left too little room for the
CRADO wordmark, which rendered clipped to "C" — the same class of
defect UX-10 found at its own (different) tightest breakpoint. Fixed
by hiding the prompt sentence until `lg:` (1024px); the switch button
itself is never hidden at any width. Re-verified via a fresh 768px
screenshot after the fix.

### Test changes

- `src/lib/design/auth-shell.test.tsx` — rewritten: dropped the old
  UX-11 investigation-chain-specific assertions (that design was
  discarded), kept every switchHref/prompt/copyright/no-OAuth-or-
  Privacy assertion, and added coverage for the new marketing-panel
  content (headline, all 4 node values, the deterministic-checks
  status line) and the "never says approved" guard.
- `sign-in-form.test.tsx` / `sign-up-form.test.tsx` — unchanged
  assertions; both still pass unmodified since no text/role/label the
  tests query moved.

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build` —
  all clean.
- Unit tests: 545/545 across 66 files.
- Live QA (chrome-devtools MCP, real local dev server, real local
  Supabase, no mocks) against the actual new layout:
  - Bad credentials → non-enumerating "Could not sign in..." error,
    email preserved, password field cleared.
  - Duplicate email on sign up (the seeded
    `gateway-x-demo@crado.local`) → non-enumerating "Could not create
    an account..." error, no disclosure the account exists.
  - `next` survives a full round trip: `/login?next=/cases/abc/
    investigation` → Sign up link carries the same `next` → Sign in
    link carries it straight back.
  - `/login?error=confirmation-failed` → the real banner renders.
  - Password toggle exercised via a real Tab + Enter sequence (not a
    click) — focus landed on the toggle, `aria-pressed`/label flipped,
    the field's value became visible.
  - Two real end-to-end flows, each with a fresh throwaway account
    created via the real form and deleted afterward via the Supabase
    admin API (same precedent as UX-06/UX-10): (1) sign-up → real
    session, real auto-created empty workspace, landed on
    `/investigations`; confirmed the deleted account's session is no
    longer recognized (revisiting `/signup` showed the form again, not
    an already-authenticated redirect). (2) sign-up → real sign-out via
    the app's own account-menu control → sign back in with the same
    credentials → landed on `/investigations` again, proving the
    sign-in path independently of the sign-up path.
  - Screenshotted `/login` and `/signup` at 1440/1280/1024/768/390,
    both themes.

### Hosted-deployment verification — not yet applicable

This PR has not merged, so `project-easy-company.vercel.app` still
serves the pre-UX-12 (UX-10) shell — nothing of this ticket's own work
to check there yet, same disclosure pattern as UX-09/UX-10. All
screenshots and functional checks above are from the local dev server
and a live local Supabase instance.

## UX-13 — auth pages rebuilt against a supplied reference screenshot

### What superseded what

A UX-12-corrections ticket (right-panel colour → pale blue, restore the
theme toggle, fix the overlapping flow diagram, re-confirm the sign-up
helper text against `credentials.ts`) was mid-flight, uncommitted, when
this ticket arrived with an attached reference screenshot and said the
current build "does not match the design" — rebuild against the
reference exactly. The corrections work was discarded via
`git checkout -- <files>`, not merged or partially kept; this ticket
branches fresh off `main` (still at UX-12/PR #6's merged state).

### Light-only, for real this time

The discarded corrections pass would have restored the on-page theme
toggle. This ticket removes it again and goes further: "These pages
are light only" is now an architectural property, not a default. Every
colour `/login` and `/signup` use resolves through new `--auth-*`
custom properties (`globals.css`), defined once in bare `:root` and
never redefined inside the `prefers-color-scheme: dark` or
`[data-theme="dark"]` blocks — so nothing on these two pages can follow
a visitor's OS dark preference or a previously stored dark choice the
way simply deleting the toggle button would have left possible. Live-
verified by forcing the emulated OS colour scheme to dark and
reloading both pages: identical, fully light render either way.
`auth-shell.test.tsx` asserts no control with an accessible name
matching `/theme/i` exists.

### Left region

White background, full height. Top bar: Crado mark (`ThemedMark`) +
"CRADO" wordmark left; "Don't have an account?" / Sign up button right
on `/login`, the sign-up-mode inverse on `/signup`. Centred form block,
max-width 400px: a rounded icon tile (`User`/`UserPlus`, lucide-react —
unchanged from UX-12) above a 30px/600-weight heading, one muted
supporting line, Email then Password (existing visibility toggle,
unchanged behaviour), a full-width black-fill white-text primary
button. Footer: copyright only, bottom-left.

### Right panel — rebuilt, not patched

- **Gradient**: diagonal (135deg), mixed from the app's existing
  `--primary` (#4f46e5) toward white via `color-mix` at three
  increasing strengths (4% / 32% / 56%) — light at the top-left corner,
  deeper toward the bottom-right, per the reference. Not a new hue.
- **Grid texture**: a flat 2D pattern — two crossed
  `repeating-linear-gradient`s, no 3D transform, no `backdrop-filter`,
  no blend mode. UX-12's isometric attempt (a perspective transform +
  backdrop-blur + `mix-blend-mode: overlay`) was live-verified to make
  headless screenshot capture hang on compositing cost; this shape was
  chosen specifically to avoid recreating that.
- **Pill badge**: "ENGINEERING ASSURANCE · CONTINUOUS TRACEABILITY",
  dark text on a frosted chip, top of the panel.
- **Headline/supporting line**: dark near-black text
  (`--auth-foreground`), positioned in the pale top-left zone where
  dark text has good contrast — unlike UX-12's `text-primary-
  foreground` (always light), which only worked because that panel was
  a flat saturated fill.
- **Node diagram**: same 4 values UX-12 already fact-checked (Rev17 /
  Logged / Linked / Recorded — deliberately not "Approved"), now
  **centre-anchored** via percentage `left`/`top` plus
  `-translate-x-1/2 -translate-y-1/2`, not edge-anchored via
  `left-0`/`right-0` the way UX-12's nodes were. A box that grows to
  fit its own label (e.g. "MEASUREMENT") now grows symmetrically around
  a fixed centre point instead of extending in one direction toward a
  container edge — the actual mechanism of the clipping/overlap defect
  the (discarded) corrections ticket had reported. The connector is a
  single dashed SVG curve drawn *before* the node chips in DOM order,
  so it passes visually behind them without an explicit z-index; two
  small circles along the curve serve as decorative glow waypoints.
- **Status rows**: the same 3 fact-checked sentences UX-12 verified,
  each now with a right-hand "Verified" chip in addition to the left
  dot — a uniform, honest static label, not the reference's fabricated
  live "Tracing…/Done" status theatre, since these describe already-
  shipped, tested capabilities rather than something computed per
  visitor.

### A real legibility defect found and fixed during this ticket's own QA

The first pass's node index/label/value text used `--auth-panel-line`
(white) at 60–75% opacity. A live 1440px screenshot showed "01
REVISION" and "02 MEASUREMENT" nearly illegible against the paler end
of the gradient — not a hypothetical, an actual defect visible in the
capture. Fixed by switching node text to `--auth-foreground` (matching
the pill badge's already-legible dark-on-frosted-chip treatment) and
raising the chip's own background/border opacity (0.16→0.32,
0.32→0.5). Re-verified via a fresh screenshot: all four nodes clearly
readable.

### The panel's new breakpoint

The marketing panel is now hidden below **1024px** (`hidden lg:flex`),
raised from UX-12's 768px threshold, per this ticket's explicit
requirement that "below 1024 the panel is hidden and the form fills
the viewport." Live-verified at 1023px (panel gone, form fills the
full viewport width) and at 1024px (panel present, no clipping) — the
narrowest width the diagram now has to survive is 1024px, not 768px.

### Reference elements deliberately not built, and why

- Google/Apple sign-in + "Or" divider — no OAuth provider is enabled
  (`supabase/config.toml`: Apple explicitly `enabled = false`, Google
  has no section at all).
- The language switcher ("ENG") — no i18n exists in this app.
- The Privacy Policy link — no `/privacy` route exists (same reasoning
  as UX-06's Terms of Service omission).
- The reference's single-field, passwordless-shaped form — replaced
  with the real Email + Password form already wired to `signIn`/
  `signUp`; this product has no magic-link flow.
- The reference's blue "+" tile mark — replaced with the real Crado
  mark via `ThemedMark`.
- The on-page theme toggle — removed per this ticket's own "these pages
  are light only" instruction (it had been restored by the now-
  discarded corrections pass).

### Password helper text vs. schema — re-confirmed, no change needed

`credentialsSchema`'s password rule is still
`z.string().min(8, "Password must be at least 8 characters.")`; the
sign-up form's own helper text is `"At least 8 characters."` — already
consistent, same finding UX-12-corrections had already made before
being discarded.

### Files changed

- `src/app/globals.css` — new frozen `--auth-*` tokens (bg/foreground/
  muted/border/tile-bg/primary/panel-from/via/to/grid-line/line/
  node-bg/node-border/row-bg/row-border), registered in `@theme
  inline`; `.auth-panel-grid` (flat 2D diagonal grid); replaced UX-12's
  `.auth-trace-path-glow`/`.auth-trace-particle` animation classes with
  `.auth-trace-path`/`.auth-trace-glow` (dash + pulse) matching the new
  curve-plus-waypoints diagram.
- `src/lib/design/auth-tokens.ts` — rewritten: every export now reads
  the frozen `--auth-*` tokens instead of the theme-reactive ones;
  `authIconCircle` replaced with `authIconTile`; new `authFocusRing`.
- `src/lib/design/auth-shell.tsx` — rewritten: always-white shell, no
  theme toggle, icon tile, 1024px panel breakpoint.
- `src/lib/design/auth-marketing-panel.tsx` — rewritten: diagonal
  gradient + grid, pill badge, dark headline, centre-anchored nodes
  with a behind-nodes curve and glow waypoints, status-row chips.
- `src/app/login/sign-in-form.tsx`, `src/app/signup/sign-up-form.tsx`,
  `src/lib/design/password-input.tsx` — one import/classname swap each
  (`focusRing` → `authFocusRing`, and `password-input.tsx`'s hover/
  text colours) to the frozen equivalents; no label/role/behaviour
  changed.
- `src/lib/design/auth-shell.test.tsx` — kept every UX-12 assertion,
  added 2: the pill badge text, and the absence of any theme-toggle
  control.

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build` —
  all clean.
- Unit tests: 547/547 across 66 files (+2 in `auth-shell.test.tsx`;
  `sign-in-form.test.tsx`/`sign-up-form.test.tsx`/`redirect.test.ts`/
  `map-auth-error.test.ts` all pass unmodified).
- Live QA (chrome-devtools MCP, real local dev server) against both
  pages:
  - Screenshotted at 1440, 1280, 1024, 1023, 768, 390 — no clipped
    text in any diagram node at any width, connector never crosses a
    node, panel correctly present/absent either side of the 1024px
    line.
  - Forced OS `prefers-color-scheme: dark` and reloaded — both pages
    render identically light; confirms the frozen-token approach
    actually works, not just that the toggle is gone.
  - `/login?error=confirmation-failed` → the real banner renders.
  - Password toggle exercised via a real Tab + Enter sequence (not a
    click) — focus landed on the toggle, the field's value became
    visible, the eye icon flipped.

### Hosted-deployment verification — not yet applicable

This PR has not merged, so `project-easy-company.vercel.app` still
serves the pre-UX-13 shell — nothing of this ticket's own work to
check there yet, same disclosure pattern as UX-09 through UX-12. All
screenshots and functional checks above are from the local dev server.

## UX-14 — right panel matched exactly to the supplied reference HTML file

### Why this ticket exists

UX-13 built the right panel from a *screenshot* of a reference design
and approximated by eye: a single 135deg linear gradient instead of the
reference's actual two-layer radial gradient, centre-anchored nodes on
a hand-derived curve instead of the reference's own edge-anchored
coordinates and cubic-bezier path, and a uniform "Verified" chip
instead of the reference's per-row state treatment. This ticket
supplied the *HTML file itself* and asked for literal fidelity — "Take
gradient stops, node coordinates, the SVG path, glow values, animation
timings and easing from it directly. Do not re-derive them by eye."
Method followed accordingly: every value below was read from the
file's CSS/markup and copied, not eyeballed from a render.

### Colour

`.auth-panel-gradient` (globals.css) replaces UX-13's linear-gradient
approximation with the reference's own composition, copied verbatim:

```css
background:
  radial-gradient(circle at 70% 46%, rgba(37,99,235,.2), transparent 28%),
  radial-gradient(circle at 18% 10%, #fff 0%, #e8f0ff 24%, #9bbcff 58%, #275ee9 100%);
```

The second gradient's centre sits near the panel's own top-left
corner — that's the actual mechanism behind "light, almost white at
the top left, deepening to a medium blue at the bottom right"; a
corner-anchored radial reads as a diagonal across any rectangular
viewport without needing a literal 135deg linear gradient. Not turned
into new `--auth-panel-*` custom properties: nothing else in the app
reuses this exact two-layer radial combination, so it's a plain,
well-commented CSS class instead of more indirection.

### Node layout and connector

The four nodes now sit at the reference's literal edge-anchored
coordinates — `left:0/top:52%`, `left:23%/top:1%`, `left:54%/top:58%`,
`right:0/top:8%` — inside a container inset 8%/7% from the panel's own
edges (`absolute left-[8%] right-[7%] top-[42%] h-[230px]`), which is
the reference's own mechanism for keeping edge-anchored boxes off the
panel boundary — not UX-13's centre-anchoring fix, which solved a
different, now-superseded layout's clipping problem. Connected by the
reference's literal path
(`M38 152C132 152 120 66 218 66s92 101 190 101S514 82 660 82` in a
`0 0 700 230` viewBox) with its own linear-gradient stroke, a
blur-filtered glow underlay, and a travelling particle
(`animateMotion`). A rotating double-ringed marker (the reference's own
`.trace-orbit`) sits near the curve's midpoint — this is what the
ticket called "a larger ringed pulse marker."

### A real hang defect found and fixed during this ticket's own QA

Porting the reference's `trace-scan` light-sweep literally — animating
the CSS `left` property on an element under a `blur()` filter —
reproduced the exact class of defect UX-12's isometric grid caused:
`take_screenshot` hung past 120s at 1280px, confirmed live (not
assumed) by capturing it happening, then isolating the sweep animation
before touching anything else. `left` is a layout property; the
browser must reflow every frame it changes, and doing that under a
blur filter compounds the cost. Fixed by converting *only* this one
animation to `transform: translateX` (composited, no layout cost) —
same visual sweep, same opacity ramp, no reflow. Re-verified with
repeated screenshot captures at 1280/1440/1024: fast, no hang, every
time.

### Node content

| Node | Reference | Built | Why |
|---|---|---|---|
| 01 Revision | R-184 | **Rev17** | Ticket's own instruction: keep the real Crado value. |
| 02 Measurement | Verified | **Verified** | Matches — honest, non-regulatory status word. |
| 03 Evidence | Linked | **Linked** | Matches — already Crado's real value. |
| 04 Decision | Approved | **Recorded** | NOT carried over — an approval claim crosses CLAUDE.md's compliance-verdict boundary ("Crado records engineering decisions, it does not issue compliance sign-off"), already refused twice (UX-12, UX-13) with a standing regression test (`auth-shell.test.tsx` asserts "approved" never appears). |

### Status rows

Kept the reference's exact visual treatment — one pulsing "active" row,
settled rows, the last visually faded — but not its literal copy. The
reference's own faded row is labelled a faded "Done," which is
internally inconsistent (faded to imply "hasn't happened" while still
saying it has); relabelled honestly as "Pending" instead, which also
happens to be literally true product-wide (a case has no recorded
decision until an engineer records one). The three row sentences are
unchanged from UX-12/13 — already fact-checked against real
architecture. A new test guards against the reference's literal
"Tracing…" wording specifically, on the same reasoning as the
"approved" guard: an anonymous, signed-out visitor has no case and
nothing is actually being traced for them.

Separately: Tailwind's own `animate-pulse` utility (used for the active
row's dot) isn't reduced-motion-gated by default. Replaced with a
dedicated `auth-status-pulse` class inside the same
`prefers-reduced-motion: no-preference` block as every other animation
in this file, so "gate all of it" actually holds for every animated
element, not only the ones original to this file.

### Logo fix

The Crado mark was invisible on both pages. Root cause: `AuthShell`
rendered it via `ThemedMark`, which reads the app's *global* theme
(`useTheme().resolved`) and picks white-on-dark or black-on-light —
correct for a surface that follows the app theme, but these pages
explicitly don't (UX-13: "light only"). A visitor with a stored or
OS dark preference got the *white* mark on this page's frozen-*white*
background: invisible, confirmed live by forcing the OS colour scheme
to dark and reloading.

Fixed at the root, not patched: `ThemedMark` had no other consumer in
the whole app (verified by grep), so it was deleted rather than
special-cased with a new prop — a theme-following component was never
the right tool for a surface that has opted out of theming. `AuthShell`
now renders `crado-mark-black.png` directly and unconditionally, the
same pattern `app-shell-chrome.tsx`'s sidebar already uses for its own
always-dark surface. Size bumped from 18×21 to 20×23 to match that
sidebar's own established size, per the ticket's "confirm ... renders
at a legible size."

### Files changed

- `src/app/globals.css` — new `.auth-panel-gradient` (the reference's
  two-layer radial background); replaced the old dash/pulse keyframes
  with 5: dash (-240, was -280), glow-pulse (peaks .6, was .4),
  node-breathe, scan-sweep (transform-based, see above), orbit-spin;
  new `auth-status-pulse` keyframe/class; removed the now-unused
  `--auth-panel-from/via/to/line/node-bg/node-border/row-bg/row-border`
  tokens (and their `@theme inline` registrations) — the new
  implementation uses literal `white/[x]` Tailwind utilities directly,
  matching the reference's own literal-utility style, rather than a
  layer of semi-abstracted tokens nothing else reuses.
- `src/lib/design/auth-marketing-panel.tsx` — rewritten: reference's
  literal gradient class, node coordinates/content, SVG path/gradient/
  glow-filter/particle, orbit ring, scan sweep, and per-row status chip
  treatment.
- `src/lib/design/auth-shell.tsx` — logo fix (direct black-mark
  `Image`, no `ThemedMark`); no other change.
- `src/lib/design/themed-mark.tsx` — deleted (no remaining consumer).
- `src/lib/design/auth-shell.test.tsx` — node-02 assertion updated
  (Logged → Verified, now via `getAllByText` since "Verified" also
  appears as a status chip); 2 new tests (mark src is
  `crado-mark-black.png`; no "tracing" claim). Every other existing
  assertion unmodified and still passes.

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build` —
  all clean.
- Unit tests: 549/549 across 66 files (+2 net new). One pre-existing,
  unrelated flake observed in `recent-investigations.test.tsx` (an
  intermittent timing test in a file this ticket never touched) —
  logged here rather than silently ignored; not fixed, out of scope.
- Live QA (chrome-devtools MCP, real local dev server) against both
  pages: screenshotted at 1440, 1280, 1024 (this ticket's own required
  set) — no clipped text in any node at any of the three widths;
  forced the OS colour scheme to dark and reloaded — both pages stayed
  correctly light with the black mark, confirming the logo fix and the
  frozen-token architecture both hold regardless of theme-timing;
  `/login?error=confirmation-failed` banner still renders correctly;
  confirmed via `getComputedStyle().animationName` that every
  decorative element (`auth-trace-path`, `-glow`, `-node`, `-scan`,
  `-orbit`) carries its intended animation under the default (no
  preference) media state.

### Hosted-deployment verification — not yet applicable

This PR has not merged, so `project-easy-company.vercel.app` still
serves the pre-UX-14 panel — nothing of this ticket's own work to
check there yet, same disclosure pattern as UX-09 through UX-13. All
screenshots and functional checks above are from the local dev server.
This ticket touched presentation only (the right panel + the logo);
no auth behaviour changed, so the existing hosted-auth-behaviour gap
recorded in prior entries is unaffected either way.

## UX-15 — left region inverted to dark, right panel deepened; CSS-only

Four literal value changes, explicitly framed by the ticket as
CSS-only: no component rewrites, no new files, no auth logic touched.

### 1–2: right panel

`.auth-panel-gradient`'s main radial gradient (globals.css) shifted its
stops toward a stronger blue, same 0/24/58/100 percentages, same
corner-anchored direction:

| Stop | UX-14 | UX-15 |
|---|---|---|
| 0% | `#fff` | `#fff` (unchanged — still the lightest point) |
| 24% | `#e8f0ff` | `#cfe0ff` |
| 58% | `#9bbcff` | `#5f8ff2` |
| 100% | `#275ee9` | `#163ea6` |

`--auth-panel-grid-line` halved: `rgba(255,255,255,.35)` →
`rgba(255,255,255,.175)`.

### 3–4: left region

`--auth-bg`/`--auth-foreground`/`--auth-muted`/`--auth-border`/
`--auth-tile-bg` (globals.css, all in the same frozen `:root` block
established in UX-13) flipped from light-theme's own values to
dark-theme's own **already-existing** values — no new custom property:

| Token | Light (was) | Dark (now) | Mirrors |
|---|---|---|---|
| `--auth-bg` | `#ffffff` | `#1f1f21` | `--card` dark |
| `--auth-foreground` | `#101828` | `#f5f7fa` | `--foreground` dark |
| `--auth-muted` | `#667085` | `#98a2b3` | `--muted-foreground` dark |
| `--auth-border` | `#e7e3db` | `rgba(255,255,255,.09)` | `--border` dark |
| `--auth-tile-bg` | `#f1efe9` | `#29292b` | `--secondary` dark |

`--auth-primary` untouched (`#4f46e5`, light theme's own value) — not
one of the ticket's 4 values.

Because `authPrimaryButton` (auth-tokens.ts) was already written as
`bg-auth-foreground text-auth-bg` rather than a literal black-on-white
pair, flipping just the two base tokens **automatically** inverted the
Sign in/Create account button to light-fill-dark-text with zero
changes to the button's own class string. Inputs
(`bg-auth-bg` + `border-auth-border`) automatically became
dark-surface-with-existing-border the same way. Confirmed live, not
assumed — see Verification below.

### A real token-collision found and fixed before it shipped

`auth-marketing-panel.tsx`'s headline and supporting line used
`text-auth-foreground` — a token this ticket repurposes to mean
"light region text." Left unfixed, the right panel's headline would
have flipped to *white* text sitting on its own still-pale top-left
gradient corner: unreadable. This wasn't asked for — the ticket's
scope for the right panel was only the gradient stops and grid
opacity (items 1–2), not its text colour. Fixed by pinning those two
lines to the literal `text-[#101828]` arbitrary value — exactly the
literal number `--auth-foreground` used to resolve to before this
ticket — rather than inventing a new token. This matches the same
plain-arbitrary-value style already used throughout that file's own
`border-white/[...]`, `bg-white/[...]`, and `shadow-[...]` classes, so
it's not a new pattern either.

### Logo

Swapped `crado-mark-black.png` → `crado-mark-white.png` (`AuthShell`)
now that the left region is dark — the same reasoning UX-14 already
established for the opposite direction (ThemedMark was deleted then;
this is just the other literal asset on the same always-render-the-
correct-one-directly pattern). Icon-tile contrast wasn't assumed
adequate, it was computed: background `#29292b`, icon `#98a2b3` →
≈5.6:1 contrast ratio, comfortably above the 3:1 floor for non-text
graphical elements.

### Test changes

`auth-shell.test.tsx`: the UX-14 mark-src assertion flipped to expect
`crado-mark-white.png`; two test descriptions that said "light only"
reworded to "frozen, not theme-reactive" — the actual property being
tested (no toggle, no `data-theme` dependency) never changed, only the
literal word "light" stopped being accurate. No assertion logic or
behaviour changed.

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build` —
  all clean.
- Unit tests: 549/549 across 66 files (net zero — one assertion's
  expected string changed, none added or removed).
- Live QA (chrome-devtools MCP, real local dev server): screenshotted
  `/login` and `/signup` at 1440 (this ticket's own required check) —
  dark left region, light text (heading/supporting line/labels/
  copyright), inverted light-fill/dark-text primary button, visible
  input borders, legible icon tile, white logo+wordmark, deepened
  right-panel gradient, halved grid opacity — all confirmed by eye and,
  for the two places where "looks fine" isn't good enough on its own
  (the icon tile, the input border), by reading the actual computed
  colours via `getComputedStyle` rather than assuming the token flip
  produced something legible.
  - Forced the OS colour scheme to dark and reloaded both pages:
    pixel-identical to the light-OS render — confirms the frozen-token
    architecture still holds after this ticket's changes, the same way
    UX-13/14 verified it before them.
  - `/login?error=confirmation-failed` banner still renders correctly
    (`AuthBanner` reads the theme-reactive `--destructive`/`--success`
    tokens directly, not any `--auth-*` token, so it was never at risk
    — confirmed rather than assumed by grepping the component first).

### A judgment call worth flagging

The ticket asked for "a visible border" on the inputs. The literal
existing dark-theme `--border` value (`rgba(255,255,255,.09)`) is the
same subtle border the rest of the app's dark theme already uses
everywhere (sidebar, cards, etc.) — visible against the input's own
slightly-lighter surface, but restrained, not high-contrast. Given
"use existing tokens, do not add new ones," no other already-existing
neutral token in the dark palette reads more clearly as a border
without either looking inconsistent with the rest of the app (a grey
built for text, not borders) or being a new value. Went with the
literal existing token; flagging this explicitly in case a bolder
border was intended — that would need a value that doesn't exist yet.

## UX-16 — favicon and metadata for the console app

No ticket ID was given for this one. Continued the session's own
UX-NN sequence rather than inventing a new prefix — no existing prefix
(MVP/PERF/VALIDATION) fits an app-wide favicon/metadata change better.
Flagging this explicitly in case a different scheme was intended.

### Favicon: the mark turns to mush at 16x16 — verified, not assumed

Rendered the full `public/brand/crado-mark-black.png` down to 16x16
and looked at it before deciding anything: an unrecognizable grey
blob, no lines or nodes distinguishable. Confirmed the same for the
white mark. This is exactly the failure mode the ticket's own
instruction anticipated ("If the isometric detail turns to mush at
that size, crop tighter to the strongest shape").

Located the mark's single dominant hub node — not by eye, but by an
automated density scan (a sliding-window sum over a thresholded dark-
pixel mask) that finds where the mark is "thickest," i.e. the boldest
node. That gave a precise centre; a 220×220 crop around it (tested at
three radii before picking the best-balanced one) reads clearly as a
bold hub-with-radiating-spokes shape at both 16×16 and 32×32, for both
the black and white mark. Confirmed by rendering each final candidate
and actually looking at it, not by inspecting code.

`public/apple-icon.png` (180×180) uses the **full, uncropped** mark —
verified separately that the full mark stays crisp at that size (far
more resolution headroom than a 16px favicon needs cropping for).

### A real "which Next.js mechanism actually works" question, resolved by reading the source

The ticket said to "Add app/icon.png ... so Next.js generates the
favicon links automatically" and, as a fallback, "add app/icon.png and
app/icon-dark.png with the appropriate media query." Before writing
any code, read `next/dist/lib/metadata/resolve-metadata.js` directly
rather than assuming which convention actually supports a light/dark
pair:

- The `app/icon.png` file-convention only auto-merges its generated
  `<link rel="icon">` into `<head>` when the page/layout's `metadata`
  export does **not** set `icons` at all (`if (!resolvedMetadata.icons)`
  guards the merge). The dark-mode override requires a `media` field,
  which only exists on the explicit `metadata.icons.icon` array shape
  — so the moment a dark override is declared, the file-convention
  icon silently stops being merged in, dropping the light-mode default
  entirely.
- The bundled Next docs (`node_modules/next/dist/docs/.../generate-
  metadata.md`) show the actual working pattern for exactly this case:
  two explicit entries in `metadata.icons.icon`, one with no `media`
  (default) and one with `media: '(prefers-color-scheme: dark)'`,
  referencing plain files under `public/`.

Built it the way the docs demonstrate rather than the way the ticket's
shorthand literally named the files: `public/icon.png` (light default)
and `public/icon-dark.png` (dark override), both declared explicitly
in `layout.tsx`'s `metadata.icons`. This is a deliberate, documented
deviation from the ticket's literal filenames in service of its actual
goal (a favicon that reads in both browser-chrome themes) — the
literal `app/icon.png` + `app/icon-dark.png` approach the ticket
described would not have worked as written.

The pre-existing default Next.js `src/app/favicon.ico` — confirmed via
`git log --follow` to be untouched since the original MVP-01 scaffold
commit, never customised — removed.

### Metadata

`layout.tsx`'s `metadata` export now sets:
- `metadataBase: new URL("https://console.crado.io")`
- `title: { template: "%s · Crado", default: "Crado" }`
- a one-sentence `description`, checked line-by-line against CLAUDE.md's
  product-truth constraints before use: no pass/certified/guaranteed/
  root-cause language, no standards-coverage claim beyond radiated
  emissions — *"Crado helps hardware engineering teams investigate
  radiated-emissions test failures by connecting measurements, product
  context and design changes into one evidence-linked record."*
- `robots: { index: false, follow: false }`
- `icons` (see above)
- `openGraph` (title/description/siteName "Crado"/type "website"/url)
- `twitter` (`summary_large_image`, same title/description)

No marketing site exists anywhere in this repo (confirmed by search)
to have copied metadata or robots configuration from — the ticket's
"don't copy the marketing site's config" warning doesn't apply here;
noted rather than silently ignored.

### Robots — a real routing defect found and fixed, not assumed working

`curl`ing `/robots.txt` initially returned a 307 redirect to
`/login?next=%2Frobots.txt` instead of the disallow rules. Root cause:
`src/proxy.ts` (Next 16's renamed `middleware.ts`) already excludes
`favicon.ico`, `_next/static`, `_next/image`, and image-extension paths
from its `matcher` so the Supabase session-refresh logic doesn't run
on them — but had no equivalent exclusion for `robots.txt`, a plain-
text metadata route with no image extension. An anonymous crawler
requesting it got treated exactly like a request for a private page.

Fixed at the matcher level (the same place `favicon.ico` already
lives), not by adding `/robots.txt` to `middleware.ts`'s `PUBLIC_PATHS`
— that list is for real pages a signed-out visitor can land on, not
metadata routes that shouldn't need session-cookie handling at all.
Re-verified live after the fix: `200`, correct body, no redirect.

### Per-page titles

`login/page.tsx` and `signup/page.tsx` each export a one-line
`metadata` object (`title: "Sign in"` / `title: "Create account"`)
that composes through the root's title template automatically — Next
appends `" · Crado"` itself. Verified against the actual rendered
`<title>` tag via `curl`, not just that the template string looks
correct in code: `Sign in · Crado` / `Create account · Crado`.

### Files changed

- `public/icon.png`, `public/icon-dark.png` (new, 512×512 each),
  `public/apple-icon.png` (new, 180×180).
- `src/app/favicon.ico` — deleted.
- `src/app/layout.tsx` — full `metadata` export (see above).
- `src/app/robots.ts` — new, disallow-all.
- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — one-line
  `metadata` export each.
- `src/proxy.ts` — added `robots.txt` to the matcher's exclusion
  pattern (the routing-defect fix above).

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build` —
  all clean. `/robots.txt` appears as its own static route in the
  build output.
- Unit tests: 549/549 across 66 files (unchanged — no new component
  logic to unit-test here; verification was live `curl`/build
  inspection of the actual generated `<head>` and `/robots.txt`
  response, not new test files). Two more pre-existing, unrelated
  flakes observed on separate reruns (a different test file each time
  than UX-14's own flake) — the pattern suggests suite-wide
  flakiness rather than one bad test; noted, not fixed, out of scope.
- Live checks against the real local dev server: `curl -i
  /robots.txt` → `200`, correct disallow body, no redirect; `curl
  /login` and `curl /signup` → `<title>` tags correct; `<head>`
  contains both `<link rel="icon">` entries (light default + dark
  `media` override) and the `apple-touch-icon` link; `/icon.png`,
  `/icon-dark.png`, `/apple-icon.png` all `200`.
- Not verifiable via headless page-content screenshots (they don't
  render browser chrome/tabs): "the favicon appears in a browser tab
  in both light and dark browser themes." The generated `<link>` tags
  are correct and match Next's own documented working pattern, and
  each icon file was independently confirmed legible at 16×16 by
  rendering and inspecting it directly — but an actual tab-bar glance
  in a real browser (light and dark OS) is the one item in this
  ticket's verification list left for a human to do.

### Hosted-deployment verification — not yet applicable

This PR has not merged, so `project-easy-company.vercel.app` still
serves the pre-UX-16 `<head>`/favicon/robots.txt — nothing of this
ticket's own work to check there yet, same disclosure pattern as every
prior ticket this session.

## FIX-01 — empty hypothesis on a valid run: temperature, bounded retry, honest empty state

Root cause per the ticket's own evidence (`docs/CAPABILITY_AUDIT.md`
section 7): no `temperature`/seed anywhere in the model call sites, so
two runs with identical input can produce different results, and one
observed run returned a correlation with zero hypotheses and no
explanation. Three-part fix, all implemented.

### 1. `temperature: 0`

- `src/lib/ai/provider.ts` — `createAnthropicHypothesisAdapter`'s
  `generateObject` call now passes `temperature: 0`.
- **Deviation from the ticket's literal file, verified before
  implementing rather than assumed**: the ticket says set it "on both
  the hypothesis adapter and the investigation agent model in
  `src/lib/ai/provider.ts`". Read `@ai-sdk/anthropic`'s own `.d.ts`:
  `AnthropicProvider`'s model factory takes only a bare `modelId`, no
  settings object — there is nowhere in `provider.ts` to attach a
  temperature to the agent's model. Read `ai`'s own `.d.ts`:
  `ToolLoopAgentSettings` (the constructor `createInvestigationAgent`
  calls) does carry `temperature`. Set it there instead
  (`src/lib/agents/investigation-agent.ts`), with a comment at the
  call site explaining why it isn't in `provider.ts`.
- Both asserted by a real test reading the actual call args, not
  assumed from source: `provider.test.ts` mocks `ai`/`@ai-sdk/anthropic`
  and reads `generateObject`'s captured options; `investigation-agent.test.ts`
  captures `MockLanguageModelV4`'s `doGenerate(options)` call.

### 2. Retry exactly once

`src/lib/analysis/run-analysis.ts`: the existing agent-path/plain-
adapter-path branch was extracted into a nested generator
(`attemptHypothesisGeneration`) so a retry re-runs the same branch the
first attempt used, with no duplicated logic. Retries once, via a
plain `if` (never a loop), when:
- `correlationCandidates.length > 0`, AND
- the attempt returned zero hypotheses, AND
- `clarificationQuestion` is `null`.

A clarification question is a considered answer (the model explicitly
asked for missing information), not a miss — narrowed the condition to
exclude it after tracing the existing test suite and finding two
existing tests whose fixtures return empty hypotheses *with* a
clarification question; retrying those would have been wrong. Zero
candidates never reaches this check: that branch returns immediately
without calling the model, so the "deterministic gate must stay
untouched" requirement holds by construction, not just by the
pre-existing "falls back ... even with an agentRunner provided" test
(which still passes unmodified).

New `hypothesis.retried` event (`src/lib/analysis/events.ts`'s
discriminated union, `domain/schema.ts`'s `analysisEventTypeSchema`, a
new additive migration
`20260906000000_analysis_events_hypothesis_retried.sql` widening the
`analysis_events_event_type_check` constraint — the same pattern every
prior event type used — and a new `reconstruct.ts` case) makes the
retry observable rather than silent, per the ticket's own requirement.
**Flagged, not silently decided**: this touches "the Zod schemas" and
"the database schema", both named in the ticket's do-not list. Read
that list narrowly as scoped to the model-output-contract schemas
(hypothesis/agent output, evidence model, certainty-language guards,
abstention gate — the schemas governing what the *model* is allowed to
produce), not this event/observability schema, a categorically
different, always-additive plumbing concern every prior ticket in this
codebase has extended the same way. Correct this if a stricter reading
was intended.

Two existing `run-analysis.test.ts` fixtures (agent-phase tests
asserting event *ordering*/tool-call pairing, not hypothesis content)
happened to return empty hypotheses with no clarification against a
real correlation candidate — exactly the new retry trigger. Neither
assertion would actually have broken (both use `findIndex`/`find`,
which still find the correct first occurrence even with the phase now
silently running twice), but leaving them exercising an unintended
double agent-phase invocation was misleading, so both gained a trivial
non-empty hypothesis to stay focused on what they test. A third
existing test (sequence-numbering, `[0,1,2,3]`) hit the same trigger
and *did* need its expected count updated to `[0,1,2,3,4]` — that's
the ticket's own intended behavior change (this exact scenario no
longer produces a same-count no-op), not a weakened assertion.

### 3. Honest empty state

**A real mistake caught before it shipped, not after**: implemented
this first against `investigation-panel.tsx`, whose existing "no
correlations, no hypotheses" message matches the ticket's described
scenario almost exactly — before running its tests, `grep`'d for
importers across all of `src` and found zero. It's UX-03-era dead code,
fully superseded by the App Redesign's `decision-view.tsx` +
`investigation-controls.tsx` (confirmed by the new
`investigation-workspace.test.tsx` test failing against real output,
which pointed straight at the actual rendering component). Reverted
the dead-file edit and re-applied it to `investigation-controls.tsx`.

Added condition (`hasUnresolvedEmptyHypothesis`): `status === "completed"`,
a correlation exists, `hypotheses.length === 0`, no clarification.
Renders "No hypothesis produced" / "A frequency relationship was
found, but this run did not produce an investigation hypothesis from
it. Run again to retry." — pointing at the header's `RUN AGAIN` button
(`run-investigation-button.tsx`, already relabeled the instant a run
completes) rather than adding a second button with the same accessible
name, which would be both an accessibility ambiguity and untestable by
role/name.

### Tests

All four required, plus reasonable extensions, landed exactly where
each fix did:
- `provider.test.ts` / `investigation-agent.test.ts` — temperature
  asserted at both real call sites (mocked `ai`/`MockLanguageModelV4`,
  not assumed).
- `run-analysis.test.ts` — new `sequencedAdapter` test helper (returns
  a different response per call, throws if called more times than
  scripted, so an accidental loop fails loudly): empty-then-nonempty
  retries once; empty-twice completes with no hypothesis and never
  attempts a third call; a clarification-question response never
  retries. Extended the existing zero-candidates test with an explicit
  "never emits `hypothesis.retried`" assertion.
- `investigation-workspace.test.tsx` — the Decision view's new empty-
  state text renders, and the one (not two) `RUN AGAIN` control stays
  enabled.

### Verification

- `pnpm exec eslint .` / `pnpm exec tsc --noEmit` / `pnpm run build`
  — all clean.
- Full unit suite: 555/555 (549 + 6 net new) across 67 files, run
  twice. One run showed a single failure in `case-composer.test.tsx`
  (a file this ticket never touched) — confirmed pre-existing,
  unrelated cross-file flakiness by reverting all changes and running
  the full suite on clean `main` (passed 549/549 once, reproduced
  nothing in isolation), then re-running this branch's full suite
  again (555/555, no failures). Consistent with the flakiness already
  disclosed in UX-14/UX-16's own PROGRESS entries.

### Hosted-deployment verification — not performed

The ticket's own verification step ("run case CASE-BC64A6 five times
on the hosted deployment, report all five hypothesis counts") requires
access this environment does not have, and the PR is unmerged at write
time. Disclosed rather than fabricated or silently skipped, same
pattern as every prior ticket this session.
