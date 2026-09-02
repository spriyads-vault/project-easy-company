// VALIDATION-01: the benchmark harness index. An internal evaluation tool
// alongside /workspace and /products, sharing the same UX-04 design
// system as the rest of the product.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listBenchmarkCases, type BenchmarkCaseSummary } from "@/lib/benchmarks/queries";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { StatusBadge } from "@/lib/design/status-badge";
import { surface, typography, type HeroStatusTone } from "@/lib/design/tokens";

const STATUS_LABEL: Record<string, string> = {
  created: "Not yet investigated",
  investigated: "Investigated",
  scored: "Scored",
  revealed: "Ground truth revealed",
};

const STATUS_TONE: Record<BenchmarkCaseSummary["status"], HeroStatusTone> = {
  created: "waiting",
  investigated: "active",
  scored: "active",
  revealed: "complete",
};

export default async function BenchmarksPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const cases = await listBenchmarkCases();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        eyebrow="Crado"
        title="Benchmark harness"
        rightSlot={
          <Link
            href="/benchmarks/new"
            className="shrink-0 rounded-lg border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-sm font-medium text-[#22c55e] transition-colors hover:bg-[#22c55e]/20"
          >
            New benchmark case
          </Link>
        }
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
          <p className={typography.body}>
            Evaluate Crado against historical failures it has never seen the
            answer to. Each case&rsquo;s underlying product/revision/measurement
            is a real, ordinary case built through the normal workflow — only
            the ground truth (root cause, diagnostic actions, the fix, the
            final measurement) is kept separate and hidden until you reveal
            it.
          </p>

          {cases.length === 0 ? (
            <EmptyState message="No benchmark cases yet. Build a product, revision, failure case, and first measurement through the normal workflow, then register it here." />
          ) : (
            <ul className="flex flex-col gap-2">
              {cases.map((benchmarkCase) => (
                <li key={benchmarkCase.id}>
                  <Link
                    href={`/benchmarks/${benchmarkCase.id}`}
                    className={`flex flex-wrap items-center justify-between gap-2 p-4 ${surface.card} transition-colors hover:border-[#2d3440]`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[#f5f6f7]">{benchmarkCase.name}</span>
                      <span className={typography.metadata}>
                        {benchmarkCase.productName} · {benchmarkCase.revisionLabel} ·{" "}
                        {benchmarkCase.failureCaseTitle}
                      </span>
                    </div>
                    <StatusBadge
                      label={STATUS_LABEL[benchmarkCase.status] ?? benchmarkCase.status}
                      tone={STATUS_TONE[benchmarkCase.status]}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
