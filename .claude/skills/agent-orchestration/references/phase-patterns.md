# Phase Patterns

Reusable phase templates the orchestrator selects from when decomposing a requirement. Each pattern describes what it builds, typical agents, and which quality gate to run.

## foundation

Sets up types, schemas, package exports, and directory structure.

**Typical agents:**
- `types-agent` — create type definitions
- `schema-agent` — create Zod validation schemas
- `package-setup-agent` — add exports to package.json, create barrel files

**Quality gate:** `type-check`

**Output:** Types, schemas, barrel exports — everything downstream phases import from.

**Key rules:**
- Always create barrel index.ts files in every new directory
- Add all planned export paths to package.json upfront (with placeholder files if needed)
- Use existing type patterns in the target package as reference

---

## logic-layer

Creates hooks, providers, context, and business logic.

**Typical agents:**
- `provider-agent` — context providers with "use client"
- `hook-agent` (one per hook) — custom hooks consuming providers
- `util-agent` — pure utility functions

**Quality gate:** `type-check-and-lint`

**Output:** Hooks and providers that components will consume.

**Key rules:**
- Every client-side file needs "use client" directive
- Hooks should import from the foundation phase's barrel exports
- Use `useCallback` and `useMemo` for stable references
- Destructure options at hook level (not inside callbacks)

---

## ui-components

Creates visual primitives — individual building blocks.

**Typical agents:**
- `component-agent` (one per component) — individual UI components

**Quality gate:** `type-check`

**Output:** Presentational components that blocks will compose.

**Key rules:**
- "use client" directive for interactive components
- Use `data-slot` attributes for styling hooks
- Follow existing component patterns in the target package
- Update the components barrel export (index.ts)

---

## composition

Assembles primitives into blocks or page-level compositions.

**Typical agents:**
- `block-agent` — composes components + hooks into drop-in sections
- `page-agent` — wires blocks into page layouts

**Quality gate:** `type-check-and-lint`

**Output:** Ready-to-use blocks or pages.

**Key rules:**
- Blocks wrap providers around internal content components
- Update blocks barrel export and main feature barrel export
- Blocks should accept config/callback props, not raw state

---

## integration

Final wiring — cross-package imports, documentation, export verification.

**Typical agents:**
- `integration-agent` — verify exports, update docs, test imports

**Quality gate:** `full-build` or `app-compile`

**Output:** Verified, importable feature with documentation.

**Key rules:**
- Verify every export path actually resolves
- Test import from at least one consuming app
- Update CLAUDE.md or README if the feature introduces new patterns

---

## backend

Convex functions, server actions, API routes.

**Typical agents:**
- `convex-agent` — Convex mutations, queries, actions
- `server-action-agent` — Next.js server actions
- `api-route-agent` — API route handlers

**Quality gate:** `type-check` (then `full-build` if touching Convex)

**Output:** Backend functions the logic-layer or UI can call.

**Key rules:**
- Convex functions go in `packages/convex/`
- Server actions go in the app's `_lib/server/` directory
- Always validate inputs with Zod schemas from the foundation phase

---

## Phase Ordering

Typical ordering for a new feature:

```
1. foundation     — types, schemas, exports
2. backend        — server functions (if needed)
3. logic-layer    — hooks, providers
4. ui-components  — visual primitives
5. composition    — blocks, pages
6. integration    — final verification
```

Not all features need all phases. The planner selects only the relevant ones. A simple UI-only feature might only need: foundation → ui-components → composition → integration.
