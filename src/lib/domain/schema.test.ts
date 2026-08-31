import { describe, expect, it } from "vitest";
import { productFactInputSchema } from "./schema";

describe("productFactInputSchema", () => {
  it("accepts a valid clock fact", () => {
    const result = productFactInputSchema.safeParse({
      category: "clock",
      fact: { label: "system clock", frequencyMhz: 40 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a clock fact missing frequencyMhz", () => {
    const result = productFactInputSchema.safeParse({
      category: "clock",
      fact: { label: "system clock" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a clock fact with a non-positive frequency (boundary)", () => {
    const result = productFactInputSchema.safeParse({
      category: "clock",
      fact: { label: "system clock", frequencyMhz: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects fields belonging to a different category (discriminated shape)", () => {
    // shielded belongs to "cable", not "clock" — the clock shape must not
    // silently accept it in place of frequencyMhz.
    const result = productFactInputSchema.safeParse({
      category: "clock",
      fact: { label: "system clock", shielded: true },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid cable fact", () => {
    const result = productFactInputSchema.safeParse({
      category: "cable",
      fact: { label: "display ribbon cable", shielded: false },
    });
    expect(result.success).toBe(true);
  });

  it("defaults source to user_entered when omitted", () => {
    const result = productFactInputSchema.parse({
      category: "power",
      fact: { label: "5V rail", topology: "switching regulator" },
    });
    expect(result.source).toBe("user_entered");
  });
});
