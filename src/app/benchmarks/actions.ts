"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { benchmarkCaseInputSchema, groundTruthInputSchema } from "@/lib/benchmarks/schema";
import { createBenchmarkCase } from "@/lib/benchmarks/create-benchmark-case";

export interface NewBenchmarkFormState {
  error?: string;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function registerBenchmarkCase(
  _prevState: NewBenchmarkFormState,
  formData: FormData,
): Promise<NewBenchmarkFormState> {
  const visibleParsed = benchmarkCaseInputSchema.safeParse({
    failureCaseId: formData.get("failureCaseId"),
    name: formData.get("name"),
    sourceDescription: formData.get("sourceDescription"),
  });
  if (!visibleParsed.success) {
    return { error: visibleParsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const hiddenParsed = groundTruthInputSchema.safeParse({
    rootCause: formData.get("rootCause"),
    diagnosticActionsTaken: formData.get("diagnosticActionsTaken"),
    successfulEngineeringChange: formData.get("successfulEngineeringChange"),
    finalFrequencyMhz: optionalNumber(formData.get("finalFrequencyMhz")),
    finalMarginDb: optionalNumber(formData.get("finalMarginDb")),
    finalOutcomeNotes: formData.get("finalOutcomeNotes") || undefined,
  });
  if (!hiddenParsed.success) {
    return { error: hiddenParsed.error.issues[0]?.message ?? "Invalid ground truth." };
  }

  const result = await createBenchmarkCase(visibleParsed.data, hiddenParsed.data);
  if (!result.ok || !result.benchmarkCaseId) {
    return { error: result.message ?? "Could not register this benchmark case." };
  }

  revalidatePath("/benchmarks");
  redirect(`/benchmarks/${result.benchmarkCaseId}`);
}
