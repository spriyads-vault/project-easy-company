import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import { listEngineeringDocuments } from "@/lib/documents/queries";
import { UploadForm } from "./upload-form";
import { DocumentList } from "./document-list";
import { SearchPanel } from "./search-panel";
import { surface, text } from "./theme";

interface DocumentsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);

  const supabase = await createClient();
  const { documents, totalCount, pageSize } = await listEngineeringDocuments(supabase, { page });

  return (
    <div className={`flex flex-1 flex-col gap-6 px-8 py-10 ${surface.page}`}>
      <header className="flex flex-col gap-1 border-b border-[#262922] pb-4">
        <Link href="/workspace" className={`text-xs ${text.muted} hover:underline`}>
          ← {workspace.name}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold uppercase tracking-wide">Sources</h1>
          <span className={`text-2xl font-semibold ${text.mono}`}>{totalCount}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <UploadForm />
        <section aria-labelledby="documents-list-heading" className={`flex flex-col gap-3 p-4 ${surface.panel}`}>
          <h2 id="documents-list-heading" className={text.kicker}>
            Documents
          </h2>
          <DocumentList
            documents={documents}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
          />
        </section>
      </div>

      <SearchPanel />
    </div>
  );
}
