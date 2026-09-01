import { describe, expect, it } from "vitest";
import { suggestNextRevisionLabel } from "./suggest-next-revision-label";

describe("suggestNextRevisionLabel", () => {
  it("increments a trailing integer with no separator (Gateway X's exact case)", () => {
    expect(suggestNextRevisionLabel("Rev17")).toBe("Rev18");
  });

  it("increments a trailing integer with a space separator", () => {
    expect(suggestNextRevisionLabel("Rev 3")).toBe("Rev 4");
  });

  it("preserves zero-padding width", () => {
    expect(suggestNextRevisionLabel("Rev07")).toBe("Rev08");
    expect(suggestNextRevisionLabel("Rev09")).toBe("Rev10");
  });

  it("falls back to a plain suffix when there's no trailing number (boundary case)", () => {
    expect(suggestNextRevisionLabel("Prototype")).toBe("Prototype (new)");
  });
});
