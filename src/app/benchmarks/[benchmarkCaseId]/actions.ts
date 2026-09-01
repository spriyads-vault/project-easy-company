"use server";

import { revalidatePath } from "next/cache";
import { revealGroundTruth } from "@/lib/benchmarks/reveal-ground-truth";

export interface RevealFormState {
  error?: string;
}

export async function revealGroundTruthAction(
  benchmarkCaseId: string,
  _prevState: RevealFormState,
): Promise<RevealFormState> {
  const result = await revealGroundTruth(benchmarkCaseId);
  if (!result.ok) {
    return { error: result.message ?? "Could not reveal ground truth." };
  }
  revalidatePath(`/benchmarks/${benchmarkCaseId}`);
  return {};
}
