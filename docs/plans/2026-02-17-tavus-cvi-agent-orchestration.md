---
title: "Agent Orchestration: Tavus CVI Video Calling"
type: orchestration
date: 2026-02-17
source: docs/plans/2026-02-17-feat-tavus-cvi-video-calling-plan.md
scope: large
total_agents: 14
total_phases: 7
---

# Agent Orchestration: Tavus CVI Video Calling

## Overview

Orchestration plan for implementing real-time AI video conversations in the Mirror app. Decomposes the feature plan into 7 phases with 14 agents, pairing each executor with a validation gate.

**Feature summary:** When a reader clicks the "Video" button on a profile page, a full-screen modal opens with a Tavus-powered AI avatar that can discuss the author's articles.

**Target packages:**
- `packages/tavus/` (new shared package)
- `apps/mirror/` (feature module, API route, CSP, profile integration)

---

## Execution Strategy: Checkpoint Team (Large)

- **Team name:** `feat-tavus-cvi`
- **Checkpoint:** User confirmation after Phase 2 and Phase 5
- **Commit gates:** After Phase 2, Phase 5, Phase 7

---

## Phase 1: Foundation — `@feel-good/tavus` Package

**Pattern:** foundation
**Depends on:** Nothing
**Quality gate:** `pnpm build --filter=@feel-good/tavus`
**Commit gate:** No (wait for Phase 2)

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A1: tavus-scaffold | haiku | general-purpose | `packages/tavus/package.json`, `packages/tavus/tsconfig.json`, `packages/tavus/src/types.ts`, `packages/tavus/src/index.ts` | Create package scaffolding. **package.json:** name `@feel-good/tavus`, private, type module, exports: `{ ".": "./src/index.ts", "./client": "./src/client.ts", "./types": "./src/types.ts", "./serialize-articles": "./src/serialize-articles.ts" }`. Follow `packages/utils/package.json` pattern. **tsconfig.json:** extends `@feel-good/tsconfig/base.json` (server-only, no DOM). **types.ts:** `CreateConversationRequest`, `CreateConversationResponse`, `TavusErrorResponse`. **index.ts:** re-export all from types. |
| A2: tavus-client | haiku | general-purpose | `packages/tavus/src/client.ts` | Implement `createConversation(apiKey, request)` and `endConversation(apiKey, id)`. Pure fetch calls to `https://tavusapi.com/v2/conversations`. Error handling with typed responses. See feature plan lines 123-173 for exact implementation. |
| A3: tavus-serializer | haiku | general-purpose | `packages/tavus/src/serialize-articles.ts` | Implement `serializeArticlesToContext(articles)`. Recursively walks `JSONContent` tree producing Markdown-like text. Reference: `packages/features/editor/lib/get-plain-text.ts` for the traversal pattern. Headings → `## Title`, Bold → `**text**`, Lists → `- item`. Truncate at `MAX_CONTEXT_LENGTH = 8000`. Add `@tiptap/core` as devDependency for `JSONContent` type. |

**Validator:** sonnet Explore agent reviews all 5 files for type safety, export completeness, and convention adherence.

**Sequencing:** `A1 → [A2 ∥ A3]` (A1 first for package scaffolding, then A2/A3 parallel)

---

## Phase 2: Config — CSP, Dependencies, Environment

**Pattern:** foundation (config)
**Depends on:** Phase 1
**Quality gate:** `pnpm install && pnpm build --filter=@feel-good/mirror`
**Commit gate:** Yes — commit after this phase passes

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A4: mirror-config | haiku | general-purpose | `apps/mirror/next.config.ts`, `apps/mirror/package.json`, `apps/mirror/.env.local.example` | **next.config.ts** (line 4-12, 39-41): (1) `connect-src` — append `https://*.daily.co wss://*.daily.co https://tavusapi.com`. (2) Add directive `"frame-src https://*.daily.co"`. (3) Add directive `"media-src 'self' https://*.daily.co blob:"`. (4) `Permissions-Policy` header — change `camera=(), microphone=()` to `camera=(self), microphone=(self)`. **package.json** deps: add `"@daily-co/daily-js": "^0.74.0"`, `"@daily-co/daily-react": "^0.25.0"`, `"@feel-good/tavus": "workspace:*"`, `"server-only": "^0.0.1"`. **.env.local.example**: append `TAVUS_API_KEY=your-tavus-api-key` and `TAVUS_PERSONA_ID=pdced222244b`. Then run `pnpm install` from monorepo root. |

**Validator:** sonnet Explore agent verifies CSP directive syntax, Permissions-Policy format, package.json validity, and that `pnpm install` resolves correctly.

**Sequencing:** A4 (single agent)

### Checkpoint: User Confirmation

> Phases 1-2 complete. Package created, dependencies installed, CSP updated. Continue?

---

## Phase 3: Backend — API Route

**Pattern:** backend
**Depends on:** Phase 1, Phase 2
**Quality gate:** `pnpm build --filter=@feel-good/mirror`
**Commit gate:** No (wait for Phase 5)

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A5: api-route | haiku | general-purpose | `apps/mirror/app/api/tavus/conversations/route.ts` | Create POST handler. Read `TAVUS_API_KEY` and `TAVUS_PERSONA_ID` from `process.env`. Accept `{ articles }` body. Call `serializeArticlesToContext()` from `@feel-good/tavus/serialize-articles`. Call `createConversation()` from `@feel-good/tavus/client`. Return `{ conversation_url, conversation_id }`. Set `max_duration: 600`. Follow existing API route pattern from `app/api/auth/[...all]/route.ts`. Import `"server-only"` at top to prevent client bundling. |

**Validator:** sonnet Explore agent verifies imports resolve, server-only guard present, env vars used correctly.

**Sequencing:** A5 (single agent)

> **Note:** Phase 3 and Phase 4 can run in parallel — they touch entirely different files.

---

## Phase 4: CVI Scaffold — Component Scaffolding

**Pattern:** foundation (CLI)
**Depends on:** Phase 2
**Quality gate:** `pnpm build --filter=@feel-good/mirror`
**Commit gate:** No (wait for Phase 5)

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A6: cvi-scaffold | haiku | general-purpose | `apps/mirror/features/video-call/components/cvi/cvi-provider.tsx`, `apps/mirror/features/video-call/components/cvi/conversation.tsx` | From `apps/mirror/`, run `npx @tavus/cvi-ui@latest init` then `npx @tavus/cvi-ui@latest add conversation`. Expected output: files in `components/cvi/components/`. Move to `features/video-call/components/cvi/`. Delete empty `components/cvi/`. Ensure `"use client"` directive present in both files. Fix import paths if needed. **Fallback:** If CLI fails in monorepo, manually create `cvi-provider.tsx` (wraps `DailyProvider` from `@daily-co/daily-react`) and `conversation.tsx` (joins Daily room by URL, renders video elements) based on Tavus docs patterns. |

**Validator:** sonnet Explore agent verifies files exist, have `"use client"`, imports resolve to installed packages.

**Sequencing:** A6 (single agent)

---

## Phase 5: Logic Layer — Hooks, Context, Feature Types

**Pattern:** logic-layer
**Depends on:** Phase 3, Phase 4
**Quality gate:** `pnpm build --filter=@feel-good/mirror`
**Commit gate:** Yes — commit after this phase passes

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A7: call-state | haiku | general-purpose | `apps/mirror/features/video-call/types.ts`, `apps/mirror/features/video-call/hooks/use-call-state.ts` | **types.ts:** Define `CallState` discriminated union: `idle \| creating \| connecting \| connected \| error \| ended`. Each variant carries relevant data (e.g., `connecting` has `conversationUrl`, `error` has `message`). **use-call-state.ts:** `useReducer`-based hook with typed actions (`start`, `connect`, `connected`, `error`, `end`, `reset`). Follow hook patterns from `features/articles/hooks/`. |
| A8: video-call-hook | haiku | general-purpose | `apps/mirror/features/video-call/hooks/use-video-call.ts` | `useVideoCall()` orchestrates full lifecycle. Uses `useCallState()` internally. `startCall(articles)`: guard against double-submission (ref-based, matching auth hook pattern), POST to `/api/tavus/conversations`, transition states. `endCall()`: leave Daily room, cleanup. `resetCall()`: return to idle. `useEffect` cleanup on unmount. `beforeunload` listener when connected. |
| A9: context-and-barrel | haiku | general-purpose | `apps/mirror/features/video-call/context/video-call-context.tsx`, `apps/mirror/features/video-call/index.ts` | **video-call-context.tsx:** Create context providing call state and actions. Follow `features/profile/context/profile-context.tsx` pattern. Export `VideoCallProvider` and `useVideoCall` consumer hook. **index.ts:** Barrel export: `VideoCallModal` (from components), `VideoCallProvider`, `useVideoCall` (from context), `CallState` type. |

**Validator:** sonnet Explore agent reviews hook logic, context typing, barrel completeness, import paths.

**Sequencing:** `A7 → A8 → A9` (sequential — each depends on the previous)

### Checkpoint: User Confirmation

> Phases 3-5 complete. API route, CVI scaffold, hooks, and context ready. Continue to UI?

---

## Phase 6: UI Components — Video Call Interface

**Pattern:** ui-components
**Depends on:** Phase 5
**Quality gate:** `pnpm build --filter=@feel-good/mirror`
**Commit gate:** No (wait for Phase 7)

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A10: video-ui | haiku | general-purpose | `apps/mirror/features/video-call/components/video-call-view.tsx`, `apps/mirror/features/video-call/components/call-controls.tsx`, `apps/mirror/features/video-call/components/connection-status.tsx` | **video-call-view.tsx:** Full-viewport layout. Remote video (avatar) fills screen. Local video as PiP overlay (bottom-left, 160x120). CallControls floating bar (bottom-center). ConnectionStatus overlay (center). Uses Daily.co React hooks for video streams. **call-controls.tsx:** Three buttons — mic toggle (`useLocalMicrophone()`), camera toggle (`useLocalCamera()`), end call (red, calls `endCall()`). Icons change based on muted/unmuted state. Use Lucide icons (already installed). **connection-status.tsx:** Renders based on `CallState.status`. "Connecting..." with spinner, error with retry button, "Call ended" with close button. All `"use client"`. |
| A11: video-modal | haiku | general-purpose | `apps/mirror/features/video-call/components/video-call-modal.tsx` | Full-screen portal overlay. `"use client"`. Uses `framer-motion` `AnimatePresence` + `motion.div` for fade in/out (framer-motion already installed). Wraps children in `CVIProvider` from `./cvi/cvi-provider`. Contains `VideoCallView`. Receives props: `articles: Article[]`, `onClose: () => void`. Close via X button or Escape key. Handles calling `startCall(articles)` on mount. Component tree: `CVIProvider → VideoCallView`. |

**Validator:** sonnet Explore agent reviews component composition, `"use client"` directives, Daily.co hook usage, framer-motion patterns.

**Sequencing:** `[A10 ∥ A11]` (parallel — different files)

---

## Phase 7: Integration — Profile Wiring

**Pattern:** composition + integration
**Depends on:** Phase 6
**Quality gate:** `pnpm build` (full monorepo build)
**Commit gate:** Yes — final commit

### Agents

| Agent | Model | Type | Files | Description |
|-------|-------|------|-------|-------------|
| A12: profile-actions | haiku | general-purpose | `apps/mirror/features/profile/components/profile-actions.tsx`, `apps/mirror/app/layout.tsx` | **profile-actions.tsx:** Add `onVideoClick?: () => void` prop. Update `PROFILE_ACTIONS` array type to include optional `onClick`. Wire Video button's `ShinyButton` `onClick` to `onVideoClick`. Text/Voice buttons: show "Coming soon" toast via `import { toast } from "sonner"`. **layout.tsx:** Add `<Toaster />` from `@feel-good/ui/primitives/sonner` inside the `<body>` tag (required for toast notifications — not currently present in Mirror). |
| A13: profile-shell | haiku | general-purpose | `apps/mirror/app/[username]/_components/profile-shell.tsx`, `apps/mirror/features/profile/views/profile-info-view.tsx` | **profile-shell.tsx:** Add `const [videoCallOpen, setVideoCallOpen] = useState(false)`. Add `const VideoCallModal = dynamic(() => import("@/features/video-call").then(m => m.VideoCallModal), { ssr: false })`. Render `{videoCallOpen && <VideoCallModal articles={articles} onClose={() => setVideoCallOpen(false)} />}` at the end of the return, outside the mobile/desktop conditional. Pass `onVideoClick={() => setVideoCallOpen(true)}` through `ProfileInfoView`. **profile-info-view.tsx:** Add `onVideoClick?: () => void` to `ProfileInfoViewProps`. Pass through to `<ProfileActions onVideoClick={onVideoClick} />`. |

**Validator:** sonnet Explore agent reviews prop threading chain (`ProfileShell → ProfileInfoView → ProfileActions`), dynamic import correctness, Toaster placement, and that the full build passes.

**Sequencing:** `A12 → A13` (sequential — A13 depends on A12's prop changes)

---

## Validation Protocol

Each phase follows this pattern:

```
1. Announce phase
2. Spawn executor agent(s) — haiku, general-purpose, bypassPermissions
3. Spawn validator agent — sonnet, Explore (read-only)
4. If REJECTED → retry executor with feedback (max 2 retries)
5. Run quality gate via Bash
6. If gate fails → spawn fix agent (max 1 retry), then ask user
7. Report result
```

### Quality Gate Commands

| Phase | Command |
|-------|---------|
| 1 | `cd /Users/disquiet/Desktop/feel-good && pnpm build --filter=@feel-good/tavus` |
| 2 | `cd /Users/disquiet/Desktop/feel-good && pnpm install && pnpm build --filter=@feel-good/mirror` |
| 3 | `cd /Users/disquiet/Desktop/feel-good && pnpm build --filter=@feel-good/mirror` |
| 4 | `cd /Users/disquiet/Desktop/feel-good && pnpm build --filter=@feel-good/mirror` |
| 5 | `cd /Users/disquiet/Desktop/feel-good && pnpm build --filter=@feel-good/mirror` |
| 6 | `cd /Users/disquiet/Desktop/feel-good && pnpm build --filter=@feel-good/mirror` |
| 7 | `cd /Users/disquiet/Desktop/feel-good && pnpm build` |

### Commit Gates

| After Phase | Commit Message |
|-------------|----------------|
| 2 | `feat(tavus): add @feel-good/tavus package and mirror config` |
| 5 | `feat(mirror): add video call feature module (hooks, context, CVI scaffold)` |
| 7 | `feat(mirror): integrate video call with profile page` |

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Validator rejects | Retry executor with feedback (max 2) |
| Quality gate fails | Spawn fix agent (max 1), then ask user |
| `npx @tavus/cvi-ui` fails in monorepo | A6 falls back to manual component creation |
| Agent timeout/crash | Retry that specific agent |
| Persistent failure | Stop, report partial progress, ask user |

---

## Dependency Graph

```
Phase 1 (foundation)
  ├── A1 → A2 (parallel with A3)
  └── A1 → A3 (parallel with A2)
        │
        v
Phase 2 (config) ── A4
        │
   ┌────┴────┐
   v         v
Phase 3    Phase 4     ← can run in parallel
(backend)  (scaffold)
 A5         A6
   └────┬────┘
        v
Phase 5 (logic)
  A7 → A8 → A9
        │
        v
Phase 6 (ui)
  A10 ∥ A11
        │
        v
Phase 7 (integration)
  A12 → A13
```

---

## Reference Files for Agents

### Patterns to Follow

| Pattern | Reference File |
|---------|---------------|
| Package exports | `packages/utils/package.json` |
| tsconfig (server) | `packages/convex/tsconfig.json` |
| Feature barrel export | `apps/mirror/features/profile/index.ts` |
| Feature context | `apps/mirror/features/profile/context/profile-context.tsx` |
| JSONContent traversal | `packages/features/editor/lib/get-plain-text.ts` |
| next/dynamic lazy load | `apps/mirror/features/articles/views/article-detail-view.tsx` |
| API route handler | `apps/mirror/app/api/auth/[...all]/route.ts` |
| Framer-motion animation | `apps/mirror/features/articles/components/animated-article-row.tsx` |
| ShinyButton usage | `apps/mirror/features/profile/components/profile-actions.tsx` |

### Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `apps/mirror/next.config.ts` | 2 | CSP + Permissions-Policy |
| `apps/mirror/package.json` | 2 | Dependencies |
| `apps/mirror/.env.local.example` | 2 | Env vars |
| `apps/mirror/app/layout.tsx` | 7 | Add Toaster |
| `apps/mirror/features/profile/components/profile-actions.tsx` | 7 | onVideoClick prop |
| `apps/mirror/features/profile/views/profile-info-view.tsx` | 7 | Thread onVideoClick |
| `apps/mirror/app/[username]/_components/profile-shell.tsx` | 7 | videoCallOpen state + modal |

### Files to Create

| File | Phase |
|------|-------|
| `packages/tavus/package.json` | 1 |
| `packages/tavus/tsconfig.json` | 1 |
| `packages/tavus/src/index.ts` | 1 |
| `packages/tavus/src/types.ts` | 1 |
| `packages/tavus/src/client.ts` | 1 |
| `packages/tavus/src/serialize-articles.ts` | 1 |
| `apps/mirror/app/api/tavus/conversations/route.ts` | 3 |
| `apps/mirror/features/video-call/components/cvi/cvi-provider.tsx` | 4 |
| `apps/mirror/features/video-call/components/cvi/conversation.tsx` | 4 |
| `apps/mirror/features/video-call/types.ts` | 5 |
| `apps/mirror/features/video-call/hooks/use-call-state.ts` | 5 |
| `apps/mirror/features/video-call/hooks/use-video-call.ts` | 5 |
| `apps/mirror/features/video-call/context/video-call-context.tsx` | 5 |
| `apps/mirror/features/video-call/index.ts` | 5 |
| `apps/mirror/features/video-call/components/video-call-view.tsx` | 6 |
| `apps/mirror/features/video-call/components/call-controls.tsx` | 6 |
| `apps/mirror/features/video-call/components/connection-status.tsx` | 6 |
| `apps/mirror/features/video-call/components/video-call-modal.tsx` | 6 |

---

## Summary

| Metric | Value |
|--------|-------|
| Total phases | 7 |
| Total executor agents | 14 |
| Parallel opportunities | Phase 3∥4, A2∥A3, A10∥A11 |
| User checkpoints | After Phase 2, After Phase 5 |
| Commit gates | 3 (after Phase 2, 5, 7) |
| Quality gates | 7 (one per phase) |
| New files | 18 |
| Modified files | 7 |
| Estimated agent models | 14 haiku (executors) + 7 sonnet (validators) |
