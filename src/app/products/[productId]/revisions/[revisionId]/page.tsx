import Link from "next/link";
import { notFound } from "next/navigation";
import { getRevision } from "@/lib/products/queries";
import { describeProductFact } from "@/lib/products/describe-fact";
import { listFailureCases } from "@/lib/cases/queries";
import { AddFactForm } from "./add-fact-form";
import { OpenCaseButton } from "./open-case-button";

interface RevisionPageProps {
  params: Promise<{ productId: string; revisionId: string }>;
}

export default async function RevisionPage({ params }: RevisionPageProps) {
  const { productId, revisionId } = await params;
  const revision = await getRevision(revisionId);
  if (!revision || revision.productId !== productId) {
    notFound();
  }
  const failureCases = await listFailureCases(revisionId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href={`/products/${productId}`}
          className="text-xs text-foreground/60 hover:underline"
        >
          ← {revision.productName}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          {revision.productName} · {revision.label}
        </h1>
        {revision.notes ? (
          <p className="text-sm text-foreground/70">{revision.notes}</p>
        ) : null}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Product context
          </h2>
          {revision.facts.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No facts recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {revision.facts.map((fact) => (
                <li
                  key={fact.id}
                  className="rounded-md border border-foreground/10 px-3 py-2 text-sm"
                >
                  <span className="mr-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs uppercase tracking-wide">
                    {fact.category}
                  </span>
                  {describeProductFact(fact)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Add a fact
          </h2>
          <AddFactForm productId={productId} revisionId={revisionId} />
        </section>
      </div>

      <section className="flex flex-col gap-3 border-t border-foreground/10 pt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
          Failure cases
        </h2>
        {failureCases.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No failure cases opened against this revision yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {failureCases.map((failureCase) => (
              <li key={failureCase.id}>
                <Link
                  href={`/cases/${failureCase.id}`}
                  className="block rounded-md border border-foreground/10 px-3 py-2 text-sm hover:border-foreground/30"
                >
                  {failureCase.title}
                  <span className="ml-2 text-foreground/60">
                    {failureCase.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <OpenCaseButton revisionId={revisionId} />
      </section>
    </div>
  );
}
