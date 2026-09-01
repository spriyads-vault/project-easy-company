import Link from "next/link";
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
    <div className={`flex flex-1 flex-col gap-6 px-8 py-10 ${surface.page}`}>
      <header className="flex flex-col gap-1 border-b border-[#262922] pb-4">
        <Link href="/workspace" className={`text-xs ${text.muted} hover:underline`}>
          ← {workspace.name}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold uppercase tracking-wide">Sources</h1>
          <span className={`text-2xl font-semibold ${text.mono}`}>
            {workspaceTotalCount} <span className={text.kicker}>documents</span>
          </span>
        </div>
      </header>

      <TypeFilterTabs active={typeFilter} />

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <UploadForm />
        <section aria-labelledby="documents-list-heading" className={`flex flex-col gap-3 p-4 ${surface.panel}`}>
          <div className="flex items-baseline justify-between">
            <h2 id="documents-list-heading" className={text.kicker}>
              Documents
            </h2>
            {typeFilter ? <span className={`text-xs ${text.muted}`}>{totalCount} matching</span> : null}
          </div>
          {workspaceTotalCount === 0 ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <p className={`text-sm ${text.muted}`}>
                No engineering documents are available for this product yet.
              </p>
            </div>
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
  );
}
