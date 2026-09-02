import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import { listEngineeringDocuments } from "@/lib/documents/queries";
import { DOCUMENT_TYPE_GROUPS } from "@/lib/documents/describe-document-type";
import { UploadForm } from "./upload-form";
import { DocumentList } from "./document-list";
import { SearchPanel } from "./search-panel";
import { TypeFilterTabs } from "./type-filter-tabs";
import { surface, text } from "./theme";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { typography } from "@/lib/design/tokens";

interface DocumentsPageProps {
  searchParams: Promise<{ page?: string; type?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { page: pageParam, type: typeParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const typeFilter = typeParam && DOCUMENT_TYPE_GROUPS[typeParam] ? typeParam : null;
  const documentTypes = typeFilter ? DOCUMENT_TYPE_GROUPS[typeFilter] : undefined;

  const supabase = await createClient();
  const { documents, totalCount, pageSize } = await listEngineeringDocuments(supabase, {
    page,
    documentTypes,
  });

  // The header count always reflects the whole workspace, not the active
  // filter — a filter narrows what's shown, it never implies the library
  // itself is smaller.
  const { totalCount: workspaceTotalCount } = typeFilter
    ? await listEngineeringDocuments(supabase, { page: 1, pageSize: 1 })
    : { totalCount };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        eyebrow="Crado"
        title="Sources"
        rightSlot={
          <span className={`text-2xl font-semibold ${text.mono}`}>
            {workspaceTotalCount} <span className={typography.metadata}>documents</span>
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
          <TypeFilterTabs active={typeFilter} />

          <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <UploadForm />
            <section aria-labelledby="documents-list-heading" className={`flex flex-col gap-3 p-5 ${surface.card}`}>
              <div className="flex items-baseline justify-between">
                <h2 id="documents-list-heading" className={typography.sectionHeading}>
                  Documents
                </h2>
                {typeFilter ? <span className={typography.metadata}>{totalCount} matching</span> : null}
              </div>
              {workspaceTotalCount === 0 ? (
                <EmptyState message="No engineering documents are available for this product yet." />
              ) : (
                <DocumentList
                  documents={documents}
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  typeFilter={typeFilter ?? undefined}
                />
              )}
            </section>
          </div>

          <SearchPanel />
        </div>
      </div>
    </div>
  );
}
