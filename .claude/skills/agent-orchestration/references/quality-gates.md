# Quality Gates

Gate definitions and commands for each gate type. The orchestrator runs these between phases.

## Gate Types

### type-check

Verifies TypeScript compilation without emitting output.

```bash
pnpm check-types --filter=<package>
```

**When to use:** After any phase that creates or modifies `.ts`/`.tsx` files.

**Common failures:**
- Missing imports → agent forgot a dependency
- Type mismatch → agent used wrong interface
- Missing exports → barrel file not updated

### lint

Runs ESLint on the target package.

```bash
pnpm lint --filter=<package>
```

**When to use:** After phases that create components, hooks, or logic files.

**Common failures:**
- Unused imports → agent imported something it didn't use
- Missing "use client" → client component without directive
- Naming conventions → file or export doesn't match conventions

### type-check-and-lint

Combined gate for phases with both structural and style requirements.

```bash
pnpm lint --filter=<package> && pnpm check-types --filter=<package>
```

**When to use:** After logic-layer or composition phases.

### full-build

Full build verification across the monorepo or a specific app.

```bash
pnpm build --filter=<package>
```

**When to use:** Final integration phase only. Expensive — use sparingly.

### app-compile

Verifies an app can compile with the new package exports.

```bash
cd <app-dir> && pnpm exec tsc --noEmit
```

**When to use:** Integration phase when verifying cross-package imports work.

## Gate Resolution

| Result | Action |
|--------|--------|
| Pass | Continue to next phase |
| Fail (first time) | Report error, retry executor with error context |
| Fail (second time) | Report to user: fix / skip / stop |

## Package Name Resolution

The orchestrator determines the `<package>` filter from the target directory:

| Target directory | Filter |
|-----------------|--------|
| `packages/features/` | `@feel-good/features` |
| `packages/ui/` | `@feel-good/ui` |
| `packages/utils/` | `@feel-good/utils` |
| `packages/icons/` | `@feel-good/icons` |
| `packages/convex/` | `@feel-good/convex` |
| `apps/greyboard/` | `@feel-good/greyboard` |
| `apps/mirror/` | `@feel-good/mirror` |
| `apps/ui-factory/` | `@feel-good/ui-factory` |
