import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.unit.test.ts"],
    exclude: [
      "e2e/**",
      "node_modules/**",
      // Pre-existing tests that use bun:test API (incompatible with vitest runner)
      "features/clone-settings/__tests__/char-counter-textarea.test.tsx",
      "features/clone-settings/__tests__/clear-all-dialog.test.tsx",
      "features/clone-settings/__tests__/clone-settings-panel.test.tsx",
      "features/clone-settings/__tests__/tone-preset-select.test.tsx",
      "app/[username]/_components/__tests__/mobile-workspace.test.tsx",
    ],
  },
  resolve: {
    alias: [
      {
        find: "@feel-good/convex/chat",
        replacement: path.resolve(
          __dirname,
          "../../packages/convex/convex/chat",
        ),
      },
      {
        find: "@feel-good/convex",
        replacement: path.resolve(__dirname, "../../packages/convex"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname),
      },
    ],
  },
});
