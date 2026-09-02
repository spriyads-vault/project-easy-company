import { describe, expect, it } from "vitest";
import { classifyComposerIntent } from "./classify-composer-intent";

describe("classifyComposerIntent", () => {
  it("classifies an explicit revision-creation sentence as engineering_change, high confidence (positive case)", () => {
    expect(classifyComposerIntent("Changed the display termination and created Rev18.")).toEqual({
      intent: "engineering_change",
      confidence: "high",
    });
  });

  it("classifies a 'new revision' phrase as engineering_change even without 'created' (positive case)", () => {
    expect(classifyComposerIntent("Swapped the connector, this is a new revision: Rev19.")).toEqual({
      intent: "engineering_change",
      confidence: "high",
    });
  });

  it("classifies an explicit above/below-the-limit margin reading as measurement, high confidence (positive case)", () => {
    expect(classifyComposerIntent("Retested Rev18. 200 MHz is now 3.6 dB below the limit.")).toEqual({
      intent: "measurement",
      confidence: "high",
    });
  });

  it("classifies a frequency + retest verb with no delta word as measurement, low confidence (ambiguous case)", () => {
    expect(classifyComposerIntent("Retested. 200 MHz, -3.6 dB.")).toEqual({
      intent: "measurement",
      confidence: "low",
    });
  });

  it("classifies a delta-phrased observation as observation, not measurement, even with a frequency and a retest-shaped verb (negative case)", () => {
    // "measured" appears nowhere here, but this guards the boundary: a
    // dropped/rose word must win over the low-confidence measurement path.
    expect(
      classifyComposerIntent("Disconnected the display cable. The 200 MHz peak dropped 9 dB."),
    ).toEqual({ intent: "observation", confidence: "high" });
  });

  it("does not classify a bare change verb with no revision-creation phrase as engineering_change (negative case — avoids fragile keyword-only matching)", () => {
    expect(classifyComposerIntent("Changed the antenna position during the test.")).toEqual({
      intent: "observation",
      confidence: "high",
    });
  });

  it("falls back to observation for free text with no structural signal at all (missing-data case)", () => {
    expect(classifyComposerIntent("Not sure what's going on here.")).toEqual({
      intent: "observation",
      confidence: "high",
    });
  });

  it("falls back to observation for empty/whitespace-only text (boundary case)", () => {
    expect(classifyComposerIntent("   ")).toEqual({ intent: "observation", confidence: "high" });
  });

  it("prioritizes engineering_change over a co-occurring measurement-shaped phrase (compound message)", () => {
    expect(
      classifyComposerIntent(
        "Changed the display termination and created Rev18. 200 MHz is now 3.6 dB below the limit.",
      ),
    ).toEqual({ intent: "engineering_change", confidence: "high" });
  });
});
