import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceGlyph } from "./device-glyph";

describe("DeviceGlyph", () => {
  it("is decorative (aria-hidden, no accessible role) by default, since it never carries a card's primary information", () => {
    const { container } = render(<DeviceGlyph />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("becomes a labeled image only when a real label is explicitly supplied", () => {
    const { container } = render(<DeviceGlyph label="Gateway X" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Gateway X");
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("renders one consistent generic outline regardless of category, since no real device-type data exists to classify from", () => {
    const { container: a } = render(<DeviceGlyph />);
    const { container: b } = render(<DeviceGlyph category="generic" />);
    expect(a.querySelector("svg")!.innerHTML).toBe(b.querySelector("svg")!.innerHTML);
  });

  it("never renders a specific antenna/PCB/sensor claim — only the generic enclosure shape", () => {
    const { container } = render(<DeviceGlyph />);
    const svg = container.querySelector("svg")!;
    // A generic enclosure is one <rect> (the body); nothing here should
    // ever draw a distinct fabricated device-type illustration.
    expect(svg.querySelectorAll("rect")).toHaveLength(1);
  });
});
