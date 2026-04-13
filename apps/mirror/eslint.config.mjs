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
    },
  },
];
