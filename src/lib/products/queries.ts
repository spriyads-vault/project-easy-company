import { createClient } from "@/lib/supabase/server";

export interface ProductSummary {
  id: string;
  name: string;
  createdAt: string;
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

/** All products in the signed-in user's workspace, most recent first. */
export async function listProducts(): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
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

  return {
    id: product.id,
    name: product.name,
    createdAt: product.created_at,
    revisions: (revisions ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      label: row.label,
      notes: row.notes,
      createdAt: row.created_at,
    })),
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
