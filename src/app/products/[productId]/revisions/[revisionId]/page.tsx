import Link from "next/link";
import { notFound } from "next/navigation";
import { getRevision } from "@/lib/products/queries";
import { describeProductFact } from "@/lib/products/describe-fact";
import { listFailureCases, type FailureCaseSummary } from "@/lib/cases/queries";
import { AddFactForm } from "./add-fact-form";
import { OpenCaseButton } from "./open-case-button";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { StatusBadge } from "@/lib/design/status-badge";
import { surface, typography, type HeroStatusTone } from "@/lib/design/tokens";

interface RevisionPageProps {
  params: Promise<{ productId: string; revisionId: string }>;
}

const STATUS_TONE: Record<FailureCaseSummary["status"], HeroStatusTone> = {
  open: "active",
  resolved: "complete",
  archived: "idle",
};

export default async function RevisionPage({ params }: RevisionPageProps) {
  const { productId, revisionId } = await params;
  const revision = await getRevision(revisionId);
  if (!revision || revision.productId !== productId) {
    notFound();
  }
  const failureCases = await listFailureCases(revisionId);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        backHref={`/products/${productId}`}
        backLabel={revision.productName}
        title={revision.label}
      />

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
          {revision.notes ? (
            <p className={typography.body}>{revision.notes}</p>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
              <h2 className={typography.sectionHeading}>Product context</h2>
              {revision.facts.length === 0 ? (
                <EmptyState message="No facts recorded yet." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {revision.facts.map((fact) => (
                    <li
                      key={fact.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ececee] px-3 py-2 text-sm text-[#18181b]"
                    >
                      <span className="rounded-full border border-[#e4e4e7] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#71717a]">
                        {fact.category}
                      </span>
                      {describeProductFact(fact)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
              <h2 className={typography.sectionHeading}>Add a fact</h2>
              <AddFactForm productId={productId} revisionId={revisionId} />
            </section>
          </div>

          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>Failure cases</h2>
            {failureCases.length === 0 ? (
              <EmptyState message="No failure cases opened against this revision yet." />
            ) : (
              <ul className="flex flex-col gap-2">
                {failureCases.map((failureCase) => (
                  <li key={failureCase.id}>
                    <Link
                      href={`/cases/${failureCase.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#ececee] px-3 py-2 text-sm transition-colors hover:border-[#d4d4d8] hover:bg-[#f4f4f5]/60"
                    >
                      <span className="font-medium text-[#18181b]">{failureCase.title}</span>
                      <StatusBadge label={failureCase.status} tone={STATUS_TONE[failureCase.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <OpenCaseButton revisionId={revisionId} />
          </section>
        </div>
      </div>
    </div>
  );
}
