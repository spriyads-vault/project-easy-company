import { describe, expect, it } from "vitest";
import { SseEventParser } from "./parse-sse-events";

const runStartedJson = JSON.stringify({
  type: "run.started",
  runId: "run-1",
  sequence: 0,
  createdAt: "2026-08-31T00:00:00.000Z",
  payload: { failureCaseId: "case-1", measurementId: "measurement-1" },
});

const measurementLoadedJson = JSON.stringify({
  type: "measurement.loaded",
  runId: "run-1",
  sequence: 1,
  createdAt: "2026-08-31T00:00:00.100Z",
  payload: {
    measurementId: "measurement-1",
    frequencyMhz: 200,
    marginDb: 7.4,
    operatingMode: "WiFi TX + display active",
  },
});

describe("SseEventParser", () => {
  it("parses a single complete frame delivered in one chunk", () => {
    const parser = new SseEventParser();
    const events = parser.push(`data: ${runStartedJson}\n\n`);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("run.started");
  });

  it("parses a frame split across multiple chunks (the realistic fetch-reader case)", () => {
    const parser = new SseEventParser();
    const full = `data: ${runStartedJson}\n\n`;
    const midpoint = Math.floor(full.length / 2);

    const firstHalf = parser.push(full.slice(0, midpoint));
    expect(firstHalf).toEqual([]);

    const secondHalf = parser.push(full.slice(midpoint));
    expect(secondHalf).toHaveLength(1);
    expect(secondHalf[0].type).toBe("run.started");
  });

  it("parses multiple frames delivered in a single chunk, in order", () => {
    const parser = new SseEventParser();
    const events = parser.push(
      `data: ${runStartedJson}\n\ndata: ${measurementLoadedJson}\n\n`,
    );
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "measurement.loaded",
    ]);
  });

  it("skips the [DONE] sentinel without producing an event", () => {
    const parser = new SseEventParser();
    const events = parser.push(`data: ${runStartedJson}\n\ndata: [DONE]\n\n`);
    expect(events).toHaveLength(1);
  });

  it("drops a malformed JSON frame instead of throwing (missing/corrupt-data case)", () => {
    const parser = new SseEventParser();
    let events: ReturnType<typeof parser.push> = [];
    expect(() => {
      events = parser.push(`data: {not valid json\n\ndata: ${runStartedJson}\n\n`);
    }).not.toThrow();
    // The malformed frame is silently dropped; the valid frame after it
    // still comes through.
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("run.started");
  });

  it("drops a frame that parses as JSON but fails the event schema", () => {
    const parser = new SseEventParser();
    const events = parser.push(
      `data: ${JSON.stringify({ type: "not.a.real.event" })}\n\n`,
    );
    expect(events).toEqual([]);
  });
});
