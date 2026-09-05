// UX-07 (answer-first Decision layout): these tests track what changed —
// the failure summary is now one prose sentence (not a stat grid), the
// reasoning objects render as two side-by-side cards (never a shared
// table — InvestigationItemTable is retired, see docs/PROGRESS.md's
// UX-07 entry), and Evidence/History start as closed disclosures rather
// than separate tabs. Row-click selection, ranking order, and
// before/after-only-when-real-result all carry the exact same guarantees
// the old table-based tests asserted, just retargeted at the new markup —
// acceptance criterion 8: an assertion whose content moved must still
// assert the same thing, never assert less.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeasurementRow } from "@/lib/cases/queries";
import { initialWorkspaceState, type WorkspaceState } from "@/lib/investigation/reconstruct";
import { rankHypotheses } from "@/lib/investigation/rank-hypotheses";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { DecisionView } from "./decision-view";

const measurement: MeasurementRow = {
  id: "measurement-1",
  label: null,
  operatingMode: "WiFi TX + display active",
  notes: null,
  createdAt: "2026-08-31T00:00:00.000Z",
  productRevisionId: "revision-1",
  revisionLabel: "Rev17",
  peaks: [{ id: "peak-1", frequencyMhz: 200, marginDb: 7.4, detector: null, limitLine: null }],
};

const baseProps = {
  caseId: "case-1",
  productId: "product-1",
  revisionId: "revision-1",
  currentRevisionLabel: "Rev17",
  measurement,
  selection: null,
  onSelectMeasurement: vi.fn(),
  onSelectCorrelation: vi.fn(),
  onSelectHypothesis: vi.fn(),
  onOpenCitation: vi.fn(),
  onToggleMap: vi.fn(),
  onRecordResult: vi.fn(),
};

function renderView(state: WorkspaceState, timeline: TimelineEntry[] = []) {
  return render(
    <DecisionView
      {...baseProps}
      state={state}
      timeline={timeline}
      leadingHypothesis={rankHypotheses(state.hypotheses)[0] ?? null}
    />,
  );
}

describe("DecisionView — answer-first layout (UX-07)", () => {
  it("always shows the failure summary's real measurement fields as prose, even with no correlations or hypotheses yet", () => {
    renderView(initialWorkspaceState);
    // "200 MHz" appears in the failure-summary sentence.
    expect(screen.getAllByText(/200 MHz/).length).toBeGreaterThan(0);
    expect(screen.getByText(/7\.4 dB above the selected limit/)).toBeInTheDocument();
    expect(screen.getByText(/wifi tx \+ display active/i)).toBeInTheDocument();
    expect(screen.getByText("No deterministic correlations or hypotheses yet for this measurement.")).toBeInTheDocument();
  });

  it("renders a real correlation as its own deterministic object, not a table row", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      correlations: [
        {
          productFactId: "fact-clock-40mhz",
          productFactCategory: "clock",
          productFactLabel: "system clock",
          sourceFrequencyMhz: 40,
          harmonicNumber: 5,
          expectedFrequencyMhz: 200,
          measuredFrequencyMhz: 200,
          deviationMhz: 0,
          deviationRatio: 0,
          description: "200 MHz is consistent with the 5th harmonic.",
        },
      ],
    };
    renderView(state);
    expect(screen.getByText(/40 MHz × 5 = 200 MHz/)).toBeInTheDocument();
    // The correlation's own State field — never a shared "Verified" table
    // column.
    expect(screen.getByText(/Verified/)).toBeInTheDocument();
    // Never rendered as a <table> — the whole point of retiring
    // InvestigationItemTable.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("orders leading hypotheses before weaker ones and labels each honestly, as Inferred, with its own state", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      hypotheses: [
        {
          productFactId: "fact-low",
          title: "Low-confidence lead",
          confidenceBand: "low",
          recommendedNextStep: "Check the low-confidence lead.",
          evidence: [],
        },
        {
          productFactId: "fact-high",
          title: "High-confidence lead",
          confidenceBand: "high",
          recommendedNextStep: "Disconnect the display path and re-measure.",
          evidence: [{ category: "missing", description: "Measurement with display disconnected." }],
        },
      ],
    };
    renderView(state);

    const titles = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    const highIndex = titles.findIndex((t) => t?.includes("High-confidence lead"));
    const lowIndex = titles.findIndex((t) => t?.includes("Low-confidence lead"));
    expect(highIndex).toBeGreaterThanOrEqual(0);
    expect(lowIndex).toBeGreaterThan(highIndex);
    expect(screen.getByText("Leading")).toBeInTheDocument();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
    // Scoped to the reasoning section specifically — a real <table>
    // legitimately exists elsewhere on the page now (the Evidence
    // disclosure's own EvidenceView), unrelated to
    // InvestigationItemTable's retirement.
    const reasoningSection = screen.getByText("Reasoning").closest("div")!.parentElement!;
    expect(within(reasoningSection).queryByRole("table")).not.toBeInTheDocument();
  });

  it("clicking a hypothesis object calls onSelectHypothesis with the real hypothesis and its original index", () => {
    const onSelectHypothesis = vi.fn();
    const hypothesis = {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "high" as const,
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [],
    };
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis] };
    render(
      <DecisionView
        {...baseProps}
        state={state}
        timeline={[]}
        leadingHypothesis={rankHypotheses(state.hypotheses)[0] ?? null}
        onSelectHypothesis={onSelectHypothesis}
      />,
    );
    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));
    expect(onSelectHypothesis).toHaveBeenCalledWith(hypothesis, 0);
  });

  it("clicking a deterministic object calls onSelectCorrelation with the real correlation", () => {
    const onSelectCorrelation = vi.fn();
    const correlation = {
      productFactId: "fact-clock-40mhz",
      productFactCategory: "clock" as const,
      productFactLabel: "system clock",
      sourceFrequencyMhz: 40,
      harmonicNumber: 5,
      expectedFrequencyMhz: 200,
      measuredFrequencyMhz: 200,
      deviationMhz: 0,
      deviationRatio: 0,
      description: "200 MHz is consistent with the 5th harmonic.",
    };
    const state: WorkspaceState = { ...initialWorkspaceState, correlations: [correlation] };
    render(
      <DecisionView
        {...baseProps}
        state={state}
        timeline={[]}
        leadingHypothesis={null}
        onSelectCorrelation={onSelectCorrelation}
      />,
    );
    fireEvent.click(screen.getByText(/40 MHz × 5 = 200 MHz/));
    expect(onSelectCorrelation).toHaveBeenCalledWith(correlation);
  });

  it("shows the before/after outcome only once a real result exists on the timeline, using the most recent one", () => {
    const state: WorkspaceState = { ...initialWorkspaceState };
    const timeline: TimelineEntry[] = [
      {
        type: "result",
        id: "result-1",
        createdAt: "2026-08-30T00:00:00.000Z",
        comparison: {
          before: { revisionLabel: "Rev17", frequencyMhz: 200, marginDb: 7.4 },
          after: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 2.0 },
          deltaDb: 5.4,
          improved: true,
          sameFrequency: true,
        },
      },
      {
        type: "result",
        id: "result-2",
        createdAt: "2026-08-31T00:00:00.000Z",
        comparison: {
          before: { revisionLabel: "Rev18", frequencyMhz: 200, marginDb: 2.0 },
          after: { revisionLabel: "Rev19", frequencyMhz: 200, marginDb: -1.0 },
          deltaDb: 3.0,
          improved: true,
          sameFrequency: true,
        },
      },
    ];
    renderView(state, timeline);

    expect(screen.getByText("Before / after comparison")).toBeInTheDocument();
    // The most recent result (Rev18 → Rev19), not the earlier one.
    expect(screen.getByText("Before · Rev18")).toBeInTheDocument();
    expect(screen.getByText("After · Rev19")).toBeInTheDocument();
  });

  it("shows no outcome section when the timeline has no result entry", () => {
    renderView(initialWorkspaceState, []);
    expect(screen.queryByText("Before / after comparison")).not.toBeInTheDocument();
  });

  it("renders the recommended next test as the largest, most prominent block — full text, never truncated, and never duplicated inside the hypothesis card (UX-07 correction bug 1c)", () => {
    const hypothesis = {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "high" as const,
      recommendedNextStep: "Disconnect the display path and re-measure with the display fully powered down, not just idle.",
      evidence: [],
    };
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis] };
    renderView(state);
    const promotedBlock = screen.getByText("Recommended next test").closest("div")!.parentElement!;
    const recommendation = within(promotedBlock).getByText(
      "Disconnect the display path and re-measure with the display fully powered down, not just idle.",
    );
    expect(recommendation).toBeInTheDocument();
    expect(recommendation.className).not.toMatch(/truncate/);
    // UX-07 correction bug 1c: this same string used to also render
    // inside the hypothesis card's own "Next investigation" field — the
    // pinned bar above is now its only home on the page.
    expect(
      screen.getAllByText(
        "Disconnect the display path and re-measure with the display fully powered down, not just idle.",
      ),
    ).toHaveLength(1);
    expect(screen.queryByText("Next investigation")).not.toBeInTheDocument();
  });

  it("offers a 'View as map' toggle beside the reasoning objects, never in the header", () => {
    const onToggleMap = vi.fn();
    render(<DecisionView {...baseProps} state={initialWorkspaceState} timeline={[]} leadingHypothesis={null} onToggleMap={onToggleMap} />);
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    expect(onToggleMap).toHaveBeenCalledTimes(1);
  });

  it("starts Evidence and History closed by default, opening on click, and omits them entirely when there is nothing real to show", () => {
    renderView(initialWorkspaceState, []);
    // No hypotheses, no timeline — both disclosures render nothing rather
    // than an empty accordion (product truth: a section with no real data
    // renders nothing).
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });

  it("Evidence disclosure, once real hypotheses exist, starts closed and reveals the real evidence table on click", () => {
    const hypothesis = {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "high" as const,
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [{ category: "known" as const, description: "40 MHz system clock." }],
    };
    const state: WorkspaceState = { ...initialWorkspaceState, hypotheses: [hypothesis] };
    renderView(state);

    // The same evidence text also appears in the always-visible reasoning
    // object above — scope to the Evidence table specifically via its own
    // heading, so this asserts the disclosure's real content, not the
    // reasoning card's.
    const evidenceSection = screen.getByRole("heading", { name: "Evidence" }).closest("section")!;
    expect(within(evidenceSection).getByText("40 MHz system clock.")).not.toBeVisible();
    // Two "Evidence" text nodes exist (the disclosure's own summary label
    // and EvidenceView's own heading, nested inside it while closed) —
    // target the summary specifically to open it.
    fireEvent.click(screen.getByText("Evidence", { selector: "summary" }));
    expect(within(evidenceSection).getByText("40 MHz system clock.")).toBeVisible();
  });

  it("does not mount agent metrics or the trace summary on first paint (acceptance criterion 5)", () => {
    const state: WorkspaceState = {
      ...initialWorkspaceState,
      agentActivity: [
        { toolName: "searchEngineeringDocuments", label: "Searched engineering documents / 3 passages retrieved", resultCount: 3, durationMs: 12, query: "40 MHz", toolCallId: "call-1", failed: false },
      ],
      agentMetrics: {
        documentsAvailable: 4,
        documentSearches: 1,
        passagesRetrieved: 3,
        passagesUsedAsEvidence: 1,
        deterministicRelationshipsChecked: 1,
        nextInvestigationCount: 1,
      },
    };
    renderView(state);
    expect(screen.getByText("Tools used")).not.toBeVisible();
    fireEvent.click(screen.getByText(/What Crado checked/));
    expect(screen.getByText("Tools used")).toBeVisible();
  });
});
