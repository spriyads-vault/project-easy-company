"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface ProductFormState {
  error?: string;
}

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required."),
  revisionLabel: z.string().trim().min(1, "Give the first revision a label."),
});

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    revisionLabel: formData.get("revisionLabel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();
  if (productError || !product) {
    return { error: "Could not create the product." };
  }

  const { data: revision, error: revisionError } = await supabase
    .from("product_revisions")
    .insert({ product_id: product.id, label: parsed.data.revisionLabel })
    .select("id")
    .single();
  if (revisionError || !revision) {
    return { error: "Product created, but the first revision failed." };
  }

  revalidatePath("/products");
  revalidatePath("/investigations");
  redirect(`/products/${product.id}/revisions/${revision.id}`);
}
