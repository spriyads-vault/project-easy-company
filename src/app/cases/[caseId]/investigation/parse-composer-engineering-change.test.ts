import { describe, expect, it } from "vitest";
import { parseComposerEngineeringChange } from "./parse-composer-engineering-change";

describe("parseComposerEngineeringChange", () => {
  it("extracts a title with the revision-creation clause stripped, and an explicit revision label (positive case, the ticket's worked example)", () => {
    const result = parseComposerEngineeringChange(
      "Changed the display termination and created Rev18.",
      "Rev17",
    );
    expect(result.title).toBe("Changed the display termination");
    expect(result.description).toBe("Changed the display termination and created Rev18.");
    expect(result.newRevisionLabel).toBe("Rev18");
    expect(result.newRevisionLabelWasExplicit).toBe(true);
  });

  it("suggests the next revision label from the current one when none is named in the text (missing-data case)", () => {
    const result = parseComposerEngineeringChange("Replaced the ferrite on the display cable.", "Rev17");
    expect(result.newRevisionLabel).toBe("Rev18");
    expect(result.newRevisionLabelWasExplicit).toBe(false);
    // No revision-creation clause to strip — the whole sentence is the
    // title, minus its trailing period (a title, not a sentence).
    expect(result.title).toBe("Replaced the ferrite on the display cable");
  });

  it("never rewords the input — description is always the full verbatim text (product-truth guard)", () => {
    const text = "Re-terminated the display connector with a ferrite bead and created Rev19.";
    const result = parseComposerEngineeringChange(text, "Rev18");
    expect(result.description).toBe(text);
  });

  it("caps title at the schema's 200-character limit without inventing an ellipsis-free truncation (boundary case)", () => {
    const longText = `Changed ${"x".repeat(250)}`;
    const result = parseComposerEngineeringChange(longText, "Rev1");
    expect(result.title.length).toBeLessThanOrEqual(200);
    expect(result.title.endsWith("…")).toBe(true);
  });

  it("caps description at the schema's 2000-character limit (boundary case)", () => {
    const longText = "x".repeat(2100);
    const result = parseComposerEngineeringChange(longText, "Rev1");
    expect(result.description.length).toBeLessThanOrEqual(2000);
  });
});
