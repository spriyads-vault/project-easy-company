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
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { StatusBadge } from "@/lib/design/status-badge";
import { surface, text, typography } from "@/lib/design/tokens";

interface BenchmarkCasePageProps {
  params: Promise<{ benchmarkCaseId: string }>;
}

function metricRow(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return (
    <div key={label} className="flex items-baseline justify-between gap-3 border-b border-[#ececee] py-1.5 text-sm last:border-b-0">
      <span className={typography.metadata}>{label}</span>
      <span className={`font-medium text-[#18181b] ${text.mono}`}>{value}</span>
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
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader backHref="/benchmarks" backLabel="Benchmarks" title={benchmarkCase.name} />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className={typography.metadata}>
              {benchmarkCase.productName} · {benchmarkCase.revisionLabel} ·{" "}
              {benchmarkCase.failureCaseTitle}
            </p>
            <p className={typography.body}>{benchmarkCase.sourceDescription}</p>
          </div>

          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <div className="flex items-center justify-between">
              <h2 className={typography.sectionHeading}>Investigation runs</h2>
              <Link
                href={`/cases/${benchmarkCase.failureCaseId}/investigation`}
                className="rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-sm font-medium text-[#18181b] transition-colors hover:border-[#d4d4d8] hover:bg-[#f4f4f5]"
              >
                Open investigation workspace
              </Link>
            </div>

            {runs.length === 0 ? (
              <EmptyState message="No investigation runs yet. Open the investigation workspace and let Crado analyze the case blind, exactly as it would for any real failure case." />
            ) : (
              <ul className="flex flex-col gap-2">
                {runs.map((run) => (
                  <li
                    key={run.analysisRunId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ececee] px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[#18181b]">
                        Run started {new Date(run.createdAt).toLocaleString()}
                      </span>
                      <span className={typography.metadata}>Status: {run.status}</span>
                    </div>
                    {run.hasScore ? (
                      <StatusBadge label="Scored" tone="complete" />
                    ) : (
                      <Link
                        href={`/benchmarks/${benchmarkCaseId}/score/${run.analysisRunId}`}
                        className="rounded-lg border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-3 py-1.5 text-xs font-medium text-[#15803d] transition-colors hover:bg-[#1f9d52]/20"
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
            <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
              <h2 className={typography.sectionHeading}>Ground truth</h2>
              <p className={typography.body}>
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
            <>
              <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
                <h2 className={typography.sectionHeading}>Ground truth</h2>
                {groundTruth ? (
                  <dl className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <dt className={typography.metadata}>Actual root cause</dt>
                      <dd className={typography.body}>{groundTruth.rootCause}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className={typography.metadata}>Diagnostic actions actually taken</dt>
                      <dd className={typography.body}>{groundTruth.diagnosticActionsTaken}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className={typography.metadata}>Successful engineering change</dt>
                      <dd className={typography.body}>{groundTruth.successfulEngineeringChange}</dd>
                    </div>
                    {groundTruth.finalFrequencyMhz !== null || groundTruth.finalMarginDb !== null ? (
                      <div className="flex flex-col gap-0.5">
                        <dt className={typography.metadata}>Final measurement</dt>
                        <dd className={`${typography.body} ${text.mono}`}>
                          {groundTruth.finalFrequencyMhz ?? "?"} MHz at{" "}
                          {groundTruth.finalMarginDb ?? "?"} dB
                        </dd>
                      </div>
                    ) : null}
                    {groundTruth.finalOutcomeNotes ? (
                      <div className="flex flex-col gap-0.5">
                        <dt className={typography.metadata}>Final outcome notes</dt>
                        <dd className={typography.body}>{groundTruth.finalOutcomeNotes}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className={typography.body}>No ground truth record found.</p>
                )}
              </section>

              <div className="flex flex-col gap-4">
                <h2 className={typography.sectionHeading}>Comparison report</h2>
                {runReports.map(({ run, score, metrics }) => (
                  <div key={run.analysisRunId} className={`flex flex-col gap-4 p-5 ${surface.card}`}>
                    <p className="text-sm font-medium text-[#18181b]">
                      Run started {new Date(run.createdAt).toLocaleString()}
                    </p>

                    {score ? (
                      <div className="grid grid-cols-2 gap-x-6">
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
                      <p className={typography.body}>Not scored.</p>
                    )}

                    <div className="grid grid-cols-2 gap-x-6 rounded-xl bg-[#f4f4f5]/60 px-3">
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
                        <p className={typography.metadata}>
                          Keyword overlap with actual root cause (non-authoritative —
                          a transparency signal, not a verdict)
                        </p>
                        <ul className="flex flex-col gap-0.5 text-sm">
                          {metrics.groundTruthComparison.keywordOverlapByHypothesis.map((h, i) => (
                            <li key={i} className="flex justify-between gap-3">
                              <span className="text-[#18181b]">{h.title}</span>
                              <span className={`${typography.metadata} ${text.mono}`}>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
