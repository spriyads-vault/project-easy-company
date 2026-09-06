import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonToSseTransformStream } from "ai";
import type { AnalysisEvent } from "@/lib/analysis/events";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import {
  initialWorkspaceState,
  reconstructFromPersistedEvents,
} from "@/lib/investigation/reconstruct";
import { InvestigationWorkspace } from "./investigation-workspace";

const productFacts: ProductFactRecord[] = [
  {
    id: "fact-clock-40mhz",
    category: "clock",
    fact: { label: "System clock", frequencyMhz: 40 },
    source: "user_entered",
  },
];

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
  productFacts,
  measurement,
};

function event(
  overrides: Partial<AnalysisEvent> & Pick<AnalysisEvent, "type" | "payload">,
): AnalysisEvent {
  return {
    runId: "run-1",
    sequence: 0,
    createdAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  } as AnalysisEvent;
}

const runStarted = () =>
  event({ type: "run.started", sequence: 0, payload: { failureCaseId: "case-1", measurementId: "measurement-1" } });
const measurementLoaded = () =>
  event({
    type: "measurement.loaded",
    sequence: 1,
    payload: { measurementId: "measurement-1", frequencyMhz: 200, marginDb: 7.4, operatingMode: "WiFi TX + display active" },
  });
const correlationFound = (productFactId = "fact-clock-40mhz", sourceFrequencyMhz = 40) =>
  event({
    type: "correlation.found",
    sequence: 2,
    payload: {
      productFactId,
      productFactCategory: "clock",
      productFactLabel: "system clock",
      sourceFrequencyMhz,
      harmonicNumber: 5,
      expectedFrequencyMhz: 200,
      measuredFrequencyMhz: 200,
      deviationMhz: 0,
      deviationRatio: 0,
      description: "200 MHz is consistent with the 5th harmonic.",
    },
  });
const hypothesisCreated = () =>
  event({
    type: "hypothesis.created",
    sequence: 3,
    payload: {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "medium",
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [
        { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
        { category: "known", description: "40 MHz system clock." },
        { category: "inferred", description: "The fifth harmonic relationship may be relevant." },
        { category: "missing", description: "Measurement with display disconnected." },
      ],
    },
  });
const clarificationRequired = () =>
  event({ type: "clarification.required", sequence: 4, payload: { question: "Was the display refresh clock documented?" } });
const runCompleted = (overrides: Partial<{ correlationsFound: number; hypothesesCreated: number; clarificationRequired: boolean }> = {}) =>
  event({
    type: "run.completed",
    sequence: 5,
    payload: {
      correlationsFound: overrides.correlationsFound ?? 1,
      hypothesesCreated: overrides.hypothesesCreated ?? 1,
      clarificationRequired: overrides.clarificationRequired ?? false,
    },
  });
const runFailed = () =>
  event({ type: "run.failed", sequence: 1, payload: { message: "Analysis failed unexpectedly. Please try again or contact support." } });

const agentStarted = () =>
  event({ type: "agent.started", sequence: 3, payload: { correlationCount: 1 } });
const agentToolCompleted = (overrides: Partial<{ toolName: string; label: string; query: string | null }> = {}) =>
  event({
    type: "agent.tool.completed",
    sequence: 4,
    payload: {
      toolName: overrides.toolName ?? "searchEngineeringDocuments",
      label: overrides.label ?? "Searched engineering documents / 3 passages retrieved",
      resultCount: 3,
      durationMs: 12,
      query: overrides.query === undefined ? "40 MHz display cable" : overrides.query,
    },
  });
const agentCompleted = (overrides: Partial<{ documentsAvailable: number; passagesUsedAsEvidence: number }> = {}) =>
  event({
    type: "agent.completed",
    sequence: 5,
    payload: {
      documentsAvailable: overrides.documentsAvailable ?? 4,
      documentSearches: 1,
      passagesRetrieved: 3,
      passagesUsedAsEvidence: overrides.passagesUsedAsEvidence ?? 1,
      deterministicRelationshipsChecked: 1,
      nextInvestigationCount: 1,
    },
  });
const hypothesisCreatedWithCitation = () =>
  event({
    type: "hypothesis.created",
    sequence: 6,
    payload: {
      productFactId: "fact-clock-40mhz",
      title: "5th harmonic of 40 MHz system clock",
      confidenceBand: "medium",
      recommendedNextStep: "Disconnect the display path and re-measure.",
      evidence: [
        { category: "observed", description: "200 MHz peak, 7.4 dB above the selected limit." },
        {
          category: "known",
          description: 'EMC-Test-04.md (Suspected Source): "The 40 MHz clock is a candidate."',
          citation: {
            documentId: "doc-1",
            chunkId: "chunk-1",
            filename: "EMC-Test-04.md",
            documentType: "test_report",
            pageNumber: null,
            section: "Suspected Source",
            passage: "The 40 MHz clock is a candidate.",
          },
        },
        { category: "inferred", description: "The fifth harmonic relationship may be relevant." },
        { category: "missing", description: "Measurement with display disconnected." },
      ],
    },
  });

/** Builds a mock SSE Response using the exact framing the real route
 * produces (ai's JsonToSseTransformStream), so the client's parser is
 * exercised against real byte framing, not a hand-rolled approximation.
 * `delayMs` between enqueues makes updates observably progressive rather
 * than resolving in one microtask. */
function buildSseResponse(events: AnalysisEvent[], delayMs = 10): Response {
  const source = new ReadableStream<AnalysisEvent>({
    async start(controller) {
      for (const evt of events) {
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
        controller.enqueue(evt);
      }
      controller.close();
    },
  });
  const body = source
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream());
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InvestigationWorkspace — streaming", () => {
  it("updates panels progressively as typed events stream in (progressive SSE updates)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildSseResponse([runStarted(), measurementLoaded(), correlationFound(), hypothesisCreated(), runCompleted()]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    // UX-05: Decision is the default tab now — switch to Map so this
    // test's assertions still exercise the React Flow canvas's own
    // (compact) node rendering, unchanged from before.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    // Immediately after the click, before the stream has delivered
    // anything: the button is already disabled and correlation/hypothesis
    // content is not present yet — proves this isn't a chat feed that
    // dumps everything at once.
    expect(screen.getByRole("button", { name: /analyzing/i })).toBeDisabled();
    expect(screen.queryByText("40 × 5 = 200")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("40 × 5 = 200")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis-runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ failureCaseId: "case-1", measurementId: "measurement-1" }),
      }),
    );
  });

  it("reveals the deterministic correlation separately from the hypothesis, labeled a candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse([runStarted(), measurementLoaded(), correlationFound(), hypothesisCreated(), runCompleted()], 0),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    // UX-05: Decision is the default tab now — switch to Map for this
    // canvas-node-rendering-specific assertion.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText("Candidate")).toBeInTheDocument();
      expect(screen.getAllByText("5th harmonic of 40 MHz system clock").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("updates the investigation timeline immediately when a hypothesis streams in, with no refresh (MVP-11 timeline live-update fix)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse([runStarted(), measurementLoaded(), correlationFound(), hypothesisCreated(), runCompleted()], 0),
      ),
    );
    // Starts with an empty server-fetched timeline — as if this were the
    // very first run for a fresh page load — so any timeline entry that
    // appears must have come from the live SSE event, not the initial prop.
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} timelineEntries={[]} />);

    // UX-07: History is a closed-by-default disclosure on the Decision
    // page, not its own tab — and product truth means it doesn't render
    // at all when there's genuinely nothing on the timeline yet (see
    // decision-view.tsx's `timeline.length > 0` gate), a stronger honest
    // guarantee than the old "tab exists but shows nothing inside" state.
    expect(screen.queryByText("History")).not.toBeInTheDocument();

    // The run button lives in the header, reachable regardless of which
    // view is showing — Decision is already the default, so no tab
    // switch is needed to reach it.
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });

    // The live-updated timeline state is already there without a refresh
    // — opening History just reveals it.
    fireEvent.click(screen.getByText("History"));
    const timelineSection = screen.getByText("Investigation timeline").closest("section")!;
    expect(within(timelineSection).getByText("Hypothesis")).toBeInTheDocument();
    expect(
      within(timelineSection).getByText("5th harmonic of 40 MHz system clock"),
    ).toBeInTheDocument();
  });

  it("renders multiple correlations when more than one candidate is found (multiple correlations case)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [
            runStarted(),
            measurementLoaded(),
            correlationFound("fact-clock-40mhz", 40),
            correlationFound("fact-radio-2400", 2400),
            runCompleted({ correlationsFound: 2, hypothesesCreated: 0 }),
          ],
          0,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    // UX-05: Decision is the default tab now — switch to Map for this
    // canvas-node-rendering-specific assertion.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Candidate")).toHaveLength(2);
    });
  });

  it("shows the clarification question distinctly, not as a chat message (clarification.required)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [runStarted(), measurementLoaded(), hypothesisCreated(), clarificationRequired(), runCompleted({ clarificationRequired: true })],
          0,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText("Additional information needed")).toBeInTheDocument();
      expect(screen.getByText("Was the display refresh clock documented?")).toBeInTheDocument();
    });
  });

  it("shows a recoverable error state on run.failed and allows retrying (failed state)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildSseResponse([runStarted(), runFailed()], 0)));
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Analysis failed unexpectedly. Please try again or contact support.",
      );
    });
    expect(screen.getByRole("button", { name: /run again/i })).not.toBeDisabled();
  });

  it("shows a recoverable error state when the connection drops before a terminal event arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildSseResponse([runStarted(), measurementLoaded()], 0)));
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/connection closed before the analysis finished/i);
    });
  });

  it("shows a clear message when the run completes with no correlations or hypotheses (empty hypotheses case)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [runStarted(), measurementLoaded(), runCompleted({ correlationsFound: 0, hypothesesCreated: 0, clarificationRequired: false })],
          0,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText(/no harmonic correlations were found/i)).toBeInTheDocument();
    });
  });

  it("states a relationship was found but no hypothesis was produced, and offers Run again (FIX-01 honest empty state)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [
            runStarted(),
            measurementLoaded(),
            correlationFound(),
            runCompleted({ correlationsFound: 1, hypothesesCreated: 0, clarificationRequired: false }),
          ],
          0,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText("No hypothesis produced")).toBeInTheDocument();
      expect(
        screen.getByText(/a frequency relationship was found, but this run did not produce/i),
      ).toBeInTheDocument();
    });
    // The one RUN AGAIN control (the top status-bar button, already
    // relabeled now that a run has completed) stays enabled — no separate,
    // ambiguously-duplicate button is rendered for this state.
    expect(screen.getByRole("button", { name: /run again/i })).not.toBeDisabled();
  });

  it("adds React Flow canvas nodes incrementally as events stream in — never empty after completion (UX-04 reopened)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [runStarted(), measurementLoaded(), correlationFound(), hypothesisCreated(), runCompleted()],
          15,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    // UX-05: Decision is the default tab now — switch to Map so the React
    // Flow canvas is actually mounted for this test.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    // The Measurement node comes from the `measurement` prop, not the
    // stream — it's already present before any event has arrived, so the
    // canvas is never in a genuinely empty state right after the click.
    expect(document.querySelectorAll(".react-flow__node").length).toBeGreaterThanOrEqual(1);
    const countBeforeStreamCompletes = document.querySelectorAll(".react-flow__node").length;

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });

    // More nodes exist once correlation/hypothesis events have streamed in
    // than existed right after the click — the canvas grew with the
    // stream, it didn't jump from nothing to everything in one batch, and
    // it's non-empty once the run reports complete (the reported defect).
    const countAfterCompletion = document.querySelectorAll(".react-flow__node").length;
    expect(countAfterCompletion).toBeGreaterThan(countBeforeStreamCompletes);
    expect(document.querySelectorAll(".react-flow__node").length).toBeGreaterThan(0);
  });

  it("does not fire a second request while one run is active (duplicate-run protection)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSseResponse([runStarted(), runCompleted({ hypothesesCreated: 0, correlationsFound: 0 })], 20));
    vi.stubGlobal("fetch", fetchMock);

    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    const button = screen.getByRole("button", { name: /run investigation/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("InvestigationWorkspace — refresh reconstruction", () => {
  it("renders a completed investigation from persisted events without calling fetch (refresh reconstruction, does not rerun Anthropic)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      runCompleted(),
    ]);

    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map for this
    // canvas-node-rendering-specific assertion.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    expect(screen.getByText("40 × 5 = 200")).toBeInTheDocument();
    expect(screen.getByText("5th harmonic of 40 MHz system clock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reconstructs an interrupted run as a recoverable state, not a stuck 'analyzing' state", () => {
    const persistedState = reconstructFromPersistedEvents([runStarted(), measurementLoaded()]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/didn't finish/i);
    expect(screen.getByRole("button", { name: /run again/i })).not.toBeDisabled();
  });
});

describe("InvestigationWorkspace — controls and accessibility", () => {
  it("disables the run button and explains why when there is no measurement yet", () => {
    render(<InvestigationWorkspace {...baseProps} measurement={null} initialState={initialWorkspaceState} />);
    const button = screen.getByRole("button", { name: /run investigation/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Add a measurement before running an investigation.");
  });

  it("exposes the run status as a live region and errors as an alert (accessibility of controls/status)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildSseResponse([runStarted(), runFailed()], 0)));
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("InvestigationWorkspace — Investigation Agent (MVP-10C)", () => {
  it("shows agent activity progressively as it streams in, then the truthful metrics once agent.completed arrives", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [
            runStarted(),
            measurementLoaded(),
            correlationFound(),
            agentStarted(),
            agentToolCompleted(),
            agentCompleted(),
            hypothesisCreatedWithCitation(),
            runCompleted(),
          ],
          5,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    // While the run is active, the live Trace pane (a dedicated resizable
    // pane, not part of Decision's own content) shows progress directly.
    await waitFor(() => {
      expect(screen.getByText(/Searched engineering documents/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });

    // UX-07: once the run finishes, the Trace pane folds into the "What
    // Crado checked" disclosure on the Decision page (closed by default)
    // — its content (including the truthful agent.completed metrics) is
    // present, not shown up front.
    expect(screen.getByText("What Crado handled")).not.toBeVisible();
    fireEvent.click(screen.getByText(/What Crado checked/));
    expect(screen.getByText("What Crado handled")).toBeVisible();

    // Sources is its own closed-by-default disclosure (UX-07) — not shown
    // on first paint either.
    fireEvent.click(screen.getByText("Sources"));
    expect(screen.getByText("Sources used")).toBeInTheDocument();
  });

  it("replays a completed run's agent activity, metrics, and sources from persisted state without calling fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      agentStarted(),
      agentToolCompleted(),
      agentCompleted(),
      hypothesisCreatedWithCitation(),
      runCompleted(),
    ]);

    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);

    // UX-07: this run is already complete on first render (reconstructed
    // from persisted events, not streamed) — the trace and its metrics
    // are real and present, folded into the closed-by-default "What
    // Crado checked" disclosure rather than an always-visible pane.
    expect(screen.getByText("Investigation trace")).not.toBeVisible();
    expect(screen.getByText("What Crado handled")).not.toBeVisible();
    fireEvent.click(screen.getByText(/What Crado checked/));
    expect(screen.getByText("Investigation trace")).toBeVisible();
    expect(screen.getByText("What Crado handled")).toBeVisible();

    // Sources is its own closed-by-default disclosure (UX-07).
    fireEvent.click(screen.getByText("Sources"));
    expect(screen.getByText("EMC-Test-04.md")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the source drawer with the exact stored passage when a citation is clicked, and closes it on Escape", async () => {
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      agentStarted(),
      agentToolCompleted(),
      agentCompleted(),
      hypothesisCreatedWithCitation(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map, where the
    // hypothesis node's own click-to-select behavior (not just its
    // "Details" button) lives.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // UX-04: the hypothesis node itself only shows a compact summary —
    // clicking it opens the full detail (including sourced citations) in
    // the context rail, which is where the citation button now lives.
    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));
    const rail = screen.getByLabelText("Case context");
    fireEvent.click(within(rail).getByRole("button", { name: /EMC-Test-04\.md/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("The 40 MHz clock is a candidate.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Hypothesis 01/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows the honest 'no passages used as evidence' state when the agent searched but found nothing usable", () => {
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      agentStarted(),
      agentCompleted({ passagesUsedAsEvidence: 0 }),
      runCompleted({ hypothesesCreated: 0 }),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);

    fireEvent.click(screen.getByText("Sources"));
    expect(
      screen.getByText("No document passages were used as evidence in this investigation."),
    ).toBeInTheDocument();
  });

  it("omits the metrics/sources rows entirely for a run that never reached the agent phase (no correlations)", () => {
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      runCompleted({ correlationsFound: 0, hypothesesCreated: 0 }),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);

    expect(screen.queryByText("Investigation trace")).not.toBeInTheDocument();
    expect(screen.queryByText("What Crado handled")).not.toBeInTheDocument();
    expect(screen.queryByText("Sources used")).not.toBeInTheDocument();
  });

  it("never duplicates the trace across the Map toggle or the Evidence/History/Sources disclosures (UX-07: same guarantee as the old persistent-across-every-tab pane, different presentation)", () => {
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      agentStarted(),
      agentToolCompleted(),
      agentCompleted(),
      hypothesisCreatedWithCitation(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);

    // The run is already complete — the trace lives inside "What Crado
    // checked", present exactly once (not visible until opened).
    expect(screen.getAllByText("Investigation trace")).toHaveLength(1);
    expect(screen.getByText("Investigation trace")).not.toBeVisible();

    // Toggling to Map replaces Decision's own content (including its
    // disclosures) with the graph — the trace isn't duplicated there
    // (Map shows the same reasoning as a graph, not a second trace copy)
    // — and toggling back brings the exact same single copy back,
    // undisturbed, never a second one appearing alongside it.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));
    expect(screen.queryByText("Investigation trace")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Back to decision" }));
    expect(screen.getAllByText("Investigation trace")).toHaveLength(1);

    // Opening the other disclosures (Evidence, then Sources) doesn't
    // duplicate or hide the trace either.
    fireEvent.click(screen.getByText("Evidence", { selector: "summary" }));
    fireEvent.click(screen.getByText("Sources", { selector: "summary" }));
    expect(screen.getAllByText("Investigation trace")).toHaveLength(1);

    // Opening "What Crado checked" itself reveals the same single copy,
    // now visible.
    fireEvent.click(screen.getByText(/What Crado checked/));
    expect(screen.getAllByText("Investigation trace")).toHaveLength(1);
    expect(screen.getByText("Investigation trace")).toBeVisible();
  });

  it("shows the trace live in its own pane only while a run is active, then folds it into 'What Crado checked' once it finishes — never both, never a leftover live pane", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse(
          [runStarted(), measurementLoaded(), correlationFound(), agentStarted(), agentToolCompleted(), agentCompleted(), runCompleted()],
          10,
        ),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);

    // Idle: no trace pane, nothing to check yet — checked synchronously,
    // before any SSE event can possibly have arrived (buildSseResponse
    // delays even its first enqueue), the same non-racy pattern the
    // "updates panels progressively" test above already relies on for
    // its own immediately-after-click assertions.
    expect(screen.queryByText("Investigation trace")).not.toBeInTheDocument();
    expect(screen.queryByText(/What Crado checked/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
    });

    // Complete: exactly one copy, now folded into the closed-by-default
    // disclosure — never a leftover live pane still mounted alongside it.
    // (Real-timer event delays make a reliable "still mid-run" checkpoint
    // impractical here without flaking — that half of the guarantee is
    // covered instead by "shows agent activity progressively..." above,
    // which already waits on live Trace-pane content appearing while a
    // run streams in.)
    expect(screen.getAllByText("Investigation trace")).toHaveLength(1);
    expect(screen.getByText("Investigation trace")).not.toBeVisible();
    expect(screen.getByText(/What Crado checked/)).toBeInTheDocument();
  });

  it("renders no trace-related pane or section at all before any run has started (UX-07: stronger than the old placeholder-text pane — the 2-pane idle layout has nothing to show, so it shows nothing, rather than an empty pane implying there's something to look at)", () => {
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    expect(screen.queryByText("Investigation trace")).not.toBeInTheDocument();
    expect(screen.queryByText(/What Crado checked/)).not.toBeInTheDocument();
    // The old placeholder copy is retired along with the always-rendered
    // Trace pane it lived in — there's no pane left for it to sit in.
    expect(
      screen.queryByText("No trace yet. Run an investigation to see Crado’s live agent activity here."),
    ).not.toBeInTheDocument();
  });
});

/** Simulates a viewport matching exactly the given media query strings by
 * making `window.matchMedia` report `matches: true` only for queries in
 * `matchingQueries` — the same mechanism a real narrow browser window
 * drives, without needing an actual layout engine (jsdom has none). */
function mockViewport(matchingQueries: string[]) {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchingQueries.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: matchMedia });
}

// Three tiers, matching investigation-workspace.tsx's own CANVAS_QUERY
// ("(max-width: 767px)") and RAIL_QUERY ("(max-width: 1023px)"): below
// 768 both queries match (mobile stack); 768-1023 only the rail query
// matches (canvas, no persistent rail — the ticket's "laptop/tablet"
// tier); 1024+ neither matches (canvas + persistent rail).
const mockMobileViewport = () => mockViewport(["(max-width: 767px)", "(max-width: 1023px)"]);
const mockTabletViewport = () => mockViewport(["(max-width: 1023px)"]);

describe("InvestigationWorkspace — responsive breakpoints (UX-04 visual correction)", () => {
  afterEach(() => {
    // @ts-expect-error -- test-only cleanup of the property this suite defines.
    delete window.matchMedia;
  });

  it("renders the investigation stack (not the React Flow canvas) below the mobile breakpoint, with the same artifacts", () => {
    mockMobileViewport();
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map, where the
    // mobile stack (this breakpoint's canvas substitute) lives.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    expect(screen.getByRole("list", { name: "Investigation, in order" })).toBeInTheDocument();
    expect(screen.getByText("5th harmonic of 40 MHz system clock")).toBeInTheDocument();
    // The desktop-only resizable rail never mounts on this branch.
    expect(screen.queryByLabelText("Case context")).not.toBeInTheDocument();
  });

  it("opens the hypothesis detail in a bottom sheet — the mobile substitute for the persistent rail — when a stack artifact is tapped", () => {
    mockMobileViewport();
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map, where the
    // mobile stack (this breakpoint's canvas substitute) lives.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText("Case context")).toBeInTheDocument();
    expect(within(sheet).getByText("Disconnect the display path and re-measure.")).toBeInTheDocument();
  });

  it("still lets an engineer reach the composer and record an observation on mobile (no primary capability becomes desktop-only)", () => {
    mockMobileViewport();
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    expect(screen.getByPlaceholderText(/tell crado/i)).toBeInTheDocument();
  });

  it("renders the real canvas (not the mobile stack) at the laptop/tablet tier, with the Sheet substituting for the persistent rail", () => {
    mockTabletViewport();
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map, where the
    // canvas lives at this breakpoint.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    // The canvas, identified by React Flow's own application role — not
    // the mobile stack's plain <ol>.
    expect(screen.getByRole("application")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Investigation, in order" })).not.toBeInTheDocument();
    // No persistent rail at this width either — same Sheet substitute the
    // mobile tier uses.
    expect(screen.queryByLabelText("Case context")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByLabelText("Case context")).toBeInTheDocument();
  });

  it("renders the canvas with the real persistent resizable Inspector at the large-desktop tier, collapsed by default and expanding on selection (App Redesign)", () => {
    const persistedState = reconstructFromPersistedEvents([
      runStarted(),
      measurementLoaded(),
      correlationFound(),
      hypothesisCreated(),
      runCompleted(),
    ]);
    render(<InvestigationWorkspace {...baseProps} initialState={persistedState} />);
    // UX-05: Decision is the default tab now — switch to Map, where the
    // canvas + persistent Inspector live at this breakpoint.
    fireEvent.click(screen.getByRole("button", { name: "View as map" }));

    expect(screen.getByRole("application")).toBeInTheDocument();
    // App Redesign: the Inspector starts collapsed to a narrow rail, not a
    // large empty "nothing selected" panel — the main workbench gets the
    // recovered width until a real selection happens.
    expect(screen.queryByLabelText("Case context")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show case panel" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("5th harmonic of 40 MHz system clock"));
    expect(screen.getByLabelText("Case context")).toBeInTheDocument();
  });
});
