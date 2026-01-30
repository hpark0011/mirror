import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Prevent non-null assertions (!) which can hide missing env var errors
      // Use explicit validation instead: if (!value) throw new Error(...)
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  }
);
