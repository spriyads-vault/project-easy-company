// VALIDATION-01: the benchmark harness index. An internal tool alongside
// /workspace and /products, not part of the customer-facing demo flow —
// same plain theme as those pages, deliberately.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listBenchmarkCases } from "@/lib/benchmarks/queries";

const STATUS_LABEL: Record<string, string> = {
  created: "Not yet investigated",
  investigated: "Investigated",
  scored: "Scored",
  revealed: "Ground truth revealed",
};

export default async function BenchmarksPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const cases = await listBenchmarkCases();

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <header className="flex items-center justify-between border-b border-foreground/10 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/50">
            Crado
          </p>
          <h1 className="text-lg font-semibold tracking-tight">Benchmark harness</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Evaluate Crado against historical failures it has never seen the
            answer to. Each case&rsquo;s underlying product/revision/measurement
            is a real, ordinary case built through the normal workflow — only
            the ground truth (root cause, diagnostic actions, the fix, the
            final measurement) is kept separate and hidden until you reveal
            it.
          </p>
        </div>
        <Link
          href="/benchmarks/new"
          className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          New benchmark case
        </Link>
      </header>

      {cases.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No benchmark cases yet. Build a product, revision, failure case,
          and first measurement through the normal workflow, then register
          it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cases.map((benchmarkCase) => (
            <li key={benchmarkCase.id}>
              <Link
                href={`/benchmarks/${benchmarkCase.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-foreground/10 px-4 py-3 text-sm hover:border-foreground/30"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{benchmarkCase.name}</span>
                  <span className="text-foreground/60">
                    {benchmarkCase.productName} · {benchmarkCase.revisionLabel} ·{" "}
                    {benchmarkCase.failureCaseTitle}
                  </span>
                </div>
                <span className="rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium uppercase tracking-wide text-foreground/60">
                  {STATUS_LABEL[benchmarkCase.status] ?? benchmarkCase.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
