---
id: FG_070
title: "Clone settings panel consumes Convex via dedicated hook"
date: 2026-04-23
type: refactor
status: completed
priority: p2
description: "apps/mirror/features/clone-settings/components/clone-settings-panel.tsx is the only Mirror feature module that calls useQuery and useMutation directly inside a component, with no hooks/ or context/ directory at all. Extract a useCloneSettings hook that owns the Convex calls, the form submit/clear handlers, and the pendingRef guard, leaving the panel as a pure UI consumer that matches the convention every other feature follows."
dependencies: []
parent_plan_id: workspace/research/convex-nextjs-client-feature-org.md
acceptance_criteria:
  - "apps/mirror/features/clone-settings/hooks/use-clone-settings.ts exists"
  - "grep -E 'useQuery|useMutation' apps/mirror/features/clone-settings/components/clone-settings-panel.tsx returns no matches"
  - "grep -E 'useQuery|useMutation' apps/mirror/features/clone-settings/hooks/use-clone-settings.ts returns at least one match for each"
  - "apps/mirror/features/clone-settings/components/clone-settings-panel.tsx is under 120 lines (verified via wc -l)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
  - "Existing clone-settings tests under apps/mirror/features/clone-settings/__tests__/ all pass via pnpm --filter=@feel-good/mirror test"
owner_agent: "general-purpose"
---

# Clone settings panel consumes Convex via dedicated hook

## Context

`apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` (174 lines) calls `useQuery(api.users.queries.getCurrentProfile)` and `useMutation(api.users.mutations.updatePersonaSettings)` directly in the component body. It also owns the form (`useForm` + `zodResolver`), submit/clear handlers with a `pendingRef` guard, and all the form JSX.

It is the only feature module in `apps/mirror/features/` with no `hooks/` and no `context/` directory at all (verified by listing the feature). Every other feature (articles, posts, chat, profile) routes Convex access through a hook layer. The research report at `workspace/research/convex-nextjs-client-feature-org.md` flagged this as the clearest convention violation in the codebase.

The feature already has a Zod schema co-located correctly at `apps/mirror/features/clone-settings/lib/schemas/clone-settings.schema.ts`, so the schema/hook split is unambiguous.

## Goal

`clone-settings-panel.tsx` becomes a pure UI consumer (form rendering + visual state) and `use-clone-settings.ts` owns Convex access, form lifecycle, and the in-flight guard. The feature module then matches the convention every other feature follows.

## Scope

- Create `apps/mirror/features/clone-settings/hooks/use-clone-settings.ts` exporting a hook that returns the form instance, current profile data, submit handler, clear handler, and pending state.
- Move `useQuery`, `useMutation`, the `useForm` setup, the submit handler, the clear handler, and the `pendingRef` guard out of the panel and into the hook.
- Update the panel to consume the hook and render only.
- No new context — this is a single-component feature; the hook is sufficient.

## Out of Scope

- Changing the form schema at `apps/mirror/features/clone-settings/lib/schemas/clone-settings.schema.ts`.
- Changing the Convex `getCurrentProfile` or `updatePersonaSettings` functions.
- Adding a connector component (`*-connector.tsx`) — the panel is the only component in the feature; a connector layer would be ceremony.
- Changing the panel's rendered output, error states, or copy.

## Approach

Lift everything that isn't JSX out of `clone-settings-panel.tsx` into a new `use-clone-settings.ts`. The hook returns `{ form, profile, isLoading, isPending, handleSubmit, handleClear }`. The panel becomes a thin functional component that calls the hook and renders the form. The existing tests under `apps/mirror/features/clone-settings/__tests__/` are the safety net — they should pass unchanged.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/features/clone-settings/hooks/` directory.
2. Create `apps/mirror/features/clone-settings/hooks/use-clone-settings.ts` and move the `useQuery`, `useMutation`, `useForm`, `pendingRef`, submit handler, and clear handler from the panel into it. Hook returns `{ form, profile, isLoading, isPending, handleSubmit, handleClear }` (or whatever shape the panel needs).
3. Update `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` to call `useCloneSettings()` and pass the values into the existing JSX.
4. Update `apps/mirror/features/clone-settings/index.ts` to re-export the hook if it's part of the feature's public surface.
5. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint && pnpm --filter=@feel-good/mirror test`.

## Constraints

- The panel must not import from `@feel-good/convex` or call any Convex hook directly after the refactor.
- The hook's public return shape should be designed for the single panel consumer — no speculative API surface.
- Existing tests under `apps/mirror/features/clone-settings/__tests__/` must pass without modification (or with only mechanical updates if they tested implementation details that have moved).

## Resources

- Research report (motivation): `workspace/research/convex-nextjs-client-feature-org.md`
- Current implementation: `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` (174 lines)
- Existing schema: `apps/mirror/features/clone-settings/lib/schemas/clone-settings.schema.ts`
- Convention reference: `.claude/rules/file-organization.md`
- Forms convention: `.claude/rules/forms.md`
