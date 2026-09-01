import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvestigationWorkspaceData } from "@/lib/investigation/queries";
import { getInvestigationTimeline } from "@/lib/investigation/timeline";
import { InvestigationWorkspace } from "./investigation-workspace";
import { surface, text } from "./theme";

interface InvestigationPageProps {
  params: Promise<{ caseId: string }>;
}

export default async function InvestigationPage({ params }: InvestigationPageProps) {
  const { caseId } = await params;
  const data = await getInvestigationWorkspaceData(caseId);
  if (!data) {
    notFound();
  }

  const {
    failureCase,
    productFacts,
    measurement,
    workspaceState,
    currentRevisionId,
    currentRevisionLabel,
    hasMultipleRevisions,
  } = data;
  const supabase = await createClient();
  const timelineEntries = await getInvestigationTimeline(supabase, caseId);

  return (
    <div className={`flex flex-1 flex-col ${surface.page}`}>
      <header className="flex flex-col gap-1 border-b border-[#262922] px-5 py-4">
        <Link
          href={`/cases/${caseId}`}
          className={`text-xs ${text.muted} hover:text-[#f3f1e8] hover:underline`}
        >
          ← {failureCase.title}
        </Link>
        <h1 className="text-lg font-semibold uppercase tracking-wide">
          {failureCase.productName} · {failureCase.revisionLabel}
        </h1>
        <p className={text.kicker}>Failure case · {failureCase.title}</p>
      </header>

      <InvestigationWorkspace
        caseId={caseId}
        productId={failureCase.productId}
        revisionId={currentRevisionId}
        currentRevisionLabel={currentRevisionLabel}
        hasMultipleRevisions={hasMultipleRevisions}
        productFacts={productFacts}
        measurement={measurement}
        initialState={workspaceState}
        timelineEntries={timelineEntries}
      />
    </div>
  );
}
