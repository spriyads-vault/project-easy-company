import { describe, expect, it } from "vitest";
import { sanitizeRedirectTarget } from "./redirect";

describe("sanitizeRedirectTarget", () => {
  it("passes through a same-origin path unchanged", () => {
    expect(sanitizeRedirectTarget("/cases/abc-123")).toBe("/cases/abc-123");
    expect(sanitizeRedirectTarget("/investigations/new")).toBe("/investigations/new");
  });

  it("falls back to /investigations when next is absent", () => {
    expect(sanitizeRedirectTarget(null)).toBe("/investigations");
    expect(sanitizeRedirectTarget(undefined)).toBe("/investigations");
    expect(sanitizeRedirectTarget("")).toBe("/investigations");
  });

  it("rejects an absolute external URL", () => {
    expect(sanitizeRedirectTarget("https://evil.example/steal")).toBe("/investigations");
    expect(sanitizeRedirectTarget("http://evil.example")).toBe("/investigations");
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeRedirectTarget("//evil.example")).toBe("/investigations");
  });

  it("rejects the backslash bypass some browsers normalize to a slash", () => {
    expect(sanitizeRedirectTarget("/\\evil.example")).toBe("/investigations");
  });

  it("rejects a path without a leading slash", () => {
    expect(sanitizeRedirectTarget("investigations")).toBe("/investigations");
  });

  it("rejects a scheme embedded after the leading slash", () => {
    expect(sanitizeRedirectTarget("/javascript://evil")).toBe("/investigations");
  });

  it("rejects embedded whitespace/control characters", () => {
    expect(sanitizeRedirectTarget("/cases/1\nX-Injected: true")).toBe("/investigations");
  });

  it("uses a caller-supplied fallback when given one", () => {
    expect(sanitizeRedirectTarget("https://evil.example", "/login")).toBe("/login");
  });
});
