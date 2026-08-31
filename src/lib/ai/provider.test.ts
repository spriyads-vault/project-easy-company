import { describe, expect, it } from "vitest";
import { buildAnthropicHeaders } from "./provider";

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
