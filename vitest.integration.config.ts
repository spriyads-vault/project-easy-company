import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from vitest.config.ts: these tests hit a real local Supabase
// Postgres instance (`supabase start`) to exercise actual RLS policies,
// which a mocked client cannot meaningfully verify.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 20_000,
  },
});
