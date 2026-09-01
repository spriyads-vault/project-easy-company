// VALIDATION-01: the benchmark case detail page. This is the one page in
// the app allowed to display hidden ground truth — and only once the case's
// status is already "revealed" (set by reveal-button.tsx's action, which
// itself refuses to flip status until at least one expert score exists).
// Every other read on this page comes from src/lib/benchmarks/queries.ts,
// the VISIBLE-only module.
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import {
  getBenchmarkCase,
  listBenchmarkRuns,
  listExpertScoresForCase,
} from "@/lib/benchmarks/queries";
import { getGroundTruth } from "@/lib/benchmarks/ground-truth";
import { loadRunEvents } from "@/lib/benchmarks/load-run-events";
import { computeBenchmarkMetrics } from "@/lib/benchmarks/compute-benchmark-metrics";
import { RevealButton } from "./reveal-button";

interface BenchmarkCasePageProps {
  params: Promise<{ benchmarkCaseId: string }>;
}

function metricRow(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return (
    <div key={label} className="flex justify-between border-b border-foreground/5 py-1 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function BenchmarkCasePage({ params }: BenchmarkCasePageProps) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { benchmarkCaseId } = await params;
  const benchmarkCase = await getBenchmarkCase(benchmarkCaseId);
  if (!benchmarkCase) {
    notFound();
  }

  const [runs, scores] = await Promise.all([
    listBenchmarkRuns(benchmarkCase.failureCaseId),
    listExpertScoresForCase(benchmarkCaseId),
  ]);
  const scoreByRunId = new Map(scores.map((s) => [s.analysisRunId, s]));
  const anyScored = scores.length > 0;

  const revealed = benchmarkCase.status === "revealed";
  const groundTruth = revealed ? await getGroundTruth(benchmarkCaseId) : null;

  // Comparison report: recompute deterministic metrics per scored run, now
  // that ground truth is available — the same computeBenchmarkMetrics used
  // throughout, just called a second time with groundTruth once it's safe
  // to.
  const runReports = revealed
    ? await Promise.all(
        runs.map(async (run) => {
          const events = await loadRunEvents(run.analysisRunId);
          return {
            run,
            score: scoreByRunId.get(run.analysisRunId) ?? null,
            metrics: computeBenchmarkMetrics(events, groundTruth ?? undefined),
          };
        }),
      )
    : [];

  return (
    <div className="flex flex-1 flex-col gap-8 px-8 py-10 text-foreground">
      <header className="flex flex-col gap-1 border-b border-foreground/10 pb-4">
        <Link href="/benchmarks" className="text-sm text-foreground/60 hover:text-foreground">
          ← Benchmarks
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{benchmarkCase.name}</h1>
        <p className="text-sm text-foreground/60">
          {benchmarkCase.productName} · {benchmarkCase.revisionLabel} ·{" "}
          {benchmarkCase.failureCaseTitle}
        </p>
        <p className="text-sm text-foreground/60">{benchmarkCase.sourceDescription}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Investigation runs
          </h2>
          <Link
            href={`/cases/${benchmarkCase.failureCaseId}/investigation`}
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium"
          >
            Open investigation workspace
          </Link>
        </div>

        {runs.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No investigation runs yet. Open the investigation workspace and
            let Crado analyze the case blind, exactly as it would for any
            real failure case.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li
                key={run.analysisRunId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-foreground/10 px-4 py-3 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    Run started {new Date(run.createdAt).toLocaleString()}
                  </span>
                  <span className="text-foreground/60">Status: {run.status}</span>
                </div>
                {run.hasScore ? (
                  <span className="rounded-md border border-foreground/15 px-2 py-1 text-xs font-medium uppercase tracking-wide text-foreground/60">
                    Scored
                  </span>
                ) : (
                  <Link
                    href={`/benchmarks/${benchmarkCaseId}/score/${run.analysisRunId}`}
                    className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-background"
                  >
                    Score this run
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!revealed ? (
        <section className="flex flex-col gap-3 rounded-md border border-foreground/15 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Ground truth
          </h2>
          <p className="text-sm text-foreground/60">
            Hidden until at least one investigation run has been scored
            blind. Revealing shows the actual root cause, the diagnostic
            actions taken, the fix, and the final measurement — and produces
            a comparison report against every scored run.
          </p>
          <RevealButton
            benchmarkCaseId={benchmarkCaseId}
            disabled={!anyScored}
            disabledReason={anyScored ? undefined : "Score at least one run first."}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-md border border-foreground/15 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
              Ground truth
            </h2>
            {groundTruth ? (
              <dl className="flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-foreground/60">Actual root cause</dt>
                  <dd>{groundTruth.rootCause}</dd>
                </div>
                <div>
                  <dt className="text-foreground/60">Diagnostic actions actually taken</dt>
                  <dd>{groundTruth.diagnosticActionsTaken}</dd>
                </div>
                <div>
                  <dt className="text-foreground/60">Successful engineering change</dt>
                  <dd>{groundTruth.successfulEngineeringChange}</dd>
                </div>
                {groundTruth.finalFrequencyMhz !== null || groundTruth.finalMarginDb !== null ? (
                  <div>
                    <dt className="text-foreground/60">Final measurement</dt>
                    <dd>
                      {groundTruth.finalFrequencyMhz ?? "?"} MHz at{" "}
                      {groundTruth.finalMarginDb ?? "?"} dB
                    </dd>
                  </div>
                ) : null}
                {groundTruth.finalOutcomeNotes ? (
                  <div>
                    <dt className="text-foreground/60">Final outcome notes</dt>
                    <dd>{groundTruth.finalOutcomeNotes}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-foreground/60">No ground truth record found.</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
              Comparison report
            </h2>
            {runReports.map(({ run, score, metrics }) => (
              <div
                key={run.analysisRunId}
                className="flex flex-col gap-3 rounded-md border border-foreground/15 p-4"
              >
                <p className="text-sm font-medium">
                  Run started {new Date(run.createdAt).toLocaleString()}
                </p>

                {score ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {metricRow("Next action useful?", `${score.nextActionUseful}/5`)}
                    {metricRow("Hypotheses useful?", `${score.hypothesesUseful}/5`)}
                    {metricRow("Misleading?", score.misleading ? "Yes" : "No")}
                    {metricRow(
                      "Would this have changed next action?",
                      score.wouldChangeNextAction ? "Yes" : "No",
                    )}
                    {score.comments ? metricRow("Comments", score.comments) : null}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/60">Not scored.</p>
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {metricRow("Hypotheses produced", metrics.hypothesesCount)}
                  {metricRow("Correlations found", metrics.correlationsCount)}
                  {metricRow("Citations used", metrics.citationsUsedCount)}
                  {metricRow("Tool calls", metrics.toolCallCount)}
                  {metricRow("Unnecessary searches", metrics.unnecessarySearchCount)}
                  {metricRow("Documents available", metrics.documentsAvailable)}
                  {metricRow("Documents searched", metrics.documentSearches)}
                  {metricRow("Passages retrieved", metrics.passagesRetrieved)}
                  {metricRow("Passages used as evidence", metrics.passagesUsedAsEvidence)}
                  {metricRow(
                    "Time to first hypothesis",
                    metrics.timeToFirstHypothesisMs !== null
                      ? `${(metrics.timeToFirstHypothesisMs / 1000).toFixed(1)}s`
                      : null,
                  )}
                  {metricRow(
                    "Total run time",
                    metrics.totalRunTimeMs !== null
                      ? `${(metrics.totalRunTimeMs / 1000).toFixed(1)}s`
                      : null,
                  )}
                </div>

                {metrics.groundTruthComparison ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                      Keyword overlap with actual root cause (non-authoritative —
                      a transparency signal, not a verdict)
                    </p>
                    <ul className="flex flex-col gap-0.5 text-sm">
                      {metrics.groundTruthComparison.keywordOverlapByHypothesis.map((h, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{h.title}</span>
                          <span className="text-foreground/60">
                            {h.sharedTermCount} shared term{h.sharedTermCount === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
