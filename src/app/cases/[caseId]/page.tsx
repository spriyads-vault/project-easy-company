import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFailureCase } from "@/lib/cases/queries";
import { getLatestRevisionInLineage } from "@/lib/products/revision-lineage";
import { AddMeasurementForm } from "./add-measurement-form";

interface CasePageProps {
  params: Promise<{ caseId: string }>;
}

export default async function CasePage({ params }: CasePageProps) {
  const { caseId } = await params;
  const failureCase = await getFailureCase(caseId);
  if (!failureCase) {
    notFound();
  }

  // MVP-11: a follow-up measurement (after an engineering change) belongs to
  // the newest revision in the case's lineage, not the case's original one
  // — REV17 stays exactly as it was, the new measurement attaches to REV18.
  const supabase = await createClient();
  const currentRevision =
    (await getLatestRevisionInLineage(supabase, failureCase.productRevisionId)) ?? {
      id: failureCase.productRevisionId,
      label: failureCase.revisionLabel,
    };

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href={`/products/${failureCase.productId}/revisions/${failureCase.productRevisionId}`}
          className="text-xs text-foreground/60 hover:underline"
        >
          ← {failureCase.productName} · {failureCase.revisionLabel}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          {failureCase.title}
        </h1>
        <p className="text-sm text-foreground/60">
          {failureCase.productName} · {failureCase.revisionLabel} ·{" "}
          {failureCase.status}
        </p>
        <Link
          href={`/cases/${failureCase.id}/investigation`}
          className="mt-2 self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Open investigation workspace
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Measurements
          </h2>
          {failureCase.measurements.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No measurements recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {failureCase.measurements.map((measurement) => (
                <li
                  key={measurement.id}
                  className="rounded-md border border-foreground/10 px-3 py-2 text-sm"
                >
                  <div className="font-medium">
                    <span className="mr-2 font-normal text-foreground/50">
                      {measurement.revisionLabel}
                    </span>
                    {measurement.label ?? "Measurement"}
                    {measurement.operatingMode ? (
                      <span className="ml-2 font-normal text-foreground/60">
                        {measurement.operatingMode}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-1 flex flex-col gap-1">
                    {measurement.peaks.map((peak) => (
                      <li key={peak.id} className="text-foreground/80">
                        {peak.frequencyMhz} MHz at{" "}
                        <span
                          className={
                            peak.marginDb > 0
                              ? "font-medium text-red-600"
                              : "font-medium text-green-700"
                          }
                        >
                          {peak.marginDb > 0 ? "+" : ""}
                          {peak.marginDb} dB
                        </span>
                        {peak.detector ? ` · ${peak.detector}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Add a measurement
          </h2>
          {currentRevision.id !== failureCase.productRevisionId ? (
            <p className="text-xs text-foreground/50">
              This will be recorded against {currentRevision.label}, the
              current revision following an engineering change.
            </p>
          ) : null}
          <AddMeasurementForm
            caseId={failureCase.id}
            productRevisionId={currentRevision.id}
          />
        </section>
      </div>
    </div>
  );
}
