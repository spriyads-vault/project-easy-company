"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface RevisionFormState {
  error?: string;
}

const createRevisionSchema = z.object({
  label: z.string().trim().min(1, "Revision label is required."),
  notes: z.string().trim().optional(),
});

export async function createRevision(
  productId: string,
  _prevState: RevisionFormState,
  formData: FormData,
): Promise<RevisionFormState> {
  const parsed = createRevisionSchema.safeParse({
    label: formData.get("label"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data: revision, error } = await supabase
    .from("product_revisions")
    .insert({
      product_id: productId,
      label: parsed.data.label,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !revision) {
    // The composite FK rejects this if productId isn't in this workspace.
    return { error: "Could not create the revision." };
  }

  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}/revisions/${revision.id}`);
}
