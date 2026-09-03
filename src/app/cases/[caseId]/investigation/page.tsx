import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvestigationWorkspaceData } from "@/lib/investigation/queries";
import { getInvestigationTimeline } from "@/lib/investigation/timeline";
import { InvestigationWorkspace } from "./investigation-workspace";

interface InvestigationPageProps {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ autorun?: string }>;
}

export default async function InvestigationPage({ params, searchParams }: InvestigationPageProps) {
  const { caseId } = await params;
  const { autorun } = await searchParams;
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

  // UX-03: no page-level header any more — InvestigationWorkspace renders
  // its own top bar (breadcrumb, agent-status pill, view switcher) as the
  // first row inside the (shared, layout.tsx-provided) application shell,
  // so there's exactly one identity row instead of a plain-text breadcrumb
  // stacked above a second, separate agent-presence header.
  return (
    <InvestigationWorkspace
      caseId={caseId}
      productId={failureCase.productId}
      revisionId={currentRevisionId}
      currentRevisionLabel={currentRevisionLabel}
      productName={failureCase.productName}
      hasMultipleRevisions={hasMultipleRevisions}
      caseStatus={failureCase.status}
      productFacts={productFacts}
      measurement={measurement}
      initialState={workspaceState}
      timelineEntries={timelineEntries}
      autoRun={autorun === "1"}
    />
  );
}
