// Revision lineage (MVP-11): walks the supersedes_revision_id chain
// forward from a starting revision to find the newest tip — "the revision
// a case's evidence should attach to right now" without ever needing to
// touch or reinterpret the starting revision itself. Bounded (MAX_HOPS) so
// a data anomaly (an accidental cycle) can never loop forever.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface RevisionLineageNode {
  id: string;
  label: string;
}

const MAX_HOPS = 25;

/**
 * Returns the newest revision in `startRevisionId`'s lineage: the one that
 * nothing else supersedes. If nothing supersedes `startRevisionId` itself,
 * that's the answer (the common case — most revisions have no follow-up
 * yet).
 */
export async function getLatestRevisionInLineage(
  supabase: SupabaseClient<Database>,
  startRevisionId: string,
): Promise<RevisionLineageNode | null> {
  let current: RevisionLineageNode | null = null;
  let cursor = startRevisionId;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const { data } = await supabase
      .from("product_revisions")
      .select("id, label")
      .eq("id", cursor)
      .maybeSingle();
    if (!data) return current;
    current = { id: data.id, label: data.label };

    const { data: next } = await supabase
      .from("product_revisions")
      .select("id")
      .eq("supersedes_revision_id", cursor)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!next) return current;
    cursor = next.id;
  }
  return current;
}
