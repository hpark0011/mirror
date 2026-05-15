---
id: FG_243
title: "Lift TooltipProvider above the post list to avoid per-row Radix contexts"
date: 2026-05-15
type: perf
status: completed
priority: p3
branch: hpark0011/post-edit-delete
verification_tier: 4
description: "The shared Tooltip primitive wraps every <Tooltip> with its own <TooltipProvider>. PostListItemActions renders one Tooltip directly and DeletePostAction renders another, so each owner post row mounts 2 TooltipProviders plus 2 TooltipPrimitive.Portal anchors. For N owner rows, that's 2N providers and 2N portal stubs. Lifting a single provider to the list level (or root shell) collapses this to 1."
dependencies: []
acceptance_criteria:
  - "Either one TooltipProvider mounts at or above ScrollablePostList for the entire post list, OR the packages/ui Tooltip primitive is updated to not wrap each Tooltip in its own provider"
  - "Existing tooltip behavior on hover is unchanged (Chrome MCP screenshot at /@test-user/posts after hovering an action button shows the tooltip)"
  - "pnpm build --filter=@feel-good/mirror passes"
---

# Lift TooltipProvider above the post list to avoid per-row Radix contexts

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The `Tooltip` primitive in `packages/ui/src/primitives/tooltip.tsx` wraps every call in a `<TooltipProvider>`. Per row in the post list, two such providers mount (`apps/mirror/features/posts/components/list/post-list-item-actions.tsx:30-57` for Edit and `apps/mirror/features/posts/components/actions/delete-post-action.tsx:43-58` for Delete). At scale this adds O(N) provider context nodes plus O(N) portal anchors in body.

## Scope

- Wrap `ScrollablePostList` (or a higher app shell) in a single `TooltipProvider`.
- Optionally lift to `apps/mirror/providers/root-provider.tsx`.

## Approach

Add one `<TooltipProvider>` around `ScrollablePostList` (or higher). Radix `TooltipProvider` is reentrant-safe, but reducing the count from 2N to 1 is the goal.

## Implementation Steps

1. Identify the right boundary — `ScrollablePostList` is the smallest scope but the root shell is the cleanest fix.
2. Wrap the chosen scope with `<TooltipProvider>`.
3. Run `pnpm build --filter=@feel-good/mirror` and confirm tooltips still trigger correctly on hover via Chrome MCP at `/@test-user/posts`.
