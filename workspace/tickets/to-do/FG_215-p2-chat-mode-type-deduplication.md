---
id: FG_215
title: "ChatMode and DEFAULT_CHAT_MODE share a single source of truth"
date: 2026-05-13
type: refactor
status: to-do
priority: p2
description: "ChatMode, DEFAULT_CHAT_MODE, and the enum tuple (CHAT_MODES vs CHAT_MODE_VALUES) are defined twice — once in apps/mirror/features/chat/types.ts and once in packages/convex/convex/chat/mode.ts — with no enforced linkage. A future addition (a third mode) silently diverges between frontend and backend."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "Either the frontend imports ChatMode and DEFAULT_CHAT_MODE from the convex package (preferred), or both files derive from a shared @feel-good/* package"
  - "Adding a third mode literal in one place produces a TypeScript error in the other until both are updated"
  - "CHAT_MODES (unused enum tuple in types.ts) and CHAT_MODE_VALUES (unused enum tuple in mode.ts) are removed unless one of them gains a runtime caller — keep only the one that is actually imported"
  - "pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/convex build all pass"
owner_agent: "TypeScript refactor engineer"
---

# ChatMode and DEFAULT_CHAT_MODE share a single source of truth

## Context

The maintainability reviewer flagged that `apps/mirror/features/chat/types.ts:3-5` introduces:

```ts
export const CHAT_MODES = ["clone", "configuration"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];
export const DEFAULT_CHAT_MODE: ChatMode = "clone";
```

And `packages/convex/convex/chat/mode.ts:3-12` has the identical structure:

```ts
export const CHAT_MODE_VALUES = ["clone", "configuration"] as const;
export const chatModeValidator = v.union(v.literal("clone"), v.literal("configuration"));
export type ChatMode = Infer<typeof chatModeValidator>;
export const DEFAULT_CHAT_MODE: ChatMode = "clone";
```

Both define a literal-string union and a default. Neither file imports the other. TypeScript will not catch a divergence: if the convex package adds `"draft"` to `chatModeValidator` and `CHAT_MODE_VALUES`, the mirror app's `ChatMode` and `CHAT_MODES` will silently remain `"clone" | "configuration"` until someone notices runtime drift.

Additionally:
- `CHAT_MODES` in types.ts is exported but never imported (verify via grep).
- `CHAT_MODE_VALUES` in mode.ts is exported but never imported (verify via grep).

## Goal

There is one canonical declaration of the `ChatMode` literal union and `DEFAULT_CHAT_MODE` value, and any addition to it propagates to every consumer via TypeScript.

## Scope

- `apps/mirror/features/chat/types.ts` — replace local declarations with re-exports from the convex package.
- `apps/mirror/features/chat/index.ts` — already re-exports the type; confirm path still resolves.
- `packages/convex/convex/chat/mode.ts` — remains the source of truth.
- Delete unused tuples (`CHAT_MODES` or `CHAT_MODE_VALUES`) where they have zero importers.

## Out of Scope

- Renaming `ChatMode` or `DEFAULT_CHAT_MODE`.
- Adding a third mode (requires its own PR/spec).

## Approach

Two viable shapes:

1. **Frontend imports from convex package directly.** Change `apps/mirror/features/chat/types.ts` to:
   ```ts
   export {
     type ChatMode,
     DEFAULT_CHAT_MODE,
   } from "@feel-good/convex/convex/chat/mode";
   ```
   This is the simplest and matches how the rest of the mirror app already imports from `@feel-good/convex`.

2. **Both packages depend on a third package.** Move the declaration to `@feel-good/types` or similar. Higher overhead; only justified if the convex package's `convex/values` import causes a build-time issue for the mirror app (it shouldn't — types are erased).

Option 1 is the recommended approach.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Verify the convex package's `exports` map includes `./convex/chat/mode` (check `packages/convex/package.json`). If not, add it.
2. Update `apps/mirror/features/chat/types.ts` to re-export `ChatMode` and `DEFAULT_CHAT_MODE` from the convex package; delete the local literal declarations.
3. grep for `CHAT_MODES` in the apps/mirror tree — if zero non-types.ts hits, delete the export. Same for `CHAT_MODE_VALUES` in the convex package.
4. Run `pnpm --filter=@feel-good/mirror build` to confirm TypeScript resolves the imports.
5. Run `pnpm --filter=@feel-good/mirror lint` to confirm no unused-export warnings remain.
6. Quick smoke test via `pnpm dev:safe` and exercise the configuration chat flow.

## Constraints

- Must not change the type's structural shape (still `"clone" | "configuration"`).
- Must not introduce a runtime dependency from the mirror app on convex package internals beyond what already exists (the app already imports `Id<>`, `api`, etc. from the convex package).

## Resources

- PR #93 maintainability review: `chat-mode-type-duplicated`
- `packages/convex/package.json` — exports map convention
- `.claude/rules/typescript.md` — inline type imports
