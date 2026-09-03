import { describe, expect, it } from "vitest";
import { describeLatestAction, groupInvestigation } from "./describe-investigation-status";
import type { InvestigationSummary } from "./queries";

function investigation(overrides: Partial<InvestigationSummary> = {}): InvestigationSummary {
  return {
    id: "case-1",
    title: "Radiated emissions investigation",
    status: "open",
    productId: "product-1",
    productName: "Gateway X",
    revisionLabel: "Rev17",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    latestMeasurement: null,
    latestRunStatus: null,
    marginDeltaDb: null,
    workflowState: "idle",
    requiredNextAction: "Run the investigation",
    ...overrides,
  };
}

describe("groupInvestigation", () => {
  it("groups an open case as active (positive case)", () => {
    expect(groupInvestigation(investigation({ status: "open" }))).toBe("active");
  });

  it("groups a resolved case as recent (negative case)", () => {
    expect(groupInvestigation(investigation({ status: "resolved" }))).toBe("recent");
  });

  it("groups an archived case as recent (boundary case)", () => {
    expect(groupInvestigation(investigation({ status: "archived" }))).toBe("recent");
  });
});

describe("describeLatestAction", () => {
  it("shows a running run as investigating, even with other data present", () => {
    expect(
      describeLatestAction(
        investigation({ latestRunStatus: "running", marginDeltaDb: 5, latestMeasurement: { frequencyMhz: 200, marginDb: 2 } }),
      ),
    ).toBe("Investigating…");
  });

  it("shows a real computed margin improvement (positive case)", () => {
    expect(describeLatestAction(investigation({ marginDeltaDb: 11 }))).toBe("11 dB measured improvement");
  });

  it("shows a real computed margin regression (negative case)", () => {
    expect(describeLatestAction(investigation({ marginDeltaDb: -3.5 }))).toBe("3.5 dB measured regression");
  });

  it("shows no measured change for a zero delta (boundary case)", () => {
    expect(describeLatestAction(investigation({ marginDeltaDb: 0 }))).toBe("No measured change");
  });

  it("shows waiting for a measurement when none exists (missing-data case)", () => {
    expect(describeLatestAction(investigation({ latestMeasurement: null, marginDeltaDb: null }))).toBe(
      "Waiting for a measurement",
    );
  });

  it("shows investigation complete for a resolved case with a measurement", () => {
    expect(
      describeLatestAction(
        investigation({ status: "resolved", latestMeasurement: { frequencyMhz: 200, marginDb: 2 } }),
      ),
    ).toBe("Investigation complete");
  });

  it("shows investigation complete when the latest run completed", () => {
    expect(
      describeLatestAction(
        investigation({ latestRunStatus: "completed", latestMeasurement: { frequencyMhz: 200, marginDb: 2 } }),
      ),
    ).toBe("Investigation complete");
  });

  it("shows the last run failed", () => {
    expect(
      describeLatestAction(
        investigation({ latestRunStatus: "failed", latestMeasurement: { frequencyMhz: 200, marginDb: 2 } }),
      ),
    ).toBe("Last run failed");
  });

  it("shows waiting for evidence for an open case with a measurement but no run yet (default case)", () => {
    expect(
      describeLatestAction(
        investigation({ latestMeasurement: { frequencyMhz: 200, marginDb: 2 }, latestRunStatus: null }),
      ),
    ).toBe("Waiting for evidence");
  });
});
