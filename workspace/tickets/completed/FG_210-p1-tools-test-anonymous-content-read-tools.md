---
id: FG_210
title: "Anonymous viewer is rejected by the two new content read tools"
date: 2026-05-14
type: improvement
status: completed
priority: p1
description: "`tools.test.ts` extends the `inputSchema invariants` block to assert that `applyContentPatch` rejects an anonymous viewer, but the matching anonymous-viewer assertions for `getProfileContentLibrary` and `getProfileContentForEdit` were never added. The `assertOwner` guard on those two read tools is currently untested for the null-viewerId path, violating the `.claude/rules/agent-parity.md` requirement to pin every new tool's owner-check before the PR lands."
dependencies: []
parent_plan_id: workspace/plans/2026-05-14-config-agent-content-authoring-plan.md
acceptance_criteria:
  - "`packages/convex/convex/chat/__tests__/tools.test.ts` `anonymousTools` block contains assertions for both `getProfileContentLibrary.execute` and `getProfileContentForEdit.execute` that reject with `/Only the profile owner/`."
  - "`grep -c 'anonymousTools.getProfileContentLibrary.execute' packages/convex/convex/chat/__tests__/tools.test.ts` returns >= 1."
  - "`grep -c 'anonymousTools.getProfileContentForEdit.execute' packages/convex/convex/chat/__tests__/tools.test.ts` returns >= 1."
  - "`pnpm --filter=@feel-good/convex test` exits 0."
owner_agent: "Convex chat tests writer"
---

# Anonymous viewer is rejected by the two new content read tools

## Context

Code review surfaced this as a P1 convention violation. `.claude/rules/agent-parity.md` states: "Adding a new tool? Add the matching `inputSchema invariants` assertion before the PR lands." The `nonOwnerTools` block at `packages/convex/convex/chat/__tests__/tools.test.ts:1582-1602` correctly covers all three new tools, but the parallel `anonymousTools` block at lines 1604-1628 covers only `applyContentPatch`. The `assertOwner()` guard on the two read tools is therefore unprotected against a regression that flips `viewerId !== profileOwnerId` to `viewerId === undefined`.

## Goal

Both new read tools have explicit anonymous-viewer rejection assertions matching the existing pattern for `applyContentPatch`.

## Scope

- Add two `await expect(anonymousTools.getProfileContentLibrary.execute(...)).rejects.toThrow("Only the profile owner")` assertions.
- Add the equivalent for `anonymousTools.getProfileContentForEdit.execute(...)`.

## Out of Scope

- Adding more inputSchema key assertions (those already exist at lines 1510-1512).
- Adding e2e coverage for anonymous viewer paths.

## Approach

Mirror the existing pattern at lines 1582-1602 for the anonymous block. Both calls take the same `blockedCtx` already established in the test.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open `packages/convex/convex/chat/__tests__/tools.test.ts` at the `anonymousTools` describe block (around line 1604).
2. After the existing `anonymousTools.applyContentPatch.execute(...)` rejection assertion, add a corresponding block for `anonymousTools.getProfileContentLibrary.execute(blockedCtx, {})` expecting `/Only the profile owner/`.
3. Add the same shape for `anonymousTools.getProfileContentForEdit.execute(blockedCtx, { kind: "posts", slug: "any-slug" })`.
4. Verify `runQuery` and `runMutation` mocks are still asserted not to have been called.
5. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Match the existing call shape and error message; do not add new error-text variations.
- Do not change production code — this is test-only.

## Resources

- `.claude/rules/agent-parity.md` § "Cross-user isolation invariant".
- Existing pattern: `packages/convex/convex/chat/__tests__/tools.test.ts:1582-1602`.
