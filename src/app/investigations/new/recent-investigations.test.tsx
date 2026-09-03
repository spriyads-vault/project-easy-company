import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestigationSummary } from "@/lib/investigations/queries";
import { RecentInvestigations } from "./recent-investigations";
import * as actions from "./actions";

function investigation(overrides: Partial<InvestigationSummary> = {}): InvestigationSummary {
  return {
    id: "case-1",
    title: "Radiated emissions investigation",
    status: "open",
    productId: "product-1",
    productName: "Gateway X",
    revisionLabel: "Rev17",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    latestMeasurement: { frequencyMhz: 200, marginDb: 7.4 },
    latestRunStatus: "completed",
    marginDeltaDb: null,
    workflowState: "ready_for_next_test",
    requiredNextAction: "Run the recommended next test",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecentInvestigations", () => {
  it("shows a skeleton before the fetch resolves", async () => {
    // Resolved explicitly before the test ends (never left permanently
    // pending) — an unresolved promise here would keep this test's async
    // load() alive for the rest of the file's run and could update state
    // on an unmounted component mid-way through a later test.
    let resolveFetch!: (value: Awaited<ReturnType<typeof actions.loadRecentInvestigations>>) => void;
    vi.spyOn(actions, "loadRecentInvestigations").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<RecentInvestigations />);
    expect(screen.getByText("Recent investigations")).toBeInTheDocument();
    // Skeleton cards carry no investigation text yet.
    expect(screen.queryByText("Gateway X")).not.toBeInTheDocument();

    resolveFetch({ investigations: [], error: false });
    await screen.findByText(/No investigations yet/);
  });

  it("renders real investigations with product, revision, workflow state, and required next action", async () => {
    vi.spyOn(actions, "loadRecentInvestigations").mockResolvedValue({
      investigations: [investigation()],
      error: false,
    });
    render(<RecentInvestigations />);

    expect(await screen.findByText("Gateway X")).toBeInTheDocument();
    expect(screen.getByText("Rev17")).toBeInTheDocument();
    expect(screen.getByText("Ready for next test")).toBeInTheDocument();
    expect(screen.getByText("Run the recommended next test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gateway X/ })).toHaveAttribute(
      "href",
      "/cases/case-1/investigation",
    );
  });

  it("shows a concise explanation and one example prompt for a real empty history — never a fake past case", async () => {
    vi.spyOn(actions, "loadRecentInvestigations").mockResolvedValue({ investigations: [], error: false });
    render(<RecentInvestigations />);

    expect(await screen.findByText(/No investigations yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /investigation/i })).not.toBeInTheDocument();
  });

  it("shows a local retry on a real query failure, and recovers on retry", async () => {
    const spy = vi
      .spyOn(actions, "loadRecentInvestigations")
      .mockResolvedValueOnce({ investigations: [], error: true })
      .mockResolvedValueOnce({ investigations: [investigation()], error: false });
    render(<RecentInvestigations />);

    expect(await screen.findByText(/Could not load recent investigations/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Gateway X")).toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("bounds the initial view and links to the full queue once there are more investigations than the limit", async () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      investigation({ id: `case-${index}`, title: `Investigation ${index}` }),
    );
    vi.spyOn(actions, "loadRecentInvestigations").mockResolvedValue({ investigations: many, error: false });
    render(<RecentInvestigations />);

    await waitFor(() => expect(screen.getAllByText("Gateway X")).toHaveLength(6));
    expect(screen.getByRole("link", { name: "View all investigations" })).toHaveAttribute(
      "href",
      "/investigations",
    );
  });

  it("orders investigations exactly as returned by the query (already most-recently-touched first)", async () => {
    vi.spyOn(actions, "loadRecentInvestigations").mockResolvedValue({
      investigations: [
        investigation({ id: "case-a", title: "First case" }),
        investigation({ id: "case-b", title: "Second case" }),
      ],
      error: false,
    });
    render(<RecentInvestigations />);

    await screen.findByText("First case");
    const links = screen.getAllByRole("link", { name: /Gateway X/ });
    expect(links[0]).toHaveTextContent("First case");
    expect(links[1]).toHaveTextContent("Second case");
  });
});
