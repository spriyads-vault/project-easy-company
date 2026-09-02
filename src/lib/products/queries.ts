import { createClient } from "@/lib/supabase/server";

export interface ProductSummary {
  id: string;
  name: string;
  createdAt: string;
  /** UX-04 "rich product status": real counts/labels only, never a
   * placeholder — both derived from the same product_revisions rows the
   * product detail page already reads, just aggregated here too. */
  revisionCount: number;
  latestRevisionLabel: string | null;
}

export interface ProductRevision {
  id: string;
  productId: string;
  label: string;
  notes: string | null;
  createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  revisions: ProductRevision[];
}

export interface ProductFactRow {
  id: string;
  productRevisionId: string;
  category: "clock" | "radio" | "power" | "cable" | "other";
  fact: Record<string, unknown>;
  source: "user_entered" | "extracted";
  createdAt: string;
}

export interface RevisionDetail {
  id: string;
  productId: string;
  productName: string;
  label: string;
  notes: string | null;
  facts: ProductFactRow[];
}

/** All products in the signed-in user's workspace, most recent first, with
 * a real revision count and latest-revision label for each — the
 * workspace list's "rich product status" (UX-04), not a placeholder. One
 * extra query for every product's revisions (RLS already scopes this to
 * the signed-in workspace) rather than N+1 per-product queries. */
export async function listProducts(): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  if (data.length === 0) return [];

  const { data: revisionRows } = await supabase
    .from("product_revisions")
    .select("product_id, label, created_at")
    .in(
      "product_id",
      data.map((row) => row.id),
    )
    .order("created_at", { ascending: false });

  const revisionsByProduct = new Map<string, { label: string; createdAt: string }[]>();
  for (const row of revisionRows ?? []) {
    const existing = revisionsByProduct.get(row.product_id) ?? [];
    existing.push({ label: row.label, createdAt: row.created_at });
    revisionsByProduct.set(row.product_id, existing);
  }

  return data.map((row) => {
    const revisions = revisionsByProduct.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      revisionCount: revisions.length,
      // Already ordered most-recent-first by the query above.
      latestRevisionLabel: revisions[0]?.label ?? null,
    };
  });
}

/** A single product with its revisions, most recent revision first. */
export async function getProduct(
  productId: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, created_at")
    .eq("id", productId)
    .single();
  if (productError || !product) return null;

  const { data: revisions } = await supabase
    .from("product_revisions")
    .select("id, product_id, label, notes, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  const mappedRevisions = (revisions ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    label: row.label,
    notes: row.notes,
    createdAt: row.created_at,
  }));

  return {
    id: product.id,
    name: product.name,
    createdAt: product.created_at,
    // Already ordered most-recent-first by the query above.
    revisionCount: mappedRevisions.length,
    latestRevisionLabel: mappedRevisions[0]?.label ?? null,
    revisions: mappedRevisions,
  };
}

/** A single revision with its product name and structured facts. */
export async function getRevision(
  revisionId: string,
): Promise<RevisionDetail | null> {
  const supabase = await createClient();

  const { data: revision, error: revisionError } = await supabase
    .from("product_revisions")
    .select("id, product_id, label, notes, products(name)")
    .eq("id", revisionId)
    .single();
  if (revisionError || !revision) return null;

  const { data: facts } = await supabase
    .from("product_facts")
    .select("id, product_revision_id, category, fact, source, created_at")
    .eq("product_revision_id", revisionId)
    .order("created_at", { ascending: false });

  return {
    id: revision.id,
    productId: revision.product_id,
    productName: revision.products?.name ?? "Unknown product",
    label: revision.label,
    notes: revision.notes,
    facts: (facts ?? []).map((row) => ({
      id: row.id,
      productRevisionId: row.product_revision_id,
      category: row.category as ProductFactRow["category"],
      fact: row.fact as Record<string, unknown>,
      source: row.source as ProductFactRow["source"],
      createdAt: row.created_at,
    })),
  };
}
