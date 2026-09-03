// UX-05 Workstream D: the Investigations queue's real filter buckets —
// plain links (not client state), same convention as the Sources page's
// TypeFilterTabs, so filtering composes with direct URLs and needs no
// client JS to render the filtered list. Counts are always the real
// number of investigations in that bucket for this workspace — never
// hard-coded — and disappear only in the sense that "All" never filters.
import Link from "next/link";
import { QUEUE_FILTER_LABEL, type QueueFilterBucket } from "@/lib/investigations/derive-queue-workflow-state";

const BUCKETS: QueueFilterBucket[] = ["active", "needs_evidence", "ready_for_review", "resolved"];

interface QueueFilterTabsProps {
  active: QueueFilterBucket | null;
  counts: Record<QueueFilterBucket, number>;
  total: number;
}

export function QueueFilterTabs({ active, counts, total }: QueueFilterTabsProps) {
  return (
    <nav aria-label="Filter investigations by status" className="flex flex-wrap gap-2">
      <FilterTab href="/investigations" label="All" count={total} isActive={active === null} />
      {BUCKETS.map((bucket) => (
        <FilterTab
          key={bucket}
          href={`/investigations?filter=${bucket}`}
          label={QUEUE_FILTER_LABEL[bucket]}
          count={counts[bucket]}
          isActive={active === bucket}
        />
      ))}
    </nav>
  );
}

function FilterTab({
  href,
  label,
  count,
  isActive,
}: {
  href: string;
  label: string;
  count: number;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "true" : undefined}
      className={
        isActive
          ? "rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
          : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      }
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
