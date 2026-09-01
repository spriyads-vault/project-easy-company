import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { getBenchmarkCase, getExpertScore } from "@/lib/benchmarks/queries";
import { ExpertScoreForm } from "./expert-score-form";

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
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <header className="flex flex-col gap-1 border-b border-foreground/10 pb-4">
        <Link
          href={`/benchmarks/${benchmarkCaseId}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← {benchmarkCase.name}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Score this investigation run</h1>
        <p className="text-sm text-foreground/60">
          Score what Crado actually produced before ground truth is
          revealed — review the run in the{" "}
          <Link
            href={`/cases/${benchmarkCase.failureCaseId}/investigation`}
            className="underline"
          >
            investigation workspace
          </Link>{" "}
          first if you haven&rsquo;t already.
        </p>
      </header>

      <div className="max-w-xl">
        {existingScore ? (
          <p className="text-sm text-foreground/60">
            This run has already been scored (
            {new Date(existingScore.scoredAt).toLocaleString()}). Each run
            can only be scored once.
          </p>
        ) : (
          <ExpertScoreForm benchmarkCaseId={benchmarkCaseId} analysisRunId={runId} />
        )}
      </div>
    </div>
  );
}
