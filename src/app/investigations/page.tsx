// INVESTIGATIONS HOME (UX-04 Agent-Native): the primary landing screen —
// a work queue, not a metrics dashboard. No KPI cards; each row shows
// product/revision/status/latest action/updated time, exactly the ticket's
// mock. "The user came here to work, not admire analytics."
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listInvestigations, type InvestigationSummary } from "@/lib/investigations/queries";
import { describeLatestAction, groupInvestigation } from "@/lib/investigations/describe-investigation-status";
import { queueFilterBucket, type QueueFilterBucket } from "@/lib/investigations/derive-queue-workflow-state";
import { QueueFilterTabs } from "./queue-filter-tabs";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { surface, text, typography } from "@/lib/design/tokens";
import { PlusCircle } from "lucide-react";

const FILTER_BUCKETS: QueueFilterBucket[] = ["active", "needs_evidence", "ready_for_review", "resolved"];

function isFilterBucket(value: string | undefined): value is QueueFilterBucket {
  return value !== undefined && (FILTER_BUCKETS as string[]).includes(value);
}

// Subtle status glyph, never a giant colored pill as primary UI — per the
// ticket's explicit "● Investigating / ○ Waiting for evidence / ✓
// Complete" instruction.
function statusGlyph(investigation: InvestigationSummary): { glyph: string; className: string } {
  if (investigation.latestRunStatus === "running") {
    return { glyph: "●", className: "text-primary animate-pulse" };
  }
  if (investigation.status === "resolved" || investigation.latestRunStatus === "completed") {
    // A checkmark reads as "done/passed" — the reserved success green,
    // not the cobalt "active work" accent (see globals.css's semantic
    // color rules).
    return { glyph: "✓", className: "text-success" };
  }
  if (investigation.latestRunStatus === "failed") {
    return { glyph: "✕", className: "text-destructive" };
  }
  return { glyph: "○", className: "text-muted-foreground" };
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function InvestigationRow({ investigation }: { investigation: InvestigationSummary }) {
  const status = statusGlyph(investigation);
  return (
    <li>
      <Link
        href={`/cases/${investigation.id}/investigation`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-3 py-3 transition-colors hover:bg-secondary/60"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{investigation.productName}</span>
            <span className={typography.metadata}>{investigation.revisionLabel}</span>
          </div>
          <span className={typography.metadata}>{investigation.title}</span>
        </div>
        <div className="flex items-center gap-4">
          {investigation.latestMeasurement ? (
            <span className={`hidden text-xs ${text.mono} ${text.muted} sm:inline`}>
              {investigation.latestMeasurement.frequencyMhz} MHz ·{" "}
              {investigation.latestMeasurement.marginDb > 0 ? "+" : ""}
              {investigation.latestMeasurement.marginDb} dB
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 text-sm text-foreground">
            <span aria-hidden="true" className={status.className}>
              {status.glyph}
            </span>
            {describeLatestAction(investigation)}
          </span>
          <span className={`shrink-0 ${typography.metadata}`}>{formatRelativeTime(investigation.updatedAt)}</span>
        </div>
      </Link>
    </li>
  );
}

// The filtered-view row (Active/Needs evidence/Ready for review/Resolved):
// leads with the literal required-next-action string instead of the
// default view's terser "latest action" phrase — this is the surface the
// ticket's "concise required-next-action string derived from real
// state/data" acceptance criterion is about.
function FilteredInvestigationRow({ investigation }: { investigation: InvestigationSummary }) {
  return (
    <li>
      <Link
        href={`/cases/${investigation.id}/investigation`}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-3 py-3 transition-colors hover:bg-secondary/60"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{investigation.productName}</span>
            <span className={typography.metadata}>{investigation.revisionLabel}</span>
          </div>
          <span className={typography.metadata}>{investigation.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground">{investigation.requiredNextAction}</span>
          <span className={`shrink-0 ${typography.metadata}`}>{formatRelativeTime(investigation.updatedAt)}</span>
        </div>
      </Link>
    </li>
  );
}

interface InvestigationsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function InvestigationsPage({ searchParams }: InvestigationsPageProps) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { filter: filterParam } = await searchParams;
  const activeFilter = isFilterBucket(filterParam) ? filterParam : null;

  const investigations = await listInvestigations();
  const active = investigations.filter((investigation) => groupInvestigation(investigation) === "active");
  const recent = investigations.filter((investigation) => groupInvestigation(investigation) === "recent");

  // Real counts per bucket — computed once from the same list every row
  // below is drawn from, never a separate estimate.
  const counts: Record<QueueFilterBucket, number> = { active: 0, needs_evidence: 0, ready_for_review: 0, resolved: 0 };
  for (const investigation of investigations) counts[queueFilterBucket(investigation.workflowState)]++;
  const filtered = activeFilter
    ? investigations.filter((investigation) => queueFilterBucket(investigation.workflowState) === activeFilter)
    : [];

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        eyebrow="Crado"
        title="Investigations"
        rightSlot={
          <Link
            href="/investigations/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-primary/50 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New investigation
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
          {investigations.length > 0 ? (
            <QueueFilterTabs active={activeFilter} counts={counts} total={investigations.length} />
          ) : null}

          {investigations.length === 0 ? (
            <div className={`p-8 ${surface.card}`}>
              <EmptyState message="No investigations yet. Describe a failure or attach a test report to open your first one." />
              <Link
                href="/investigations/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] border border-primary/50 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New investigation
              </Link>
            </div>
          ) : activeFilter ? (
            <section className="flex flex-col gap-2">
              {filtered.length === 0 ? (
                <div className={`p-8 ${surface.card}`}>
                  <EmptyState message="No investigations in this bucket right now. Clear the filter to see every investigation." />
                </div>
              ) : (
                <ul className={`flex flex-col divide-y divide-border p-1 ${surface.card}`}>
                  {filtered.map((investigation) => (
                    <FilteredInvestigationRow key={investigation.id} investigation={investigation} />
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              {active.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h2 className={typography.sectionHeading}>Active</h2>
                  <ul className={`flex flex-col divide-y divide-border p-1 ${surface.card}`}>
                    {active.map((investigation) => (
                      <InvestigationRow key={investigation.id} investigation={investigation} />
                    ))}
                  </ul>
                </section>
              ) : null}

              {recent.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h2 className={typography.sectionHeading}>Recent</h2>
                  <ul className={`flex flex-col divide-y divide-border p-1 ${surface.card}`}>
                    {recent.map((investigation) => (
                      <InvestigationRow key={investigation.id} investigation={investigation} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
