import Link from "next/link";
import { notFound } from "next/navigation";
import { getFailureCase } from "@/lib/cases/queries";
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
          <AddMeasurementForm
            caseId={failureCase.id}
            productRevisionId={failureCase.productRevisionId}
          />
        </section>
      </div>
    </div>
  );
}
