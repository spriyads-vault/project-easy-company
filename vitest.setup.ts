import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// UX-04: @xyflow/react's <ReactFlow> measures its container with a real
// ResizeObserver, which jsdom does not implement — mounting the
// investigation canvas in a test without this throws
// "ResizeObserver is not defined" before any assertion runs. A no-op
// polyfill is standard practice for testing React Flow (their own docs
// recommend it) and is scoped globally here rather than per-test since
// every test file already gets jsdom from vitest.config.ts.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// vitest.config.ts doesn't set `test.globals: true` (tests import
// describe/it/expect explicitly instead), so Testing Library's automatic
// afterEach(cleanup) — which only registers itself when it finds a global
// `afterEach` — never fires. Without this, DOM from one test in a file
// leaks into the next render() call in the same file. Explicit here so
// every test file gets a clean document.body regardless of how many times
// it calls render().
afterEach(() => {
  cleanup();
});
