"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  productFactCategorySchema,
  productFactInputSchema,
  type ProductFactCategory,
} from "@/lib/domain/schema";

export interface FactFormState {
  error?: string;
}

export interface FailureCaseFormState {
  error?: string;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function buildFactPayload(
  category: ProductFactCategory,
  formData: FormData,
): unknown {
  const label = formData.get("label");

  switch (category) {
    case "clock":
      return { label, frequencyMhz: optionalNumber(formData.get("frequencyMhz")) };
    case "radio":
      return {
        label,
        technology: formData.get("technology"),
        frequencyMhz: optionalNumber(formData.get("frequencyMhz")),
      };
    case "power":
      return {
        label,
        topology: formData.get("topology"),
        switchingFrequencyMhz: optionalNumber(
          formData.get("switchingFrequencyMhz"),
        ),
      };
    case "cable":
      return { label, shielded: formData.get("shielded") === "on" };
    case "other":
      return { label, notes: formData.get("notes") || undefined };
  }
}

export async function createFact(
  productId: string,
  revisionId: string,
  _prevState: FactFormState,
  formData: FormData,
): Promise<FactFormState> {
  const categoryParsed = productFactCategorySchema.safeParse(
    formData.get("category"),
  );
  if (!categoryParsed.success) {
    return { error: "Choose a fact category." };
  }

  const parsed = productFactInputSchema.safeParse({
    category: categoryParsed.data,
    fact: buildFactPayload(categoryParsed.data, formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("product_facts").insert({
    product_revision_id: revisionId,
    category: parsed.data.category,
    fact: parsed.data.fact,
    source: parsed.data.source,
  });

  if (error) {
    return { error: "Could not save this fact." };
  }

  revalidatePath(`/products/${productId}/revisions/${revisionId}`);
  return {};
}

export async function createFailureCase(
  revisionId: string,
  _prevState: FailureCaseFormState,
  _formData: FormData,
): Promise<FailureCaseFormState> {
  const supabase = await createClient();

  const { data: failureCase, error } = await supabase
    .from("failure_cases")
    .insert({ product_revision_id: revisionId })
    .select("id")
    .single();
  if (error || !failureCase) {
    // The composite FK rejects this if revisionId isn't in this workspace.
    return { error: "Could not open a failure case." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("investigation_events").insert({
      failure_case_id: failureCase.id,
      event_type: "case_opened",
      description: "Radiated emissions case opened.",
      created_by: user.id,
    });
  }

  redirect(`/cases/${failureCase.id}`);
}
