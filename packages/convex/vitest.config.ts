import { defineConfig } from "vitest/config";

// Vitest configuration for the @feel-good/convex package.
//
// convex-test requires `server.deps.inline` to include "convex-test" so that
// the edge-runtime helper modules resolve correctly under pnpm's isolated
// node_modules layout. See https://github.com/get-convex/convex-test#readme.
export default defineConfig({
  test: {
    environment: "node",
    // Scoped to Vitest-migrated feature modules. Files under
    // convex/users/__tests__/ still import from "bun:test" and are owned by a
    // different agent; add new module globs here as tests migrate to Vitest to
    // avoid breaking CI on out-of-scope files.
    include: [
      "convex/chat/**/*.test.ts",
      "convex/betaAllowlist/**/*.test.ts",
      "convex/waitlistRequests/**/*.test.ts",
    ],
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
    // Keep vi.useFakeTimers() behavior predictable across test files.
    restoreMocks: false,
  },
});
