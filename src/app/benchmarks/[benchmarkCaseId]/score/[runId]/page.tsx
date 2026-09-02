import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { getBenchmarkCase, getExpertScore } from "@/lib/benchmarks/queries";
import { ExpertScoreForm } from "./expert-score-form";
import { PageHeader } from "@/lib/design/page-header";
import { surface, typography } from "@/lib/design/tokens";

interface ScorePageProps {
  params: Promise<{ benchmarkCaseId: string; runId: string }>;
}

export default async function ScoreRunPage({ params }: ScorePageProps) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { benchmarkCaseId, runId } = await params;
  const benchmarkCase = await getBenchmarkCase(benchmarkCaseId);
  if (!benchmarkCase) {
    notFound();
  }

  const existingScore = await getExpertScore(runId);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        backHref={`/benchmarks/${benchmarkCaseId}`}
        backLabel={benchmarkCase.name}
        title="Score this investigation run"
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <p className={typography.body}>
            Score what Crado actually produced before ground truth is
            revealed — review the run in the{" "}
            <Link
              href={`/cases/${benchmarkCase.failureCaseId}/investigation`}
              className="text-[#22c55e] underline underline-offset-2"
            >
              investigation workspace
            </Link>{" "}
            first if you haven&rsquo;t already.
          </p>

          {existingScore ? (
            <p className={typography.body}>
              This run has already been scored (
              {new Date(existingScore.scoredAt).toLocaleString()}). Each run
              can only be scored once.
            </p>
          ) : (
            <div className={`p-5 ${surface.card}`}>
              <ExpertScoreForm benchmarkCaseId={benchmarkCaseId} analysisRunId={runId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
