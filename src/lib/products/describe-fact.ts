import type { ProductFactCategory } from "@/lib/domain/schema";

export interface DescribableProductFact {
  category: ProductFactCategory;
  fact: Record<string, unknown>;
}

/**
 * One-line human-readable summary of a product fact, e.g. "system clock —
 * 40 MHz". Shared between the revision page (MVP-04) and the hypothesis
 * service's model-facing context (MVP-08) — the same summary an engineer
 * reads is what the model reads, never raw jsonb.
 */
export function describeProductFact(row: DescribableProductFact): string {
  const fact = row.fact;
  switch (row.category) {
    case "clock":
      return `${fact.label} — ${fact.frequencyMhz} MHz`;
    case "radio":
      return `${fact.label} — ${fact.technology}${
        fact.frequencyMhz ? ` (${fact.frequencyMhz} MHz)` : ""
      }`;
    case "power":
      return `${fact.label} — ${fact.topology}${
        fact.switchingFrequencyMhz
          ? ` (${fact.switchingFrequencyMhz} MHz switching)`
          : ""
      }`;
    case "cable":
      return `${fact.label} — ${fact.shielded ? "shielded" : "unshielded"}`;
    case "other":
      return `${fact.label}${fact.notes ? ` — ${fact.notes}` : ""}`;
    default:
      return String(fact.label ?? "");
  }
}
