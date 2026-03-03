---
id: FG_042
title: "ProfileShell syncs activeView and conversationId with URL"
date: 2026-03-01
type: feature
status: to-do
priority: p2
description: "Wire ProfileShell's activeView and conversationId state to the URL so that chat conversations are bookmarkable, browser back/forward works naturally, and direct navigation to /@username/chat/[id] loads the correct state. Includes fixing navigation effects to exclude chat routes from article scroll behavior."
dependencies:
  - FG_041
parent_plan_id: docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md
acceptance_criteria:
  - "grep -q 'useRouter\\|usePathname\\|useParams' apps/mirror/app/[username]/_components/profile-shell.tsx confirms routing hooks are imported"
  - "grep -q 'router.push' apps/mirror/app/[username]/_components/profile-shell.tsx confirms URL updates on view transitions"
  - "grep -q 'router.replace' apps/mirror/app/[username]/_components/profile-shell.tsx confirms conversation switches use replace (not push)"
  - "grep -q 'chat' apps/mirror/hooks/use-profile-navigation-effects.ts confirms chat routes are excluded from article scroll logic"
  - "handleBack navigates to /@username (not just state change) — verified by grep for router.push in handleBack"
  - "pnpm build --filter=@feel-good/mirror succeeds without errors"
owner_agent: "React state management and Next.js navigation specialist"
---

# ProfileShell syncs activeView and conversationId with URL

## Context

Currently in `apps/mirror/app/[username]/_components/profile-shell.tsx:72-75`, `activeView` and `conversationId` are pure React state with no URL representation. This means:
- Refreshing the page loses the current chat conversation
- Browser back/forward doesn't work for profile ↔ chat transitions
- Conversations can't be bookmarked or shared

The navigation effects hook (`apps/mirror/hooks/use-profile-navigation-effects.ts:6`) uses a broad regex `^\/@[^/]+\/.+` that would incorrectly match chat routes like `/@username/chat/xxx`, triggering article scroll-to-top behavior on chat navigation.

## Goal

`activeView` and `conversationId` in ProfileShell are derived from the URL on mount, kept in sync bidirectionally, and browser navigation (back/forward/refresh) preserves chat state. Chat routes don't trigger article scroll effects.

## Scope

- Import `usePathname`, `useParams`, `useRouter` in ProfileShell
- Initialize `activeView` and `conversationId` from URL on mount
- Sync URL → state on pathname changes (browser back/forward)
- Update `handleFirstMessage` to use `router.push` (creates history entry)
- Update `handleBack` to use `router.push` to `/@username`
- Update `handleConversationIdChange` (passed to ChatProvider) to use `router.replace`
- Exclude chat routes from `isArticleDetailRoute` in `use-profile-navigation-effects.ts`

## Out of Scope

- Route page files (FG_041)
- Access control / not-found UI for invalid conversation IDs (FG_043)
- Conversation sidebar URL sync
- Server-side rendering of chat state

## Approach

Add Next.js routing hooks to ProfileShell. Derive initial state from the URL pathname and params. Add a `useEffect` on `pathname` to sync URL → state for browser back/forward. Replace the three handlers (`handleFirstMessage`, `handleBack`, conversation ID change) with versions that update both state and URL. Use `router.push` for view transitions (creates history entries) and `router.replace` for conversation switches within chat (no history pollution).

For navigation effects, add a negative lookahead to `isArticleDetailRoute` so `/@username/chat/*` paths are excluded.

- **Effort:** Medium
- **Risk:** Medium — core state management change, must not break existing profile ↔ chat transitions

## Implementation Steps

1. Import `usePathname`, `useParams`, `useRouter` from `next/navigation` in `apps/mirror/app/[username]/_components/profile-shell.tsx`
2. Derive `isChatRoute` from pathname using `/^\/@[^/]+\/chat/.test(pathname)`
3. Initialize `activeView` state from `isChatRoute` and `conversationId` from `params.conversationId`
4. Add `useEffect` on `pathname` to sync URL → state (handles browser back/forward)
5. Update `handleFirstMessage` to call `router.push(\`/@${profile.username}/chat/${result.conversationId}\`)` after setting state
6. Update `handleBack` to call `router.push(\`/@${profile.username}\`)` alongside `setActiveView("profile")`
7. Create `handleConversationIdChange` callback that calls both `setConversationId` and `router.replace`, pass it to ChatProvider's `onConversationIdChange` instead of bare `setConversationId`
8. Update `isArticleDetailRoute` in `apps/mirror/hooks/use-profile-navigation-effects.ts` to exclude chat routes: `&& !/^\/@[^/]+\/chat/.test(path)`
9. Run `pnpm build --filter=@feel-good/mirror` and verify it passes

## Constraints

- `router.push` for entering/exiting chat (history entries), `router.replace` for conversation switches (no history pollution)
- Must not introduce visual regressions — AnimatePresence transitions should still work
- `useEffect` dependency must be `pathname` only (not `params`) to fire on any navigation

## Resources

- Plan: `docs/plans/2026-03-01-feat-chat-deep-link-urls-plan.md` (Phases 3-4)
- ProfileShell: `apps/mirror/app/[username]/_components/profile-shell.tsx`
- Navigation effects: `apps/mirror/hooks/use-profile-navigation-effects.ts`
- ChatProvider: `apps/mirror/features/chat/context/chat-context.tsx`
