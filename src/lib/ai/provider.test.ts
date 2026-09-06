import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FIX-01: assert temperature is actually passed to the provider call rather
// than assuming it from reading the source — see docs/CAPABILITY_AUDIT.md
// section 7. generateObject is mocked so this stays a fast unit test with
// no real network/model call.
const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) => ({ modelId }),
  createAnthropic: () => (modelId: string) => ({ modelId }),
}));

import { buildAnthropicHeaders, createAnthropicHypothesisAdapter } from "./provider";

describe("buildAnthropicHeaders", () => {
  it("adds the anthropic-workspace-id header when a workspace id is set", () => {
    expect(buildAnthropicHeaders("ws_123")).toEqual({
      "anthropic-workspace-id": "ws_123",
    });
  });

  it("adds no headers when the workspace id is undefined (plain API key case)", () => {
    expect(buildAnthropicHeaders(undefined)).toBeUndefined();
  });

  it("treats an empty string the same as unset (boundary)", () => {
    expect(buildAnthropicHeaders("")).toBeUndefined();
  });
});

describe("createAnthropicHypothesisAdapter", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    generateObjectMock.mockReset();
    generateObjectMock.mockResolvedValue({
      object: { hypotheses: [], clarificationQuestion: null },
    });
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it("passes temperature: 0 to generateObject — asserted, not assumed (FIX-01)", async () => {
    const adapter = createAnthropicHypothesisAdapter();

    await adapter.generateHypotheses({
      measurement: { frequencyMhz: 200, marginDb: 7.4, operatingMode: null },
      correlationCandidates: [],
      productFacts: [],
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const callArgs = generateObjectMock.mock.calls[0][0] as { temperature?: number };
    expect(callArgs.temperature).toBe(0);
  });
});
