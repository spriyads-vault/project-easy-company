// APPLICATION SHELL (UX-05 Workstream A): a real shadcn Sidebar
// composition (see src/components/ui/sidebar.tsx) shared by every
// authenticated route. Server wrapper fetches the workspace/user identity
// once (so no route's layout.tsx needs new props) and hands it to the
// client chrome, which owns the shadcn Sidebar's own open/collapsed state.
// Real destinations only — no placeholder "Settings"/"Evidence" nav item;
// this workspace has no standalone Settings or workspace-wide Evidence
// route yet (Evidence lives inside a case's Decision view), so neither is
// listed until one genuinely exists.
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import { listInvestigations } from "@/lib/investigations/queries";
import { listProducts } from "@/lib/products/queries";
import { queueFilterBucket } from "@/lib/investigations/derive-queue-workflow-state";
import { AppShellChrome, type RailSection } from "./app-shell-chrome";

export type { RailSection };

interface AppShellProps {
  children: React.ReactNode;
  /** Which rail item is "current" for this route — omit on a route the
   * rail doesn't represent (e.g. a case/investigation page, or the
   * account page itself). */
  active?: RailSection;
}

export async function AppShell({ children, active }: AppShellProps) {
  // Real data for the command palette's "recent"/"products" sections and
  // the Investigations badge — trimmed to a small slice since every
  // authenticated page pays for this query. Never fabricated: if a list
  // is empty or a bucket count is zero, the corresponding UI simply omits
  // it (see command-palette.tsx / app-shell-chrome.tsx's SidebarMenuBadge).
  const [workspace, supabase, investigations, products] = await Promise.all([
    getCurrentWorkspace(),
    createClient(),
    listInvestigations(),
    listProducts(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Needs attention" = investigations genuinely waiting on the engineer
  // (needs_evidence or ready_for_review buckets) — the one real count
  // this rail badges, per "SidebarMenuBadge only for real counts".
  const needsAttentionCount = investigations.filter((investigation) => {
    const bucket = queueFilterBucket(investigation.workflowState);
    return bucket === "needs_evidence" || bucket === "ready_for_review";
  }).length;

  return (
    <AppShellChrome
      active={active}
      workspaceName={workspace?.name ?? "Workspace"}
      userEmail={user?.email ?? null}
      investigationsBadgeCount={needsAttentionCount}
      recentInvestigations={investigations.slice(0, 8).map((investigation) => ({
        id: investigation.id,
        title: investigation.title,
        productName: investigation.productName,
        revisionLabel: investigation.revisionLabel,
      }))}
      products={products.slice(0, 8).map((product) => ({ id: product.id, name: product.name }))}
    >
      {children}
    </AppShellChrome>
  );
}
