---
id: FG_251
title: "Clone agent can open the post editor like the post-list Edit action"
date: 2026-05-18
type: feature
status: completed
priority: p1
description: "The new post-list Edit affordance was a raw Link bypassing useCloneActions with no matching clone tool or dispatcher verb, violating the agent-parity four-step checklist so the clone agent could not perform a UI action the user can."
dependencies: []
acceptance_criteria:
  - "navigateToEditor verb exists on the dispatcher (clone-actions-context.tsx)"
  - "editPost clone tool registered in chat/tools.ts with no userId in inputSchema"
  - "post-list Edit dispatches via useCloneActions (not a bare editor Link)"
  - "use-agent-intent-watcher.ts dispatches on tool-editPost"
  - "verify:codegen and mirror build both pass"
---

# Clone agent can open the post editor like the post-list Edit action

## Context

The post-list Edit action was a plain `<Link>` bypassing `useCloneActions`, with no `editPost`/`navigateToEditor` tool or dispatcher verb — all four agent-parity checklist steps absent. Found in code review (agent-native, confidence 0.92).

## Resolution

Added `editPost` to `buildCloneTools` (slug-only inputSchema, resolved scoped to `profileOwnerId` server-side via the closure — no user identifier in args), a `navigateToEditor` verb on `useCloneActions` (ensures content panel open + push), a `tool-editPost` dispatch branch in `use-agent-intent-watcher.ts`, the `POST_OWNER_WRITE_VOCABULARY` entry in `chat/helpers.ts`, and rewired the `PostListItemActions` Edit to dispatch the verb (keeping an `href` for SEO/middle-click). Verifier APPROVED: `verify:codegen` exit 0, `pnpm --filter=@feel-good/mirror build` exit 0, all four agent-parity steps present. Survived the worktree git-clobber intact.
