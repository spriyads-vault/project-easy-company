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
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    // Immediately after the click, before the stream has delivered
    // anything: the button is already disabled and correlation/hypothesis
    // content is not present yet — proves this isn't a chat feed that
    // dumps everything at once.
    expect(screen.getByRole("button", { name: /analyzing/i })).toBeDisabled();
    expect(screen.queryByText("40 MHz × 5 = 200 MHz")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("40 MHz × 5 = 200 MHz")).toBeInTheDocument();
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

  it("reveals the deterministic correlation separately from the hypothesis, labeled a candidate relationship", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        buildSseResponse([runStarted(), measurementLoaded(), correlationFound(), hypothesisCreated(), runCompleted()], 0),
      ),
    );
    render(<InvestigationWorkspace {...baseProps} initialState={initialWorkspaceState} />);
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText("Candidate relationship")).toBeInTheDocument();
      // Appears twice by design once the MVP-11 timeline live-update fix
      // lands: the hypothesis card's own title, and the timeline entry
      // appended live from the same SSE event — see
      // investigation-workspace.tsx's hypothesis.created handling.
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

    expect(screen.queryByText("Investigation timeline")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getByText("Investigation timeline")).toBeInTheDocument();
      const timelineSection = screen.getByText("Investigation timeline").closest("section")!;
      expect(within(timelineSection).getByText("Hypothesis")).toBeInTheDocument();
      expect(
        within(timelineSection).getByText("5th harmonic of 40 MHz system clock"),
      ).toBeInTheDocument();
    });
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
    fireEvent.click(screen.getByRole("button", { name: /run investigation/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Candidate relationship")).toHaveLength(2);
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

    expect(screen.getByText("40 MHz × 5 = 200 MHz")).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText("Agent activity")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("What Crado handled")).toBeInTheDocument();
    });
    expect(screen.getByText("Searched engineering documents")).toBeInTheDocument();
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

    expect(screen.getByText("Agent activity")).toBeInTheDocument();
    expect(screen.getByText("What Crado handled")).toBeInTheDocument();
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

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /EMC-Test-04\.md/ }));

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

    expect(screen.queryByText("Agent activity")).not.toBeInTheDocument();
    expect(screen.queryByText("What Crado handled")).not.toBeInTheDocument();
    expect(screen.queryByText("Sources used")).not.toBeInTheDocument();
  });
});
