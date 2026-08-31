import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

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
