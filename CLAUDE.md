# CRADO MVP — CLAUDE CODE OPERATING INSTRUCTIONS

## Mission
Build and deploy the Crado pilot MVP as a production-quality vertical slice.

Crado category: **AI-native regulatory engineering**
Brand line: **Regulation, inside the engineering loop.**
Platform thesis: **Continuous regulatory feedback for physical-product engineering.**
Core platform layer: **Regulatory State**

Investor one-liner:
Crado is building an AI-native regulatory engineering system that connects product design, regulatory requirements and real test evidence, helping hardware teams identify compliance risk earlier, investigate failures and keep regulatory evidence synchronized as the product changes.

Initial wedge:
**Radiated-emissions investigation for connected hardware.**

The MVP must demonstrate:
failed/pre-compliance measurement → product context → Failure State → frequency/harmonic + architecture correlations → ranked hypotheses → supporting evidence + missing information → engineer investigation → engineering change → new measurement → before/after comparison → regulatory/evidence update.

## Product truth
- Measurement is part of the product truth.
- Never imply that documents alone can predict every physical EMC failure.
- Never claim guaranteed pass prediction.
- Never claim definitive automated root-cause diagnosis.
- Never claim full electromagnetic simulation.
- Never claim Crado replaces qualified EMC engineers, accredited labs, certification bodies, or regulatory judgement.
- Never claim broad CE/FCC/UKCA coverage unless implemented and verified.
- AI outputs must distinguish: OBSERVED, KNOWN, INFERRED, MISSING.
- Hypotheses are ranked investigation hypotheses, not compliance verdicts.
- Unknown remains unknown.
- Every regulatory statement shown as authoritative must have provenance.
- Product plans are not shipped capability.

## MVP scope
Build only the vertical slice needed for a credible pilot.

### Must work
1. Auth and private workspace.
2. Product + product revision.
3. Failure case.
4. Manual measurement entry.
5. Basic PDF/CSV/image upload with metadata; extraction may have fallback.
6. Product-context extraction into structured facts.
7. Failure State.
8. Deterministic frequency/harmonic correlation utility.
9. Ranked diagnostic hypotheses.
10. Evidence panel showing observed/known/inferred/missing.
11. Engineer can add an observation.
12. Engineer can record a design change.
13. Engineer can add a second measurement.
14. Before/after comparison.
15. Basic Regulatory State / evidence-version linkage.
16. Persistent analysis event history.
17. Streaming UI for analysis events.
18. Pilot-ready seed case and E2E demo.
19. Deployable production build.

### Explicitly out of scope
- Automatic Gerber/ODB++ interpretation.
- EM field simulation.
- Automatic PCB fixes.
- All EMC test families.
- Full standards library.
- Full lab-report format coverage.
- Enterprise PLM/CAD integrations.
- Autonomous pass/fail certification.
- Multi-agent production orchestration unless required by a measured bottleneck.

## Architecture
Prefer the simplest maintainable stack:
- Next.js + React + TypeScript.
- Vercel AI SDK for provider-agnostic structured generation and streaming.
- Postgres through Supabase.
- Supabase Auth and private Storage if needed.
- Zod for all model-facing structured schemas.
- TypeScript domain functions for deterministic correlations/checks.
- Deploy frontend/API to Vercel.
- Use SSE/AI SDK data streams for user-initiated analysis.
- Do not add WebSockets, queues, Kafka, Redis, Temporal, or a workflow engine for the MVP unless there is a demonstrated need.

Keep model access behind one provider adapter. Business logic must not depend on one model vendor.

## Core domain objects
Use these concepts unless implementation evidence requires a change:
- User / Workspace
- Product
- ProductRevision
- ProductFact
- FailureCase
- Measurement
- MeasurementPeak
- AnalysisRun
- AnalysisEvent
- DiagnosticHypothesis
- EvidenceItem
- InvestigationEvent
- EngineeringChange
- RegulatoryRequirement
- RegulatoryEvidenceLink

Important relationship:
ProductRevision × Measurement × FailureCase × Hypothesis × InvestigationEvent × EngineeringChange × Outcome.

## AI architecture
The LLM is not the sole reasoning engine.

Pipeline:
1. ingest facts
2. normalize structured product context
3. create Failure State
4. run deterministic correlation utilities
5. retrieve relevant case/rule context if available
6. ask only material clarification questions
7. generate ranked hypotheses grounded in available evidence
8. label every statement observed/known/inferred/missing
9. stream typed events to UI
10. persist final structured state

Never expose hidden chain-of-thought. Show concise user-facing evidence and reasoning summaries.

Use typed events such as:
- run.started
- product.fact_detected
- measurement.parsed
- correlation.found
- clarification.required
- hypothesis.created
- hypothesis.updated
- observation.recorded
- change.recorded
- measurement.compared
- regulatory_state.updated
- run.completed
- run.failed

## Streaming UX
Do not build a generic chatbot.

Primary desktop screen:
LEFT: Product Context
CENTER: Failure / Regulatory State
RIGHT: Investigation / Evidence
BOTTOM: compact composer: “Tell Crado what you measured, changed or observed…”

The interface should progressively update as typed analysis events arrive.
Do not stream fake internal reasoning.
Show useful work state, e.g. “3 candidate correlations found”, “1 fact needs confirmation”.

## Design
Use the existing Crado design brief if present.
Aesthetic: frontier engineering company, restrained, technical, near-monochrome.
Avoid generic AI gradients, glassmorphism, glowing blobs, stock imagery, random icon libraries, excessive cards, fake dashboards.
Use custom technical SVGs only where they improve comprehension.
Accessibility and responsive behavior are required.

## Security
Treat uploaded schematics, lab reports, BOMs and measurements as confidential.
- Private-by-default storage.
- RLS/authorization on every user-owned row/object.
- Never log raw secrets or document contents unnecessarily.
- Never commit credentials.
- Validate upload type/size.
- Use signed/private file access.
- Keep model/provider keys server-side.
- Add a clear deletion path for pilot data.
Do not send customer documents to a third-party indexing/model provider unless explicitly configured and approved.

## Context + token discipline
We are on a limited Claude Pro allowance. Optimize for useful work per context window.

At the start of EVERY session:
1. `pwd`
2. read this CLAUDE.md
3. read `docs/PROGRESS.md`
4. read `features.json`
5. read only the docs relevant to the selected ticket
6. inspect `git log -5 --oneline` and `git status`
7. if `graphify-out/GRAPH_REPORT.md` exists, read it before broad code search
8. choose the highest-priority incomplete ticket whose dependencies pass

Do NOT reread the whole repository.
Do NOT scan `node_modules`, build output, lockfile contents, generated assets, or large data files unless required.
Prefer Graphify/navigation, targeted reads, symbol search, and git history.
Use one mergeable ticket at a time.

When a ticket touches >3 meaningful files, briefly state the plan before edits. Do not ask for approval unless the change is irreversible, changes product scope, requires credentials/payment, or conflicts with these instructions.

At ticket end:
1. run relevant unit tests
2. typecheck
3. lint
4. build when applicable
5. E2E/browser-test user-facing flows when applicable
6. update only the ticket’s `passes` field in `features.json`
7. append concise handoff to `docs/PROGRESS.md`
8. commit with a descriptive message
9. continue to the next eligible ticket if usage/time remains

Before context becomes expensive, finish the current ticket, persist state, commit, then use a fresh context. Durable repo artifacts are the memory, not the chat transcript.

## Graphify policy
Graphify is optional optimization, never the source of truth.

If a graph exists:
- query/read the graph before broad Glob/Grep for architecture/navigation questions
- then open the actual source files before editing
- treat INFERRED graph edges as hypotheses
- update graph after meaningful commits, not after every tiny edit
- never index secrets, `.env*`, customer documents, uploads, `node_modules`, `.next`, coverage, generated build output, or large fixtures

For a tiny greenfield repo, do not waste usage building a semantic graph before it has enough structure to help.
Once the repo is non-trivial, prefer a commit-time graph refresh.

## Ralph Loop policy
Ralph is for bounded, verifiable tickets only.

Good:
- “Implement MVP-07 with these acceptance tests.”
- “Fix this failing E2E flow until all checks pass.”

Bad:
- “Build all of Crado.”
- architecture choices
- subjective product decisions
- migrations with unclear rollback
- anything requiring human regulatory judgement

Use a maximum of 3–5 iterations per ticket on Pro unless explicitly changed.
A loop must have objective completion criteria.
Never output the completion promise unless tests and acceptance criteria genuinely pass.
Ralph does not bypass subscription usage limits; stop cleanly when capacity is near exhaustion.

## Testing doctrine
Tests are backpressure.
Never delete, weaken, skip, or rewrite a failing acceptance test merely to make the suite green.

For every domain rule/correlation, include:
- expected positive case
- expected negative case
- missing-data case
- boundary case where relevant

For AI outputs:
- validate schemas
- test refusal/uncertainty behavior
- test that unsupported claims are not promoted to KNOWN
- snapshot only stable structures, not prose wording

For UI:
- test the complete pilot happy path as a user.
- verify failure/reconnect states for streaming.
- preserve partial persisted events if the browser refreshes.

## Engineering quality
- Prefer boring, explicit code over clever abstractions.
- No premature generic DSL.
- No speculative infrastructure.
- No package unless it saves meaningful implementation time.
- Reuse existing working components when they fit the new product truth.
- Delete/deprecate old concepts that create conflicting product behavior.
- Keep functions small and types explicit.
- Add comments for WHY, not obvious WHAT.
- Migrations must be reversible where practical.
- Keep main deployable.


## Decision autonomy — do not wait for routine clarification
The goal is sustained unattended implementation. Do not turn reversible engineering choices into user prompts.

### Default rule
If you can identify a recommended option from these instructions, the existing architecture, repository conventions, tests, or standard engineering practice, **choose it and continue**.

Do NOT present “Option 1 / Option 2 / Option 3” and wait when:
- one option is already your recommendation
- the choice is reversible
- it stays inside documented MVP scope
- it does not change a security/regulatory boundary
- it does not create meaningful recurring cost
- tests can validate the choice

Treat these as **two-way-door decisions**. Make the decision, record it briefly in `docs/PROGRESS.md` if material, and continue.

### Ask the user only for one-way-door decisions
Human input is required only when the decision:
- changes the frozen product positioning, MVP wedge, or acceptance criteria
- creates/deletes paid infrastructure or meaningful recurring spend
- changes production DNS, external access, or customer-facing legal/regulatory claims
- exposes, exports, or sends confidential customer/pilot data to a new third party
- weakens authentication, authorization, RLS, encryption, or another security boundary
- requires a destructive/irreversible production data migration or deletion
- requires a secret/credential that is not configured
- commits to a third-party contract, purchase, or external communication
- has two materially different product outcomes and the source-of-truth docs do not resolve them

If you must ask, ask **one concise blocking question**, give your recommendation and why, and continue all non-blocked work before waiting.

### Default tie-breakers
When multiple implementation choices are reasonable:
1. reuse existing working code/conventions
2. choose the simplest reversible implementation
3. prefer fewer dependencies
4. prefer typed/explicit code over abstraction
5. prefer additive migrations over destructive migrations
6. prefer manual fallback over building broad parser/integration scope
7. prefer a testable deterministic utility before adding another agent/model call
8. prefer the documented Next.js + Vercel AI SDK + Supabase stack
9. preserve privacy/security over convenience
10. preserve the MVP happy path over speculative completeness

Never ask “Should I proceed?” after stating a recommended routine implementation. Proceed.
Never stop solely because a preference was not specified when these defaults resolve it.

## Autonomy
Do not stop after every small step to ask “should I continue?”
Continue through the current ticket and then the next eligible ticket while:
- scope is clear
- tests are available
- no irreversible choice is required
- no secret/payment/production destructive action is required

Stop and ask only when a decision materially changes product scope, data model, security boundary, regulatory claim, or deployment cost.

If nearing usage/context limits, do not announce “continue tomorrow” without leaving the repo ready. First:
- finish or revert partial work
- update PROGRESS
- leave next exact ticket
- commit clean state
- report only remaining blocker

## Definition of MVP done
MVP is complete only when:
- a new pilot user can sign in
- create/open a product revision
- create a radiated-emissions failure case
- enter/upload a measurement
- see structured correlations and evidence-grounded hypotheses stream in
- add an investigation observation
- record an engineering change
- add a second measurement
- see before/after result and updated evidence/regulatory state
- data persists across refresh
- security checks pass
- critical E2E test passes
- production deployment is healthy
- demo seed case works without developer intervention
