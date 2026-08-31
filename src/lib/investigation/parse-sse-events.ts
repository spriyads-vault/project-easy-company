// Incrementally decodes the SSE framing the API route produces (`ai`'s
// JsonToSseTransformStream: "data: <json>\n\n" frames, ending
// "data: [DONE]\n\n" — see src/app/api/analysis-runs/route.ts). A small
// stateful parser rather than a one-shot split, because a fetch reader can
// deliver one frame split across multiple chunks, or several frames in one
// chunk. Every parsed event is re-validated against analysisEventSchema —
// the network is a trust boundary regardless of which server produced it.
import { analysisEventSchema, type AnalysisEvent } from "@/lib/analysis/events";

export class SseEventParser {
  private buffer = "";

  /** Feed one decoded text chunk; returns any complete, valid events it
   * completed. A malformed or non-schema frame is dropped, not thrown —
   * one bad frame shouldn't take down the rest of the stream. */
  push(chunk: string): AnalysisEvent[] {
    this.buffer += chunk;
    const events: AnalysisEvent[] = [];

    let boundary: number;
    while ((boundary = this.buffer.indexOf("\n\n")) !== -1) {
      const frame = this.buffer.slice(0, boundary).trim();
      this.buffer = this.buffer.slice(boundary + 2);
      if (!frame.startsWith("data:")) continue;

      const data = frame.slice("data:".length).trim();
      if (data === "[DONE]" || data === "") continue;

      const result = analysisEventSchema.safeParse(safeJsonParse(data));
      if (result.success) {
        events.push(result.data);
      }
    }

    return events;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
