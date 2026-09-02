"use client";

// CANVAS ARTIFACT NODES (UX-04 Agent-Native): one real, distinct React
// component per artifact kind — never one generic card with a different
// label swapped in. Each desktop node renders inside a React Flow node
// wrapper (a target handle on top, a source handle on bottom, both nearly
// invisible — the drawn edge is the visual connector, not the handle dot
// itself). Selection/click-through is handled at the canvas level
// (onNodeClick), so these stay pure render components with no callback
// props of their own except the two that open something outside the graph
// (a citation drawer, the composer).
//
// Each node's actual content is a separate `*Content` component taking the
// typed payload directly (not React Flow's NodeProps) — the mobile
// investigation stack (investigation-stack.tsx) renders the exact same
// content, in a plain vertical list, with no React Flow involved at all.
// renderCanvasNodeContent/canvasNodeShellStyle below are the one place
// that maps a CanvasNodeData kind to its content and its shell styling —
// both the desktop node components and the mobile stack read from here,
// so the two surfaces can never silently drift apart.
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasNodeData } from "./build-canvas-graph";
import type { MeasurementRow } from "@/lib/cases/queries";
import type { CorrelationFoundPayload, HypothesisCreatedPayload } from "@/lib/analysis/events";
import type { FinalEvidenceItem } from "@/lib/hypotheses/schema";
import type { TimelineEntry } from "@/lib/investigation/timeline";
import { SpectrumChart } from "../spectrum-chart";
import { evidence, text, typography } from "../theme";

const DOT_HANDLE = "!h-2 !w-2 !border !border-border !bg-card";

function NodeShell({
  accent,
  dashed,
  children,
  showTarget = true,
  showSource = true,
}: {
  accent: string;
  dashed?: boolean;
  children: React.ReactNode;
  showTarget?: boolean;
  showSource?: boolean;
}) {
  return (
    <div
      className={`crado-fade-in w-[320px] cursor-pointer rounded-2xl border-l-2 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_10px_24px_-14px_rgba(0,0,0,0.6)] ${accent} ${dashed ? "border border-dashed border-border" : "border border-border"}`}
    >
      {showTarget ? <Handle type="target" position={Position.Top} className={DOT_HANDLE} /> : null}
      {children}
      {showSource ? <Handle type="source" position={Position.Bottom} className={DOT_HANDLE} /> : null}
    </div>
  );
}

function operatingConditions(operatingMode: string | null): string[] {
  if (!operatingMode) return [];
  return operatingMode
    .split(/\s*\+\s*|,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function MeasurementNodeContent({ measurement }: { measurement: MeasurementRow }) {
  const peak = measurement.peaks[0] ?? null;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className={text.kicker}>Measurement</span>
        <span className={`text-xs ${text.mono} ${text.muted}`}>{measurement.revisionLabel}</span>
      </div>
      {peak ? (
        <>
          <div className="mt-2 flex flex-col">
            <span className={`text-3xl font-semibold ${text.mono}`}>
              {peak.frequencyMhz} <span className="text-base font-normal">MHz</span>
            </span>
            <span className={`text-sm font-medium ${text.mono} ${peak.marginDb > 0 ? "text-warning" : "text-primary"}`}>
              {peak.marginDb > 0 ? "+" : ""}
              {peak.marginDb} dB relative to selected limit
            </span>
          </div>
          <div className="mt-3">
            <SpectrumChart frequencyMhz={peak.frequencyMhz} marginDb={peak.marginDb} />
          </div>
          {operatingConditions(measurement.operatingMode).length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {operatingConditions(measurement.operatingMode).map((condition) => (
                <li key={condition} className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {condition}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className={`mt-2 text-sm ${text.muted}`}>No measurement recorded yet.</p>
      )}
    </>
  );
}

export function MeasurementNode({ data }: NodeProps) {
  const { measurement } = data as unknown as Extract<CanvasNodeData, { kind: "measurement" }>;
  return (
    <NodeShell accent="border-l-foreground/50" showTarget={false}>
      <MeasurementNodeContent measurement={measurement} />
    </NodeShell>
  );
}

function DeterministicNodeContent({ correlation }: { correlation: CorrelationFoundPayload }) {
  const deviationLabel = correlation.deviationRatio === 0 ? "exact match" : `${(correlation.deviationRatio * 100).toFixed(3)}% deviation`;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={text.kicker}>Deterministic</span>
        <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          Candidate
        </span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${text.mono}`}>
        {correlation.sourceFrequencyMhz} × {correlation.harmonicNumber} = {correlation.expectedFrequencyMhz}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className={text.muted}>Source</dt>
        <dd className="truncate">{correlation.productFactLabel}</dd>
        <dt className={text.muted}>Deviation</dt>
        <dd className={text.mono}>{deviationLabel}</dd>
      </dl>
    </>
  );
}

export function DeterministicNode({ data }: NodeProps) {
  const { correlation } = data as unknown as Extract<CanvasNodeData, { kind: "deterministic" }>;
  return (
    <NodeShell accent="border-l-muted-foreground">
      <DeterministicNodeContent correlation={correlation} />
    </NodeShell>
  );
}

function HypothesisNodeContent({ hypothesis, index }: { hypothesis: HypothesisCreatedPayload; index: number }) {
  const whyHint = hypothesis.evidence.find((item) => item.category === "inferred")?.description ?? null;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`${text.kicker} ${evidence.inferred.glyphColor}`}>
          <span aria-hidden="true">{evidence.inferred.glyph}</span> Hypothesis {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {hypothesis.confidenceBand}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{hypothesis.title}</p>
      {whyHint ? <p className={`mt-1.5 line-clamp-2 text-xs italic ${text.muted}`}>{whyHint}</p> : null}
      <p className="mt-2 text-[11px] text-muted-foreground">Click for evidence →</p>
    </>
  );
}

export function HypothesisNode({ data }: NodeProps) {
  const { hypothesis, index } = data as unknown as Extract<CanvasNodeData, { kind: "hypothesis" }>;
  return (
    <NodeShell accent="border-l-warning">
      <HypothesisNodeContent hypothesis={hypothesis} index={index} />
    </NodeShell>
  );
}

function MissingEvidenceNodeContent({ items }: { items: FinalEvidenceItem[] }) {
  return (
    <>
      <span className={`${text.kicker} ${evidence.missing.glyphColor}`}>
        <span aria-hidden="true">{evidence.missing.glyph}</span> One observation would narrow this
      </span>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm ${text.muted}`}>
            {item.description}
          </li>
        ))}
      </ul>
    </>
  );
}

export function MissingEvidenceNode({ data }: NodeProps) {
  const { items } = data as unknown as Extract<CanvasNodeData, { kind: "missing" }>;
  return (
    <NodeShell accent="border-l-muted-foreground" dashed>
      <MissingEvidenceNodeContent items={items} />
    </NodeShell>
  );
}

function NextActionNodeContent({ step, onRecordResult }: { step: string; onRecordResult?: () => void }) {
  return (
    <>
      <span className={`${text.kicker} text-primary`}>Next test</span>
      <p className="mt-1.5 text-sm text-foreground">{step}</p>
      <button
        type="button"
        data-canvas-action="record-result"
        onClick={onRecordResult}
        className="mt-3 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        Record result
      </button>
    </>
  );
}

export function NextActionNode({ data }: NodeProps) {
  const { step } = data as unknown as Extract<CanvasNodeData, { kind: "nextAction" }>;
  return (
    <NodeShell accent="border-l-primary" showSource={false}>
      <NextActionNodeContent step={step} />
    </NodeShell>
  );
}

function ObservationNodeContent({ entry }: { entry: Extract<TimelineEntry, { type: "observation" }> }) {
  return (
    <>
      <span className={`${text.kicker} text-primary`}>Engineer observation</span>
      <p className="mt-1.5 text-sm text-foreground">{entry.observation}</p>
      {entry.measurementChange ? (
        <p className={`mt-1 text-sm font-medium ${text.mono} text-primary`}>{entry.measurementChange}</p>
      ) : null}
    </>
  );
}

export function ObservationNode({ data }: NodeProps) {
  const { entry } = data as unknown as Extract<CanvasNodeData, { kind: "observation" }>;
  return (
    <NodeShell accent="border-l-primary">
      <ObservationNodeContent entry={entry} />
    </NodeShell>
  );
}

function ChangeNodeContent({ entry }: { entry: Extract<TimelineEntry, { type: "engineering_change" }> }) {
  return (
    <>
      <span className={text.kicker}>Engineering change</span>
      <p className="mt-1.5 text-sm font-medium text-foreground">{entry.title}</p>
      {entry.affectedSubsystem ? <p className={`text-xs ${text.muted}`}>{entry.affectedSubsystem}</p> : null}
      <p className={`mt-1 text-xs ${text.mono} ${text.muted}`}>
        {entry.fromRevisionLabel ?? "—"} → {entry.toRevisionLabel}
      </p>
    </>
  );
}

export function ChangeNode({ data }: NodeProps) {
  const { entry } = data as unknown as Extract<CanvasNodeData, { kind: "change" }>;
  return (
    <NodeShell accent="border-l-foreground/50">
      <ChangeNodeContent entry={entry} />
    </NodeShell>
  );
}

function RevisionNodeContent({ entry }: { entry: Extract<TimelineEntry, { type: "new_revision" }> }) {
  return (
    <>
      <span className={text.kicker}>New revision</span>
      <p className={`mt-1.5 text-lg font-semibold ${text.mono} text-foreground`}>{entry.label}</p>
      {entry.supersedesLabel ? (
        <p className={`text-xs ${text.muted}`}>Supersedes {entry.supersedesLabel}</p>
      ) : null}
    </>
  );
}

export function RevisionNode({ data }: NodeProps) {
  const { entry } = data as unknown as Extract<CanvasNodeData, { kind: "revision" }>;
  return (
    <NodeShell accent="border-l-foreground/50">
      <RevisionNodeContent entry={entry} />
    </NodeShell>
  );
}

function marginPhrase(marginDb: number): string {
  const magnitude = Math.abs(marginDb).toFixed(1);
  return marginDb > 0 ? `${magnitude} dB above limit` : marginDb < 0 ? `${magnitude} dB below limit` : "at limit";
}

function OutcomeNodeContent({ entry }: { entry: Extract<TimelineEntry, { type: "result" }> }) {
  const { before, after, deltaDb, improved } = entry.comparison;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${text.kicker} text-primary`}>Measured outcome</span>
        <span className={`text-lg font-semibold ${text.mono} ${improved ? "text-primary" : "text-warning"}`}>
          {deltaDb === 0 ? "No change" : `${improved ? "" : "-"}${Math.abs(deltaDb).toFixed(1)} dB`}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border p-2">
          <div className={typography.metadata}>{before.revisionLabel}</div>
          <div className={`${text.mono} text-foreground`}>{before.frequencyMhz} MHz</div>
          <div className={text.muted}>{marginPhrase(before.marginDb)}</div>
        </div>
        <div className={`rounded-lg border p-2 ${improved ? "border-primary/40 bg-primary/5" : "border-warning/40 bg-warning/5"}`}>
          <div className={typography.metadata}>{after.revisionLabel}</div>
          <div className={`${text.mono} text-foreground`}>{after.frequencyMhz} MHz</div>
          <div className={text.muted}>{marginPhrase(after.marginDb)}</div>
        </div>
      </div>
    </>
  );
}

export function OutcomeNode({ data }: NodeProps) {
  const { entry } = data as unknown as Extract<CanvasNodeData, { kind: "outcome" }>;
  // Not necessarily terminal — an engineer can keep logging observations
  // after a measured outcome (a real seeded case does exactly this), so
  // this needs a source handle like every other trunk node, not the
  // NextActionNode-style dead end.
  return (
    <NodeShell accent="border-l-primary">
      <OutcomeNodeContent entry={entry} />
    </NodeShell>
  );
}

export const canvasNodeTypes = {
  measurement: MeasurementNode,
  deterministic: DeterministicNode,
  hypothesis: HypothesisNode,
  missing: MissingEvidenceNode,
  nextAction: NextActionNode,
  observation: ObservationNode,
  change: ChangeNode,
  revision: RevisionNode,
  outcome: OutcomeNode,
};

/** The one place a CanvasNodeData kind maps to its rendered content —
 * shared by the desktop React Flow nodes above (each just wraps this in
 * NodeShell) and the mobile investigation stack (investigation-stack.tsx),
 * which renders the same content with no React Flow involved. Keeping
 * this switch in one function is what makes it impossible for the two
 * surfaces to silently drift apart. */
export function renderCanvasNodeContent(
  data: CanvasNodeData,
  options?: { onRecordResult?: () => void },
): React.ReactNode {
  switch (data.kind) {
    case "measurement":
      return <MeasurementNodeContent measurement={data.measurement} />;
    case "deterministic":
      return <DeterministicNodeContent correlation={data.correlation} />;
    case "hypothesis":
      return <HypothesisNodeContent hypothesis={data.hypothesis} index={data.index} />;
    case "missing":
      return <MissingEvidenceNodeContent items={data.items} />;
    case "nextAction":
      return <NextActionNodeContent step={data.step} onRecordResult={options?.onRecordResult} />;
    case "observation":
      return <ObservationNodeContent entry={data.entry} />;
    case "change":
      return <ChangeNodeContent entry={data.entry} />;
    case "revision":
      return <RevisionNodeContent entry={data.entry} />;
    case "outcome":
      return <OutcomeNodeContent entry={data.entry} />;
  }
}

/** The shell/accent styling for a given node kind — desktop's NodeShell
 * calls sites already hand-picked these per kind (unchanged, just now
 * named and exported instead of implicit at each call site); the mobile
 * stack's own shell reads the same values so a node looks the same
 * artifact whichever surface renders it. */
export function canvasNodeShellStyle(kind: CanvasNodeData["kind"]): { accent: string; dashed: boolean } {
  switch (kind) {
    case "measurement":
      return { accent: "border-l-foreground/50", dashed: false };
    case "deterministic":
      return { accent: "border-l-muted-foreground", dashed: false };
    case "hypothesis":
      return { accent: "border-l-warning", dashed: false };
    case "missing":
      return { accent: "border-l-muted-foreground", dashed: true };
    case "nextAction":
      return { accent: "border-l-primary", dashed: false };
    case "observation":
      return { accent: "border-l-primary", dashed: false };
    case "change":
      return { accent: "border-l-foreground/50", dashed: false };
    case "revision":
      return { accent: "border-l-foreground/50", dashed: false };
    case "outcome":
      return { accent: "border-l-primary", dashed: false };
  }
}
