import { defineConfig } from "vitest/config";

// Vitest configuration for the @feel-good/convex package.
//
// convex-test requires `server.deps.inline` to include "convex-test" so that
// the edge-runtime helper modules resolve correctly under pnpm's isolated
// node_modules layout. See https://github.com/get-convex/convex-test#readme.
export default defineConfig({
  test: {
    environment: "node",
    // Scoped to Vitest-migrated feature modules. Some legacy files under
    // convex/users/__tests__/ still import from "bun:test"; the new vitest
    // tests added during the bio→tagline rename use the standard pattern
    // (`*.vitest.test.ts`) so they're picked up here without colliding with
    // the legacy bun-test files.
    include: [
      "convex/chat/**/*.test.ts",
      "convex/betaAllowlist/**/*.test.ts",
      "convex/waitlistRequests/**/*.test.ts",
      "convex/bio/**/*.test.ts",
      "convex/embeddings/**/*.test.ts",
      "convex/content/**/*.test.ts",
      "convex/articles/**/*.test.ts",
      "convex/posts/**/*.test.ts",
      "convex/users/**/*.vitest.test.ts",
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
