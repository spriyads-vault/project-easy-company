import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFailureCase } from "@/lib/cases/queries";
import { getLatestRevisionInLineage } from "@/lib/products/revision-lineage";
import { AddMeasurementForm } from "./add-measurement-form";
import { TopBar } from "./investigation/top-bar";
import { surface, text } from "./investigation/theme";

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
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <TopBar
        caseId={caseId}
        backHref={`/products/${failureCase.productId}/revisions/${failureCase.productRevisionId}`}
        backLabel={`${failureCase.productName} · ${failureCase.revisionLabel}`}
        productName={failureCase.productName}
        revisionLabel={failureCase.revisionLabel}
        caseTitle="Radiated emissions"
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{failureCase.title}</h1>
          <p className={`text-sm ${text.muted}`}>
            {failureCase.productName} · {failureCase.revisionLabel} · {failureCase.status}
          </p>
          <Link
            href={`/cases/${failureCase.id}/investigation`}
            className="mt-2 self-start rounded-[10px] border border-[#22c55e]/50 bg-[#22c55e]/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-[#22c55e] transition-colors hover:bg-[#22c55e]/20"
          >
            Open investigation workspace
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-[900px] gap-6 md:grid-cols-2">
          <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
            <h2 className={text.kicker}>Measurements</h2>
            {failureCase.measurements.length === 0 ? (
              <p className={`text-sm ${text.muted}`}>No measurements recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {failureCase.measurements.map((measurement) => (
                  <li key={measurement.id} className="rounded-lg border border-[#1c212a] px-3 py-2 text-sm">
                    <div className="font-medium">
                      <span className={`mr-2 font-normal ${text.muted}`}>
                        {measurement.revisionLabel}
                      </span>
                      {measurement.label ?? "Measurement"}
                      {measurement.operatingMode ? (
                        <span className={`ml-2 font-normal ${text.muted}`}>
                          {measurement.operatingMode}
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-1 flex flex-col gap-1">
                      {measurement.peaks.map((peak) => (
                        <li key={peak.id} className="text-[#9aa3af]">
                          <span className={text.mono}>{peak.frequencyMhz} MHz</span> at{" "}
                          <span
                            className={`font-medium ${text.mono} ${
                              peak.marginDb > 0 ? "text-[#f59e0b]" : "text-[#22c55e]"
                            }`}
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

          <section className={`flex flex-col gap-3 p-5 ${surface.card}`}>
            <h2 className={text.kicker}>Add a measurement</h2>
            {currentRevision.id !== failureCase.productRevisionId ? (
              <p className={`text-xs ${text.muted}`}>
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
    </div>
  );
}
