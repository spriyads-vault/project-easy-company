// UX-04 (Agent-Native): the real "Workspace" account page, reached from
// the sidebar's account menu. Deliberately thin — real identity/sign-out
// content only, never a placeholder "Settings" surface with nothing
// behind it (see docs/UX_AGENT_NATIVE.md §8).
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/lib/design/page-header";
import { surface, typography } from "@/lib/design/tokens";
import { signOut } from "./actions";

export default async function WorkspacePage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader eyebrow="Crado" title="Workspace" />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className={`mx-auto flex w-full max-w-[560px] flex-col gap-5 p-5 ${surface.card}`}>
          <div className="flex flex-col gap-1">
            <span className={typography.metadata}>Workspace name</span>
            <span className={typography.pageTitle}>{workspace.name}</span>
          </div>
          {user?.email ? (
            <div className="flex flex-col gap-1">
              <span className={typography.metadata}>Signed in as</span>
              <span className={`${typography.body} ${typography.technical}`}>{user.email}</span>
            </div>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="self-start rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
