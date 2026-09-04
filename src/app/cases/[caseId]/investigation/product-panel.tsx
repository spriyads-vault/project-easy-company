// PRODUCT region: the revision's real ProductFacts, rendered as structured
// engineering rows — never raw jsonb. See src/lib/products/describe-fact.ts
// for the same per-category shape used by the model-facing summary; this is
// the human-facing rendering of that same data.
import Link from "next/link";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import { surface, text } from "./theme";

interface ProductPanelProps {
  productId: string;
  revisionId: string;
  facts: ProductFactRecord[];
}

const CATEGORY_LABEL: Record<ProductFactRecord["category"], string> = {
  clock: "CLOCK",
  radio: "RADIO",
  power: "POWER",
  cable: "CABLE",
  other: "OTHER",
};

function factValue(fact: ProductFactRecord): string {
  switch (fact.category) {
    case "clock":
      return `${fact.fact.frequencyMhz} MHz`;
    case "radio":
      return fact.fact.frequencyMhz
        ? `${fact.fact.technology} · ${fact.fact.frequencyMhz} MHz`
        : fact.fact.technology;
    case "power":
      return fact.fact.switchingFrequencyMhz
        ? `${fact.fact.topology} · ${fact.fact.switchingFrequencyMhz} MHz`
        : fact.fact.topology;
    case "cable":
      return fact.fact.shielded ? "Shielded" : "Unshielded";
    case "other":
      return fact.fact.notes ?? "—";
  }
}

function factLabel(fact: ProductFactRecord): string {
  return fact.fact.label;
}

export function ProductPanel({ productId, revisionId, facts }: ProductPanelProps) {
  return (
    <section aria-labelledby="product-panel-heading" className={`flex flex-col gap-4 p-5 ${surface.panel}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="product-panel-heading" className={text.kicker}>
          Product
        </h2>
        <Link
          href={`/products/${productId}/revisions/${revisionId}`}
          className={`text-xs ${text.muted} hover:text-foreground hover:underline`}
        >
          Edit facts
        </Link>
      </div>

      {facts.length === 0 ? (
        <p className={`text-sm ${text.muted}`}>
          No product facts recorded for this revision yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {facts.map((fact) => (
            <li
              key={fact.id}
              className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-b-0 last:pb-0"
            >
              <span className={`${text.kicker} text-[10px] text-muted-foreground`}>
                {CATEGORY_LABEL[fact.category]}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium">{factLabel(fact)}</span>
                <span className={`text-sm ${text.mono} ${text.muted}`}>
                  {factValue(fact)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
