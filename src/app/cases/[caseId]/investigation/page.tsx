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
      {/* UX-01: kept slim deliberately — the InvestigationHero rendered as
          the first row inside InvestigationWorkspace now owns the primary
          product/revision/case identity, failure-type badge, headline
          frequency/margin, and live status, so this stays a plain
          breadcrumb back to the case page rather than repeating that
          content in a second, differently-styled header. */}
      <header className="flex items-center border-b border-[#262922] px-5 py-3">
        <Link
          href={`/cases/${caseId}`}
          className={`text-xs ${text.muted} hover:text-[#f3f1e8] hover:underline`}
        >
          ← {failureCase.title}
        </Link>
      </header>

      <InvestigationWorkspace
        caseId={caseId}
        productId={failureCase.productId}
        revisionId={currentRevisionId}
        currentRevisionLabel={currentRevisionLabel}
        productName={failureCase.productName}
        hasMultipleRevisions={hasMultipleRevisions}
        productFacts={productFacts}
        measurement={measurement}
        initialState={workspaceState}
        timelineEntries={timelineEntries}
      />
    </div>
  );
}
