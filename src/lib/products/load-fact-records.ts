import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { productFactInputSchema } from "@/lib/domain/schema";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";

/**
 * Loads a revision's product facts and re-validates each against the same
 * Zod schema enforced at write time
 * (src/app/products/[productId]/revisions/[revisionId]/actions.ts). Facts
 * that somehow fail validation are skipped, not trusted — this feeds
 * directly into the correlation engine (MVP-06) and the hypothesis
 * service's model-facing context (MVP-07), both of which assume a valid
 * shape.
 */
export async function loadProductFactRecords(
  supabase: SupabaseClient<Database>,
  productRevisionId: string,
): Promise<ProductFactRecord[]> {
  const { data } = await supabase
    .from("product_facts")
    .select("id, category, fact, source")
    .eq("product_revision_id", productRevisionId);

  const records: ProductFactRecord[] = [];
  for (const row of data ?? []) {
    const parsed = productFactInputSchema.safeParse({
      category: row.category,
      fact: row.fact,
      source: row.source,
    });
    if (parsed.success) {
      records.push({ id: row.id, ...parsed.data });
    }
  }
  return records;
}
