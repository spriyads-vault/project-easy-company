// The one place business logic is allowed to know which model vendor Crado
// uses (docs/ARCHITECTURE.md: "Keep model access behind one provider
// adapter. Business logic must not depend on one model vendor."). Everything
// else — src/lib/hypotheses/generate-hypotheses.ts, API routes, tests —
// depends only on the HypothesisModelAdapter interface below.
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  hypothesisGenerationInputSchema,
  hypothesisGenerationOutputSchema,
  type HypothesisGenerationInput,
  type HypothesisGenerationOutput,
} from "@/lib/hypotheses/schema";

export interface HypothesisModelAdapter {
  generateHypotheses(
    input: HypothesisGenerationInput,
  ): Promise<HypothesisGenerationOutput>;
}

/**
 * Thrown when a real analysis run needs the model and no API key is
 * configured. The message is safe to show a user or log as-is — it never
 * echoes the key itself or any provider error body. Callers must let this
 * fail loudly (e.g. as a `run.failed` event); never catch it to silently
 * fall back to fake/mock output in production. See CLAUDE.md security
 * rules and MVP-08 requirement 10.
 */
export class MissingProviderApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not configured. Set it in the environment before running analysis.",
    );
    this.name = "MissingProviderApiKeyError";
  }
}

const SYSTEM_PROMPT = `
You are assisting a hardware engineer investigating a radiated-emissions test failure.

You are given, as structured JSON:
- the measurement that failed: frequency, margin relative to the applicable limit, and operating mode. This is OBSERVED — already established, not something you determine.
- deterministic harmonic-correlation candidates, each already computed as (source frequency) x (integer harmonic number) = (measured frequency). This is a frequency coincidence worth investigating, not a proven cause.
- other known product facts for context.

Propose up to 5 ranked investigation hypotheses, grounded ONLY in the candidates and facts you were given. Rules:
- Every hypothesis's productFactId must exactly match one of the correlationCandidates' productFactId values you were given. Never invent one.
- Your reasoning is an inference, never a certainty claim. Never say a hypothesis is confirmed, proven, verified, or the definitive root cause — you have no access to the physical device, only frequency arithmetic and product context.
- missingEvidence lists what an engineer would need to check to support or rule out the hypothesis.
- recommendedNextStep is a suggestion for a qualified engineer to investigate — never an instruction to certify, ship, or declare compliance.
- Only set clarificationQuestion if one missing fact would materially change the ranking; otherwise it must be null.
- State conclusions and evidence, not your own step-by-step deliberation.
`.trim();

const DEFAULT_MODEL_ID = process.env.CRADO_HYPOTHESIS_MODEL ?? "claude-sonnet-5";

export function createAnthropicHypothesisAdapter(
  modelId: string = DEFAULT_MODEL_ID,
): HypothesisModelAdapter {
  return {
    async generateHypotheses(input) {
      if (!process.env.ANTHROPIC_API_KEY) {
        // Fail clearly and safely rather than let the provider SDK raise a
        // less legible error deep inside generateObject, or — worse —
        // silently proceed with no real model behind it.
        throw new MissingProviderApiKeyError();
      }

      const validatedInput = hypothesisGenerationInputSchema.parse(input);
      const { object } = await generateObject({
        model: anthropic(modelId),
        schema: hypothesisGenerationOutputSchema,
        system: SYSTEM_PROMPT,
        prompt: JSON.stringify(validatedInput),
      });
      // generateObject already validates against the schema, but re-parsing
      // costs nothing and keeps this function's contract self-evident.
      return hypothesisGenerationOutputSchema.parse(object);
    },
  };
}
