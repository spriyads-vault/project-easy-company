"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { expertScoreInputSchema } from "@/lib/benchmarks/schema";
import { recordExpertScore } from "@/lib/benchmarks/record-expert-score";

export interface ScoreFormState {
  error?: string;
}

export async function submitExpertScore(
  benchmarkCaseId: string,
  analysisRunId: string,
  _prevState: ScoreFormState,
  formData: FormData,
): Promise<ScoreFormState> {
  const parsed = expertScoreInputSchema.safeParse({
    nextActionUseful: Number(formData.get("nextActionUseful")),
    hypothesesUseful: Number(formData.get("hypothesesUseful")),
    misleading: formData.get("misleading") === "yes",
    wouldChangeNextAction: formData.get("wouldChangeNextAction") === "yes",
    comments: formData.get("comments") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid score." };
  }

  const result = await recordExpertScore(benchmarkCaseId, analysisRunId, parsed.data);
  if (!result.ok) {
    return { error: result.message ?? "Could not save the score." };
  }

  revalidatePath(`/benchmarks/${benchmarkCaseId}`);
  redirect(`/benchmarks/${benchmarkCaseId}`);
}
