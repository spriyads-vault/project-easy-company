# UX-07 Decision Sheet — Decision view, answer-first layout

Pre-flight only. No product code touched yet. Written per the ticket's
Process step 1; stopping here for confirmation before building.

## What this changes vs. what it doesn't

Layout and information hierarchy of the Decision view only. No new
event type, table, server action, or model call. Every component below
already exists and already renders from `WorkspaceState`/`TimelineEntry[]`
unmodified — this is a re-composition of existing pieces, not new domain
logic. Confirmed by grep: `investigation-item-table.tsx` has exactly one
real importer (`decision-view.tsx`) and no dedicated test file, so it can
be retired cleanly. `correlation-card.tsx`/`hypothesis-card.tsx` are also
used live by `canvas/canvas-nodes.tsx` (the Map view) — reusing them here
must not change their existing props or behavior.

Noticed, not touched: `investigation-panel.tsx` is dead code (no
importers anywhere) predating this redesign lineage — out of this
ticket's scope boundary, left alone.

## 1. Pane-state model

`InvestigationWorkspace`'s desktop `ResizablePanelGroup` (≥1024px tier)
changes from a fixed 3-pane group to a state-dependent one:

| State | Panes | Trigger |
|---|---|---|
| Run active (`isRunActive(state.status)`) | **Trace** (left) \| **Main/Decision** (center) \| **Inspector** (right) | identical to today's persistent Trace pane, live and expanded |
| Run not active | **Main/Decision** (center) \| **Inspector** (right) | Trace pane is not mounted at all — not `display:none`, not width-0, absent from the panel group |

`ResizablePanelGroup` is keyed on run-active-ness so react-resizable-panels
recomputes a fresh 2-pane vs. 3-pane layout each time rather than trying
to preserve stale saved sizes across a pane-count change — sizes are not
expected to persist across that boundary; this is a workbench, not a
user-tuned dashboard. Inspector keeps its current collapsed-by-default,
expand-on-selection behavior unchanged in both states.

The mobile stack and tablet tiers (`CANVAS_QUERY`/`RAIL_QUERY`) already
render Trace inline (`includeTracePanel=true`) — that inline render
becomes the same conditional: shown only while `state.agentActive` /
`isRunActive`, otherwise its content is the "N checks, Xms" summary line
inside the new "What Crado checked" disclosure row, exactly as on
desktop. No new breakpoint logic.

**Real architectural change, called out explicitly:** the composer
(`CaseComposer`) currently lives docked inside the *Trace pane's own
footer* on desktop (`investigation-workspace.tsx` lines ~718-735). Since
Trace can now be unmounted, the composer moves to dock at the bottom of
the **Main/Decision column** instead, full column width, present in both
pane states — this is what makes "the composer keeps its position...
so it does not move when a run ends" true. Mobile/tablet tiers already
dock the composer outside Trace, so they're unaffected.

## 2. Required layout, mapped to existing components

| Ticket section | Rendered by | Source |
|---|---|---|
| 1. Case header | `TopBar` (edited) + `RunInvestigationButton` + `AgentStatusPill` | existing, deduplicated |
| 2. Failure summary (prose) | `FailureStrip` (rewritten internals — same props, same data, prose instead of a stat grid) | existing file, new render |
| 3. Recommended next test (largest block) | `NextActionBar` (promoted out of the pinned-bottom-bar role into the primary block, full text, no truncation) | existing file, repositioned + restyled |
| 4. Reasoning, two objects side by side | `CorrelationCard` (deterministic, left) + `HypothesisCard` (hypothesis, right) reused directly, laid out in a 2-col grid instead of feeding `InvestigationItemTable`'s shared `<Table>` | existing files, new host |
| 5. Collapsed disclosures (Evidence / History / Sources / What Crado checked) | `EvidenceView`, `InvestigationTimeline`, `SourcesPanel` reused verbatim inside `<details>` rows; "What Crado checked" is a new thin wrapper combining `InvestigationTracePanel`'s compressed-summary line + `AgentMetricsPanel` | existing files inside new disclosure shells |
| 6. Composer | `CaseComposer`, relocated (see §1) | existing file, new position |

`InvestigationItemTable` (the shared-`<Table>` component) is retired —
it structurally cannot satisfy "the deterministic correlation and the
hypothesis do not share a table element" (acceptance criterion 4).
`failure-strip.tsx` and `next-action-bar.tsx` keep their filenames (same
data contract, materially different internals) rather than being
renamed, to minimize import churn.

## 3. Navigation

`ViewSwitcher`'s 5-tab segmented control is retired. Decision is the
page (no tab needed to reach it). Map becomes a single toggle button
near the case header — proposed placement: immediately left of the Run
button in `TopBar`'s `rightSlot`, labeled "Map" — that swaps the same
content region between the Decision layout and the existing
`InvestigationCanvas`/`MobileInvestigationStack`, as local state exactly
like today's `activeTab`, never a navigation/fetch. Evidence, History
(Timeline), and Sources stop being tabs and become the three named
disclosure rows in §2, closed by default.

**Confirming before building:** exact toggle placement/label ("Map" vs.
"View Map" vs. an icon button) is a two-way-door visual choice with no
behavioral consequence — I'll proceed with the TopBar placement above
unless told otherwise.

## 4. What gets deleted

- `InvestigationItemTable` (`investigation-item-table.tsx`) — retired,
  single real importer, no test file to migrate.
- `ViewSwitcher`'s 5-tab list — replaced by the Map toggle; the
  `InvestigationTab` union shrinks accordingly.
- The Trace pane's composer-docking footer — logic moves, not deleted.

Nothing else. `CorrelationCard`, `HypothesisCard`, `EvidenceView`,
`SourcesPanel`, `InvestigationTimeline`, `AgentMetricsPanel`,
`InvestigationTracePanel`, `NextActionBar`, `FailureStrip`, `TopBar`,
`ContextRail`, `CaseComposer`, `InvestigationCanvas`,
`MobileInvestigationStack` all stay, reused as-is or with internal-only
edits (props unchanged).

## 5. Test impact (moved, not weakened)

- `investigation-workspace.test.tsx`: two tests assert the *old*
  always-mounted Trace pane (`"keeps the Investigation trace pane
  visible... across every tab"` and `"shows a truthful empty state in
  the trace pane before any run has started"`). Both get rewritten to
  assert the *new* contract — Trace absent when idle, present and live
  when a run is active, "What Crado checked" carries the idle summary —
  same underlying guarantee (never a blank/misleading trace state),
  moved location. Tab-switching tests (`Map`/`Evidence`/`Timeline`/
  `Sources` button clicks) get updated to the new toggle + disclosure
  interactions, same assertions about what content becomes visible.
- `decision-view.test.tsx`: rewritten for the new layout order and the
  correlation/hypothesis card split; every existing assertion (row
  presence, click → `onSelectCorrelation`/`onSelectHypothesis`, ranking
  order, before/after-only-when-real-result) is preserved, re-targeted
  at the new markup.
- `next-action-bar.test.tsx`, `failure-strip` (no test file today — new
  one added), `correlation-card.test.tsx`, `hypothesis-card.test.tsx`,
  `evidence-view.test.tsx`, `sources-panel.test.tsx`,
  `investigation-timeline.test.tsx`, `agent-metrics-panel.test.tsx`,
  `investigation-trace-panel.test.tsx`: unaffected in isolation (props
  unchanged) except where a component's own internal markup changes
  (`FailureStrip`'s prose rewrite gets a new/updated test).
- New: a disclosure-row test (collapsed by default, opens on click,
  hosts the reused component) and a pane-state test (3→2 panes,
  composer position stable) alongside the workspace suite.
- `view-switcher.tsx`'s existing test coverage (inline in
  `investigation-workspace.test.tsx`, no dedicated file) shrinks to the
  Map-toggle behavior.

## 6. Acceptance-criteria cross-check

All 8 criteria map to concrete pieces above (no ellipsis truncation on
the promoted `NextActionBar`; no truncation anywhere text wraps instead;
Trace unmounted when idle; correlation/hypothesis never share a
`<Table>`; metrics only inside the closed-by-default disclosure; exactly
two primary buttons — Record result + Record engineering change, both
already `NextActionBar`'s existing actions — plus the composer; no fixed-
height empty panes, since disclosures replace fixed-percentage tab
bodies with content-sized `<details>`; existing tests moved per §5, none
weakened).

## Open questions before I build

1. Map-toggle placement (TopBar, per §3) — proceeding with that unless
   redirected.
2. Spectrum plot: ticket allows "legible size or remove it." Proposing
   to keep it, enlarged modestly (from the current 144×48px thumbnail)
   within the prose failure-summary line's second row, rather than
   removing it — cheaper than rebuilding the failure summary without
   it, and the plot is real data (peak/margin), not decoration.
3. `RecordEngineeringChangeForm` and the "Record result" button already
   live inside `NextActionBar` today — no change needed there beyond
   the bar's own repositioning/restyling.

Confirm to proceed, or redirect any of the above.
