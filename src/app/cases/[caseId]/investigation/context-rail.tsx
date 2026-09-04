"use client";

// RIGHT CONTEXT RAIL (UX-03): a contextual panel, not a permanently-full
// sidebar — "it should NOT always show everything." Nothing selected: a
// compact case-state summary built only from data this workspace already
// has (never a fabricated document/measurement count — see
// sources-panel.tsx's identical restraint). A hypothesis/measurement/
// source selected: a condensed detail view for exactly that thing.
// Selection is lifted into InvestigationWorkspace (investigation-workspace.tsx
// owns `selection` state) — clicking an artifact on the canvas sets it,
// this just renders whatever it's given. Collapsible per the ticket
// ("allow it to collapse") — UX-04 moved the collapse itself to be
// controlled by the caller (`collapsed`/`onCollapse`/`onExpand`) rather
// than an internal useState, so InvestigationWorkspace's resizable panel
// (react-resizable-panels' own collapsedSize/onCollapse/onExpand) and this
// component's expand/collapse button stay in sync — collapsing via the
// drag handle updates the same state this button reads, and vice versa.
// The same component is also reused, uncollapsible, inside the mobile
// Sheet (investigation-workspace.tsx) — this file has no width/breakpoint
// opinions of its own any more, sizing is entirely up to the caller.
import type { AgentCompletedPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import type { EvidenceCategory } from "@/lib/domain/schema";
import type { EvidenceCitation } from "@/lib/hypotheses/schema";
import { describeDocumentType } from "@/lib/documents/describe-document-type";
import { HYPOTHESIS_UPDATE_LABEL, HYPOTHESIS_UPDATE_STYLE } from "./describe-hypothesis-update";
import { evidence, focusRing, surface, text } from "./theme";

export type RailSelection =
  | { kind: "measurement" }
  | { kind: "hypothesis"; hypothesis: HypothesisCreatedPayload; index: number }
  | {
      kind: "source";
      citation: EvidenceCitation;
      category: EvidenceCategory;
      hypothesisIndex: number;
      hypothesisTitle: string;
    }
  | null;

interface ContextRailProps {
  selection: RailSelection;
  onClear: () => void;
  onOpenFullSource: (
    citation: EvidenceCitation,
    category: EvidenceCategory,
    hypothesisIndex: number,
    hypothesisTitle: string,
  ) => void;
  productName: string;
  revisionLabel: string;
  productFacts: ProductFactRecord[];
  measurement: MeasurementRow | null;
  agentMetrics: AgentCompletedPayload | null;
  /** Controlled collapse state — true renders only the reveal button.
   * Always pass `false` when embedding this outside the desktop resizable
   * rail (e.g. the mobile Sheet), since there's nothing to collapse into. */
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  /** Hides the ▸ collapse affordance — for the mobile Sheet embedding,
   * which already has its own visible Close (✕), so a second, differently
   * labeled "collapse" control would be redundant and, since there is no
   * panel to collapse INTO outside the resizable rail, mislabeled.
   * Defaults to true (the desktop rail always shows it). */
  showCollapseButton?: boolean;
}

const CONFIDENCE_LABEL: Record<HypothesisCreatedPayload["confidenceBand"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

function RailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`${text.kicker} text-[10px]`}>{label}</span>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function DefaultSummary({
  productName,
  revisionLabel,
  productFacts,
  agentMetrics,
}: Pick<ContextRailProps, "productName" | "revisionLabel" | "productFacts" | "agentMetrics">) {
  return (
    <div className="flex flex-col gap-4">
      <p className={`text-xs ${text.muted}`}>Nothing selected — click an artifact on the canvas for detail.</p>
      <RailField label="Product" value={productName || "—"} />
      <RailField label="Revision" value={revisionLabel || "—"} />
      <RailField label="Product facts" value={<span className={text.mono}>{productFacts.length}</span>} />
      {/* Never fabricated — omitted entirely until an agent run has actually
          reported a real document count (same restraint as sources-panel.tsx). */}
      {agentMetrics ? (
        <RailField label="Sources available" value={<span className={text.mono}>{agentMetrics.documentsAvailable}</span>} />
      ) : null}
    </div>
  );
}

function MeasurementDetail({ measurement }: { measurement: MeasurementRow | null }) {
  const peak = measurement?.peaks[0] ?? null;
  if (!measurement || !peak) {
    return <p className={`text-sm ${text.muted}`}>No measurement recorded for this case yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <RailField label="Revision" value={measurement.revisionLabel} />
      <RailField
        label="Frequency"
        value={<span className={text.mono}>{peak.frequencyMhz} MHz</span>}
      />
      <RailField
        label="Margin"
        value={
          <span className={`${text.mono} ${peak.marginDb > 0 ? "text-warning" : "text-success"}`}>
            {peak.marginDb > 0 ? "+" : ""}
            {peak.marginDb} dB
          </span>
        }
      />
      {measurement.operatingMode ? <RailField label="Operating mode" value={measurement.operatingMode} /> : null}
      {peak.detector ? <RailField label="Detector" value={<span className={text.mono}>{peak.detector}</span>} /> : null}
      {peak.limitLine ? <RailField label="Limit line" value={<span className={text.mono}>{peak.limitLine}</span>} /> : null}
    </div>
  );
}

function HypothesisDetail({
  hypothesis,
  index,
  onOpenFullSource,
}: {
  hypothesis: HypothesisCreatedPayload;
  index: number;
  onOpenFullSource: ContextRailProps["onOpenFullSource"];
}) {
  const missing = hypothesis.evidence.filter((item) => item.category === "missing");
  const sourced = hypothesis.evidence.filter((item) => item.citation);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className={`${text.kicker} text-[10px]`}>Hypothesis {String(index + 1).padStart(2, "0")}</span>
        <p className="text-sm font-medium leading-snug">{hypothesis.title}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {CONFIDENCE_LABEL[hypothesis.confidenceBand]}
          </span>
          {hypothesis.update ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${HYPOTHESIS_UPDATE_STYLE[hypothesis.update.status]}`}
            >
              {HYPOTHESIS_UPDATE_LABEL[hypothesis.update.status]}
            </span>
          ) : null}
        </div>
      </div>

      {sourced.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className={`${text.kicker} text-[10px]`}>Sources ({sourced.length})</span>
          <ul className="flex flex-col gap-1">
            {sourced.map((item, itemIndex) => (
              <li key={itemIndex}>
                <button
                  type="button"
                  onClick={() => onOpenFullSource(item.citation!, item.category, index, hypothesis.title)}
                  className={`inline-flex items-center gap-1 rounded-[7px] border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[11px] text-primary transition-colors hover:border-primary/70 hover:bg-primary/15 ${focusRing}`}
                >
                  <span aria-hidden="true">⌗</span>
                  {item.citation!.filename}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className={`${text.kicker} text-[10px] ${evidence.missing.glyphColor}`}>
            {evidence.missing.glyph} Missing information
          </span>
          <ul className="flex flex-col gap-1">
            {missing.map((item, itemIndex) => (
              <li key={itemIndex} className={`text-sm ${text.muted}`}>
                {item.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <RailField label="Next test" value={hypothesis.recommendedNextStep} />
    </div>
  );
}

function SourceDetail({
  citation,
  category,
  onOpenFullSource,
  hypothesisIndex,
  hypothesisTitle,
}: {
  citation: EvidenceCitation;
  category: EvidenceCategory;
  hypothesisIndex: number;
  hypothesisTitle: string;
  onOpenFullSource: ContextRailProps["onOpenFullSource"];
}) {
  return (
    <div className="flex flex-col gap-4">
      <RailField label={describeDocumentType(citation.documentType)} value={citation.filename} />
      <RailField label="Used as" value={category} />
      <RailField label="Used in" value={`Hypothesis ${String(hypothesisIndex + 1).padStart(2, "0")} — ${hypothesisTitle}`} />
      <p className={`text-sm leading-relaxed ${text.muted}`}>&ldquo;{citation.passage}&rdquo;</p>
      <button
        type="button"
        onClick={() => onOpenFullSource(citation, category, hypothesisIndex, hypothesisTitle)}
        className={`self-start rounded-[7px] border border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${focusRing}`}
      >
        View full passage
      </button>
    </div>
  );
}

export function ContextRail({
  selection,
  onClear,
  onOpenFullSource,
  productName,
  revisionLabel,
  productFacts,
  measurement,
  agentMetrics,
  collapsed,
  onCollapse,
  onExpand,
  showCollapseButton = true,
}: ContextRailProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        title="Show case panel"
        aria-label="Show case panel"
        className={`flex h-full w-full items-start justify-center rounded-[10px] border border-border bg-card px-2 py-3 text-xs text-muted-foreground hover:text-foreground ${focusRing}`}
      >
        ◂
      </button>
    );
  }

  const heading =
    selection?.kind === "measurement"
      ? "Measurement"
      : selection?.kind === "hypothesis"
        ? "Hypothesis details"
        : selection?.kind === "source"
          ? "Source"
          : "Case";

  return (
    <aside aria-label="Case context" className={`flex h-full w-full flex-col gap-4 overflow-y-auto p-4 ${surface.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={text.kicker}>{heading}</span>
        <div className="flex items-center gap-2">
          {selection ? (
            <button
              type="button"
              onClick={onClear}
              className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
            >
              Clear
            </button>
          ) : null}
          {showCollapseButton ? (
            <button
              type="button"
              onClick={onCollapse}
              title="Collapse panel"
              aria-label="Collapse panel"
              className={`text-xs ${text.muted} hover:text-foreground ${focusRing}`}
            >
              ▸
            </button>
          ) : null}
        </div>
      </div>

      {!selection ? (
        <DefaultSummary
          productName={productName}
          revisionLabel={revisionLabel}
          productFacts={productFacts}
          agentMetrics={agentMetrics}
        />
      ) : selection.kind === "measurement" ? (
        <MeasurementDetail measurement={measurement} />
      ) : selection.kind === "hypothesis" ? (
        <HypothesisDetail
          hypothesis={selection.hypothesis}
          index={selection.index}
          onOpenFullSource={onOpenFullSource}
        />
      ) : (
        <SourceDetail
          citation={selection.citation}
          category={selection.category}
          hypothesisIndex={selection.hypothesisIndex}
          hypothesisTitle={selection.hypothesisTitle}
          onOpenFullSource={onOpenFullSource}
        />
      )}
    </aside>
  );
}
