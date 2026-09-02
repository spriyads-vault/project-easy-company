"use client";

// MOBILE INVESTIGATION STACK (UX-04): the same canvas artifacts as
// InvestigationCanvas, rendered as a plain vertical list with no React
// Flow — a drag/zoom/pan graph surface doesn't degrade to something
// usable at a narrow viewport, so below the `lg` breakpoint this renders
// in the Investigation tab instead of the canvas, never a lesser version
// of the same information (the ticket: "The canvas remains understandable
// and operable ... No primary capability becomes desktop-only").
//
// buildCanvasGraph's node insertion order is already the correct reading
// order — trunk items in chronological order, each hypothesis's own
// branch (hypothesis, missing evidence, next test) fully grouped together
// before the next hypothesis's — so this just walks graph.nodes in order.
// Each node's content comes from the same renderCanvasNodeContent/
// canvasNodeShellStyle registry canvas-nodes.tsx's desktop nodes use, so a
// hypothesis here is visually the same artifact it is on the canvas, not
// a redesigned card that could drift out of sync.
import type { MeasurementRow } from "@/lib/cases/queries";
import type { WorkspaceState } from "@/lib/investigation/reconstruct";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import type { HypothesisCreatedPayload } from "@/lib/analysis/events";
import { buildCanvasGraph } from "./build-canvas-graph";
import { canvasNodeShellStyle, renderCanvasNodeContent } from "./canvas-nodes";
import { focusRing, text } from "../theme";

interface MobileInvestigationStackProps {
  measurement: MeasurementRow | null;
  state: WorkspaceState;
  timeline: TimelineEntry[];
  onSelectMeasurement: () => void;
  onSelectHypothesis: (hypothesis: HypothesisCreatedPayload, index: number) => void;
  onRecordResult: () => void;
}

export function MobileInvestigationStack({
  measurement,
  state,
  timeline,
  onSelectMeasurement,
  onSelectHypothesis,
  onRecordResult,
}: MobileInvestigationStackProps) {
  const graph = buildCanvasGraph({ measurement, state, timeline });

  if (graph.nodes.length === 0) {
    return <p className={`text-sm ${text.muted}`}>Add a measurement to start the investigation.</p>;
  }

  return (
    <ol className="flex flex-col gap-3" aria-label="Investigation, in order">
      {graph.nodes.map((node) => {
        const { accent, dashed } = canvasNodeShellStyle(node.data.kind);
        const content =
          node.data.kind === "nextAction"
            ? renderCanvasNodeContent(node.data, { onRecordResult })
            : renderCanvasNodeContent(node.data);

        const shellClassName = `w-full rounded-2xl border-l-2 bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.3),0_10px_24px_-14px_rgba(0,0,0,0.6)] ${accent} ${dashed ? "border border-dashed border-border" : "border border-border"}`;

        // Measurement and hypothesis nodes open the same context detail a
        // desktop click does (via the Sheet in investigation-workspace.tsx)
        // — everything else (deterministic correlation, missing evidence,
        // history entries) is display-only on the canvas too, so it stays
        // a plain, non-interactive list item here.
        if (node.data.kind === "measurement") {
          return (
            <li key={node.id}>
              <button type="button" onClick={onSelectMeasurement} className={`${shellClassName} ${focusRing}`}>
                {content}
              </button>
            </li>
          );
        }
        if (node.data.kind === "hypothesis") {
          const { hypothesis, index } = node.data;
          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelectHypothesis(hypothesis, index)}
                className={`${shellClassName} ${focusRing}`}
              >
                {content}
              </button>
            </li>
          );
        }
        return (
          <li key={node.id} className={shellClassName}>
            {content}
          </li>
        );
      })}
    </ol>
  );
}
