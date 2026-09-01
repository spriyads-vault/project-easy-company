// CONNECTOR (UX-03): the thin line joining two stacked artifacts on the
// investigation canvas — "subtle connector lines… not a generic flowchart
// with huge arrows." Two exports:
//   - Connector: a single vertical stem between two stacked artifacts.
//   - ArtifactRow: wraps N sibling artifacts (e.g. more than one
//     hypothesis branching off the same deterministic relationship) with a
//     shared horizontal trunk and a short stem down into each one, so a
//     1-to-many step still reads as one connected graph, not N unrelated
//     cards.
// Pure CSS, no canvas/SVG graph library — deliberately: a real drag/zoom
// graph engine is out of MVP scope (CLAUDE.md: no speculative
// infrastructure), and a vertical connected flow already satisfies "a
// connected engineering investigation, not six stacked rectangles" on
// every viewport, mobile included, where a 2D graph would have to
// collapse to this same shape anyway.
import { Children } from "react";
import { connector, motion } from "./theme";

export function Connector({ heightClass = "h-6" }: { heightClass?: string }) {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <span className={`w-px origin-top ${heightClass} ${connector.line} ${motion.connectorDraw}`} />
    </div>
  );
}

export function ArtifactRow({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children);
  const multiple = items.length > 1;

  return (
    <div className="flex flex-col">
      {multiple ? (
        <div aria-hidden="true" className={`mx-auto h-px w-[90%] origin-left ${connector.line} ${motion.connectorDraw}`} />
      ) : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
        {items.map((child, index) => (
          <div key={index} className="flex flex-1 flex-col">
            <Connector heightClass="h-4" />
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
