// APPLICATION SHELL (UX-04 Agent-Native): a real collapsible sidebar
// (Vercel/Supabase-Studio shaped, not a bare icon strip) shared by every
// authenticated route. Server wrapper fetches the workspace/user identity
// once (so no route's layout.tsx needs new props) and hands it to the
// client chrome, which owns collapse state + the Cmd/Ctrl+K command
// palette. Real destinations only — no placeholder "Settings" nav item;
// see docs/UX_AGENT_NATIVE.md §8 for why Workspace/Settings/User collapse
// into one real account menu instead.
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { createClient } from "@/lib/supabase/server";
import { listInvestigations } from "@/lib/investigations/queries";
import { listProducts } from "@/lib/products/queries";
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
  // Real data for the command palette's "recent"/"products" sections —
  // trimmed to a small slice since every authenticated page pays for this
  // query. Never fabricated: if either list is empty, the palette simply
  // omits that section (see command-palette.tsx).
  const [workspace, supabase, investigations, products] = await Promise.all([
    getCurrentWorkspace(),
    createClient(),
    listInvestigations(),
    listProducts(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShellChrome
      active={active}
      workspaceName={workspace?.name ?? "Workspace"}
      userEmail={user?.email ?? null}
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
