import { describe, expect, it } from "vitest";
import { extractOperatingMode } from "./measurement-fields";

// FIX-02 Defect 1: dedicated coverage for extractOperatingMode itself —
// previously only exercised indirectly through its two callers
// (parse-investigation-intake.ts, parse-composer-measurement.ts).
describe("extractOperatingMode", () => {
  it("isolates a connector-introduced clause from a single, undivided sentence (positive case, the ticket's own defect example)", () => {
    expect(
      extractOperatingMode(
        "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above the limit, with Wi-Fi TX and the display active",
      ),
    ).toBe("Wi-Fi TX and display active");
  });

  it("reads a hint-word sentence when the text is genuinely split into more than one sentence (positive case)", () => {
    expect(
      extractOperatingMode(
        "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above limit. WiFi TX and display were active.",
      ),
    ).toBe("WiFi TX and display were active");
  });

  it("never falls back to the whole raw input for an undivided sentence with no connector clause (negative case, FIX-02's own defect)", () => {
    // The bug this ticket fixes: a single sentence containing a hint word
    // ("active") anywhere used to match itself in its entirety. With no
    // "with"/"while"/"during" connector to isolate a clause, the correct
    // result is empty, never the raw sentence.
    expect(
      extractOperatingMode(
        "Gateway X Rev17 failed radiated emissions at 200 MHz, 7.4 dB above the limit and the unit stayed active",
      ),
    ).toBeNull();
  });

  it("returns null, not a fallback string, when no mode clause can be isolated at all (missing-data case)", () => {
    expect(extractOperatingMode("Gateway X Rev17 failed at 200 MHz, 7.4 dB above the limit")).toBeNull();
  });

  it("does not treat an unrelated 'with' clause as the operating mode (boundary case)", () => {
    // "with" introduces something else entirely — no activity/state word
    // follows it, so extracting nothing is correct, not a guess.
    expect(extractOperatingMode("Gateway X Rev17 failed with a 7.4 dB margin above the limit.")).toBeNull();
  });

  it("strips a leading article directly before the state word, matching the field's own article-free convention", () => {
    expect(extractOperatingMode("Rev17 failed at 200 MHz, with the display active.")).toBe("display active");
  });
});
