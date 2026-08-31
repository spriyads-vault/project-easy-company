import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { signOut } from "./actions";

export default async function WorkspacePage() {
  const workspace = await getCurrentWorkspace();

  // Defense in depth: middleware already redirects unauthenticated
  // requests, but a page that can render private data should never trust
  // that alone.
  if (!workspace) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <header className="flex items-center justify-between border-b border-foreground/10 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/50">
            Crado
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            {workspace.name}
          </h1>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium"
          >
            Sign out
          </button>
        </form>
      </header>

      <p className="text-sm text-foreground/70">
        No products yet. Product context, failure cases, and measurements
        land here in the next tickets.
      </p>
    </div>
  );
}
