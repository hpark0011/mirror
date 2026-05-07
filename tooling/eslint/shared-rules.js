const sharedRules = {
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "inline-type-imports",
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  // Ban standalone named-specifier `import type { Foo } from "x"` — use the
  // inline form `import { type Foo } from "x"` instead. `consistent-type-imports`
  // above does not enforce this on its own (it accepts both forms). Default
  // (`import type X from`) and namespace (`import type * as X from`) imports
  // are allowed because they have no inline equivalent.
  "no-restricted-syntax": [
    "error",
    {
      selector: "ImportDeclaration[importKind='type'] > ImportSpecifier",
      message:
        "Use inline type imports — `import { type Foo, type Bar } from \"x\"` — not `import type { Foo, Bar } from \"x\"`. Default and namespace type imports are exempt.",
    },
  ],
};

export default sharedRules;
