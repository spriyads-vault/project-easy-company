import { createClient } from "@/lib/supabase/server";

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Returns the signed-in user's workspace, or null if there is no session.
 * RLS guarantees this can never return another user's workspace.
 */
export async function getCurrentWorkspace(): Promise<Workspace | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .single();

  if (error || !data) {
    return null;
  }

  return { id: data.id, name: data.name, createdAt: data.created_at };
}
