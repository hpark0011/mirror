import nextConfig from "@feel-good/eslint-config/next";

export default [
  ...nextConfig,
  {
    // Playwright e2e fixtures use `use()` as a fixture setup callback, not a
    // React hook. The react-hooks plugin matches any identifier starting with
    // `use`, so disable the relevant rule for the e2e directory.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      // Ban `page.waitForTimeout(...)` in e2e — fixed delays are flaky and
      // hide async ordering bugs. Wait on a deterministic signal instead
      // (a `data-*` attribute that flips when work settles, then
      // `waitForSelector`). See `.claude/rules/verification.md` §
      // "Deterministic e2e waits" and `e2e/helpers/wait-for-data-state.ts`.
      // Escape hatch: `// eslint-disable-next-line no-restricted-syntax --
      // <reason>` on the same line.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='waitForTimeout']",
          message:
            "Do not use page.waitForTimeout() in e2e. Wait on a data-attribute signal (see e2e/helpers/wait-for-data-state.ts and .claude/rules/verification.md § Deterministic e2e waits). If a real-world clock dependency truly requires a fixed delay, add `// eslint-disable-next-line no-restricted-syntax -- <reason>`.",
        },
      ],
    },
  },
];
