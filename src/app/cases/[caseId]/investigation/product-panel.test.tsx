import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductFactRecord } from "@/lib/correlation/harmonic-correlation";
import { ProductPanel } from "./product-panel";

const facts: ProductFactRecord[] = [
  {
    id: "fact-clock",
    category: "clock",
    fact: { label: "System clock", frequencyMhz: 40 },
    source: "user_entered",
  },
  {
    id: "fact-radio",
    category: "radio",
    fact: { label: "WiFi radio", technology: "WiFi 2.4GHz", frequencyMhz: 2400 },
    source: "user_entered",
  },
  {
    id: "fact-cable",
    category: "cable",
    fact: { label: "Display ribbon", shielded: false },
    source: "user_entered",
  },
];

describe("ProductPanel", () => {
  it("renders real product facts with clear engineering labels, not raw JSON (loading existing product facts)", () => {
    render(<ProductPanel productId="product-1" revisionId="revision-1" facts={facts} />);

    expect(screen.getByText("System clock")).toBeInTheDocument();
    expect(screen.getByText("40 MHz")).toBeInTheDocument();
    expect(screen.getByText("CLOCK")).toBeInTheDocument();

    expect(screen.getByText("WiFi radio")).toBeInTheDocument();
    expect(screen.getByText("WiFi 2.4GHz · 2400 MHz")).toBeInTheDocument();

    expect(screen.getByText("Display ribbon")).toBeInTheDocument();
    expect(screen.getByText("Unshielded")).toBeInTheDocument();

    // Never dump the raw fact object.
    expect(screen.queryByText(/frequencyMhz/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[{}]/)).not.toBeInTheDocument();
  });

  it("shows an empty state when the revision has no facts yet (missing-data case)", () => {
    render(<ProductPanel productId="product-1" revisionId="revision-1" facts={[]} />);
    expect(
      screen.getByText(/no product facts recorded for this revision yet/i),
    ).toBeInTheDocument();
  });
});
