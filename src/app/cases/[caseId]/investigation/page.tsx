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
      {/* Kept slim deliberately — InvestigationWorkspace renders its own
          agent-presence header and quiet case nav (product/revision/case
          ref + Investigation/Evidence/Timeline/Sources tabs) as its first
          two rows, so this stays a plain breadcrumb back to the case page
          rather than repeating that identity in a second header. */}
      <header className="flex items-center border-b border-[#e7e2d6] px-5 py-3">
        <Link
          href={`/cases/${caseId}`}
          className={`text-xs ${text.muted} hover:text-[#1c1a15] hover:underline`}
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
