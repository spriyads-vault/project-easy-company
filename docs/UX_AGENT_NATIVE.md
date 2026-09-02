# UX-04: Agent-Native Crado Product Experience — audit

Research/audit pass required before implementation, per the UX-04 ticket.
No backend/agent/evidence-model change follows from this — it informs the
UI/journey redesign only.

## 1. Current dependencies

Before this ticket: no component library at all. Every earlier UX pass
(UX-01–UX-03, and the light-theme UX-04 this ticket supersedes) was
hand-built Tailwind + a route-scoped `theme.ts` token module. No Radix, no
shadcn, no React Flow, no AI Elements, no `cmdk`, no icon library.

Added for this ticket: `@radix-ui/react-{dialog,dropdown-menu,tabs,
tooltip,popover,scroll-area,separator,slot,avatar}`, `cmdk`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`react-resizable-panels@2`, `@xyflow/react`.

**AI Elements decision**: evaluated, not installed as a dependency. AI
Elements ships as source you copy via the shadcn CLI from a separate
registry (`ai-elements` — not an npm package), specifically `Tool`,
`PromptInput`, `Conversation`, `Canvas`. Given this environment's sandbox
has no interactive shell for the CLI's registry fetch/prompt flow, and
given the ticket's own framing ("AI Elements is not the visual identity,
it is interaction infrastructure" / "adapt the source to Crado"), the
pragmatic equivalent was to hand-build Crado-native versions of exactly
the two primitives that matter here — a `Tool`-style run-activity row
(`run-activity.tsx`) and a `PromptInput`-style composer shell
(`agent-composer.tsx`) — on the same shadcn/Radix foundation AI Elements
itself is built on, styled to Crado's tokens rather than pulling in a
second, disconnected visual system. `@xyflow/react` (the literal library
AI Elements' `Canvas` wraps) is installed directly and used for the real
investigation canvas.

## 2. Existing investigation/agent architecture (kept as-is)

- `src/lib/analysis/create-analysis-run.ts` + `POST /api/analysis-runs`:
  SSE stream of typed `AnalysisEvent`s, persisted to `analysis_events` as
  produced. Requires an existing `failureCaseId` + `measurementId`.
- `src/lib/investigation/reconstruct.ts`: the one state reducer, used both
  for live SSE folding and refresh-reconstruction from Postgres. This is
  the exact data model the new React Flow canvas renders — no new event
  types, no new reducer.
- `src/lib/agents/investigation-agent.ts` + `tools.ts`: the tool-calling
  agent, unchanged.
- `src/lib/hypotheses/schema.ts`: `EvidenceCategory` (observed/known/
  inferred/missing) trust boundary, unchanged.
- `src/app/cases/[caseId]/investigation/parse-engineer-input.ts`: a
  deterministic (never a model call) regex parser turning free text into
  an observation + optional "±N dB" measurement-change line. Extended,
  not replaced (see §7).
- Server actions kept verbatim: `recordInvestigationObservation`,
  `recordEngineeringChange`, `createMeasurement`, `createProduct`,
  `createRevision`, `createFailureCase`. The new agent-first flows call
  these same actions/insert shapes — no new tables, no schema change.

## 3. Current journey (form-based SaaS dashboard)

```
/login (form)
  → /workspace (product list + "new product" form)
    → /products/[id] (revision list + "new revision" form)
      → /products/[id]/revisions/[rid] (fact list + "add fact" form,
         failure-case list + "open case" button)
        → /cases/[caseId] (measurement list + "add measurement" form)
          → /cases/[caseId]/investigation
             → click RUN INVESTIGATION → wait → cards stream in
             → composer only handles free-text OBSERVATIONS; a
               "Measurement" attach option just deep-links back to the
               case page's form
             → "Record engineering change" is a full structured form
               inline in the canvas
```

Every step is: land on a page → fill a form → submit → land on the next
page. The agent only exists once, at the very end, behind a button.

## 4. New journey (agent-first)

```
/login (kept — restyled dark, unchanged behavior)
  → /investigations  ← NEW default landing page (list, not a dashboard)
      [New investigation] · Cmd/Ctrl+K command palette
    → /investigations/new  ← NEW agent-first intake
         "What happened?" — one composer, free text + attachment
         → deterministic extraction (product/revision/test/frequency/
           margin/operating-mode; product matched against real
           workspace products, revision matched/created, never invented)
         → "CRADO UNDERSTOOD" confirmation surface (editable) —
           nothing persisted until [Start investigation]
         → confirm creates product (if new) → revision (if new) →
           failure case → measurement, then redirects into
    → /cases/[caseId]/investigation  ← kept route, canvas rebuilt
         run auto-starts once (no separate "click RUN" step for a
         freshly-confirmed intake); React Flow canvas renders
         Measurement → Deterministic → Hypothesis (branching per
         hypothesis) → Missing evidence → Next action as the run
         streams in, exactly as today's SSE/reducer already produce
         the data — only the rendering surface changed
         → floating agent composer now classifies three intents
           (Observation / Measurement / Engineering change), each a
           confirmation artifact before persisting, calling the exact
           same existing server actions
         → engineer confirms → node appears on canvas, timeline
           updates, right context rail updates
```

Old multi-page form journey (`/workspace` → `/products/[id]` →
`/products/[id]/revisions/[rid]` → `/cases/[caseId]` add-measurement
form) still exists and still works — required for data the agent-first
path can't reach yet (per-category structured product facts, bulk
revision/product management) — but is now reached only via "Advanced" /
"•••" disclosures, never the default path a new investigation takes.

## 5. Action → new-experience map

| Old action | New primary path | Old path now |
|---|---|---|
| Create product (`/workspace` form) | Implicit in `/investigations/new` intake (matched-or-created) | `/products` index, still a real form |
| Create revision (`/products/[id]` form) | Implicit in intake, or "Changed X, created RevN" composer message | `/products/[id]` page, still a real form |
| Add product fact (`/products/[id]/revisions/[rid]` form) | Not covered by intake (out of scope for this pass — see report gap) | Same page, unchanged |
| Open failure case (button) | Implicit in intake confirm | Removed as a separate step — intake always opens one |
| Add measurement (`/cases/[caseId]` form) | Intake's first measurement; composer's "Measurement" intent for follow-ups | `/cases/[caseId]` page, kept as "Advanced: manual entry" |
| Record observation (composer) | Composer, unchanged (already agent-first since UX-02) | — |
| Record engineering change (inline form on canvas) | Composer's "Engineering change" intent | Still available inline, now secondary |
| Run investigation (button) | Auto-runs once after intake confirm; button remains for RE-EVALUATE on an existing case | — |

## 6. Reference-pattern extraction (no branding copied)

- **Vercel dashboard / Supabase Studio**: compact left rail with icon +
  label, collapsible to icon-only with tooltips; dense list rows instead
  of KPI cards for a "things you're working on" home; command palette as
  the fast path to anything.
- **Modern agent IDEs**: tool-call activity compresses to a one-line
  summary chip with a drawer for detail, never a permanently-expanded log;
  status communicated with a small dot/glyph next to a title, never a
  giant colored pill as primary UI.
- **React Flow node-based products**: used here strictly as a *visual
  investigation surface* (per the ticket) — node dragging/creation/
  deletion disabled, `nodesDraggable={false}` `nodesConnectable={false}
  elementsSelectable` only for detail-on-click, `fitView`, pan/zoom
  enabled, no minimap (not needed at this graph size).

## 7. Deterministic vs. model-assisted extraction — decision

The composer's existing `parseEngineerInput` is explicitly deterministic
("never a model call, never a paraphrase" — a documented design choice
already in the codebase). This ticket asks for three more free-text →
structured flows: new-investigation intake, a new measurement, and an
engineering change + revision.

**Decision: extend the same deterministic approach for all three**,
rather than introduce an LLM call into the core interaction loop:

- Every one of the ticket's own example sentences ("Gateway X Rev17
  failed radiated emissions at 200 MHz, 7.4 dB above limit...", "Retested
  Rev18. 200 MHz is now 3.6 dB below the limit.", "Changed the display
  termination and created Rev18.") is regular enough in shape (numbers +
  units + a small vocabulary of direction/action words + a revision
  token) for pattern extraction — no free-form paragraph understanding is
  required for the fields Crado actually needs.
- A product name is matched against the workspace's **real** product
  list (case-insensitive substring/token match) — never invented; no
  match falls back to "new product," shown explicitly in the confirmation
  surface for the engineer to approve or edit, never silently created.
- This keeps the composer's response instant (no model round-trip, no
  new failure/latency surface on the primary interaction loop) and keeps
  every extracted field traceably sourced from the engineer's own text —
  the same OBSERVED-not-INFERRED trust boundary the rest of the product
  already enforces for user-entered content.
- Every extraction surfaces an **editable** confirmation artifact before
  anything is persisted (per the ticket's explicit "engineer confirms
  first" rule) — so an imperfect parse is always correctable, not a
  silent wrong write.
- This is intentionally a two-way-door decision: a model-assisted
  extraction adapter can be added later behind the same confirmation-gate
  contract without changing the UI, and CLAUDE.md's own tie-breaker #7
  ("prefer a testable deterministic utility before adding another agent/
  model call") supports making that choice by default here.

## 8. Route strategy

`/cases/[caseId]` and `/cases/[caseId]/investigation` are **kept
verbatim** as URLs — renaming them to `/investigations/[id]` would be a
purely cosmetic, high-blast-radius change (every test, every link, every
`revalidatePath` call references `/cases/...`) with no functional upside,
so `/investigations` is a new **list** route that links into the existing
case URLs rather than a full URL migration.

The ticket's bottom nav (`Workspace / Settings / User`) is collapsed into
one real account menu (workspace name, signed-in email, sign out) rather
than three destinations — the app has no settings feature in MVP scope,
and CLAUDE.md/the ticket itself explicitly forbid placeholder "coming
soon" nav items. `/workspace` is kept as the real "Workspace" account
page; `/products` gains a proper index (previously only lived inline on
`/workspace`).

## 9. Dark theme

One dark theme only, per the ticket's explicit instruction, built as a
standard shadcn/ui CSS-variable contract in `globals.css`
(`--background #08090B`, `--card #0D1014`, `--popover #11151B`,
`--secondary`/raised `#151A21`, `--border #232933`, `--primary` green,
`--warning` amber, `--destructive` red) so every hand-built primitive in
`src/components/ui/**` and the higher-level tokens in
`src/lib/design/tokens.ts` share one source of truth. This supersedes
the light-theme UX-04 palette entirely (an explicit, deliberate
supersession per this ticket, not an oversight).
