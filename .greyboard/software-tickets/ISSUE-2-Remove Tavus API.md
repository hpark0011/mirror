---
version: 1
id: ISSUE-2
title: Remove Tavus API
status: done
priority: none
assignee: Claude
agentExecution:
  selection:
    providerId: claude
    modelId: opus
  reasoningEffort: xhigh
sortOrder: 65533
labels: []
blockedBy: []
parentId: null
projectId: PROJECT-1
worktree:
  enabled: true
  baseRef: main
createdBy: user
updatedBy: user
createdAt: 2026-08-03T04:05:57.574Z
updatedAt: 2026-08-03T05:52:52.195Z
completedAt: 2026-08-03T05:52:52.195Z
---

# Remove Tavus API — Removal Plan

Remove **all** Tavus code from the monorepo: the `@feel-good/tavus` package, the
Mirror video-call feature (Tavus CVI), its API routes, env/config wiring, the
now-dead Convex query, scripts, docs/comments, and skills.

## Background: what Tavus is in this repo

Tavus CVI (Conversational Video Interface) powers the **"Video" call** button on a
profile. The flow: profile "Video" action → `VideoCallModal` → `POST /api/tavus/conversations`
(builds conversational context from the author's articles, calls the Tavus API) →
Daily.co WebRTC renders the avatar video. Daily.co (`@daily-co/*`) is used **only**
by this feature, so it is removed too.

**No clone-agent tool exists for video calling** (verified — video is a UI-only
modal, never a clone action), so there is no agent-parity surface to remove.

## Complete inventory (verified via grep sweep)

Every non-`.next`, non-lockfile file containing `tavus`/`daily`/`cvi`/`video-call`:

| Category | Path |
|---|---|
| Package | `packages/tavus/**` (package.json, tsconfig.json, src/{client,index,serialize-articles,types}.ts) |
| API routes | `apps/mirror/app/api/tavus/**` (2 route.ts files) |
| Feature | `apps/mirror/features/video-call/**` (11 files) |
| E2E | `apps/mirror/e2e/video-call.spec.ts` |
| Profile wiring | `app/[username]/_providers/profile-route-data-context.tsx`, `app/[username]/_components/profile-panel.tsx`, `features/profile/components/profile-info.tsx`, `features/profile/components/editable-profile-actions.tsx` |
| Unit test | `app/[username]/_providers/__tests__/clone-actions-context.test.tsx` |
| Env/config | `lib/env/server.ts`, `lib/env/index.ts`, `next.config.ts`, `.env.local.example`, `turbo.json`, `apps/mirror/package.json` |
| Convex (dead after routes go) | `packages/convex/convex/articles/queries.ts`, `articles/helpers.ts`, `articles/__tests__/queries.test.ts` |
| Scripts | `scripts/restore-env-local.sh`, `scripts/sync-worktree-convex-env.sh` |
| Docs/rules | `apps/mirror/AGENTS.md`, `.claude/rules/worktrees.md`, `.agents/rules/worktrees.md`, `.claude/skills/create-skill/SKILL.md`, `.agents/skills/create-skill/SKILL.md`, `.claude/skills/create-codebase-expert/SKILL.md`, `.agents/skills/create-codebase-expert/SKILL.md` |
| Skills (delete) | `.claude/skills/tavus-cvi-quickstart/`, `.claude/skills/tavus-cvi-ui/`, `.agents/skills/tavus-cvi-quickstart/`, `.agents/skills/tavus-cvi-ui/` |
| Historical artifacts (see Decisions) | `workspace/tickets/canceled/FG_012-*`, `FG_046-*`, `FG_048-*`, `workspace/tickets/completed/FG_170-*`, `.greyboard/task-worktree-runs/ISSUE-1.json` |

---

## Phase 1 — Delete whole units

Files/dirs that are 100% Tavus — delete outright:

- [ ] `rm -rf packages/tavus` (workspace glob is `packages/*`; no `pnpm-workspace.yaml` edit needed)
- [ ] `rm -rf apps/mirror/app/api/tavus`
- [ ] `rm -rf apps/mirror/features/video-call`
- [ ] `rm apps/mirror/e2e/video-call.spec.ts`
- [ ] `rm -rf .claude/skills/tavus-cvi-quickstart .claude/skills/tavus-cvi-ui`
- [ ] `rm -rf .agents/skills/tavus-cvi-quickstart .agents/skills/tavus-cvi-ui`

## Phase 2 — Unwire the profile "Video" button

The "Video" action is one of two profile actions (the other is "Text"/chat).
Remove the Video entry and thread the `onOpenVideoCall` prop out end-to-end.

- [ ] **`features/profile/components/editable-profile-actions.tsx`** — remove the
  `onOpenVideoCall` prop (type + destructure) and the `"Video"` entry in the
  `actions` array (leaves a single "Text" action). Confirm the layout still reads
  well with one action.
- [ ] **`features/profile/components/profile-info.tsx`** — remove `onOpenVideoCall`
  from the props type, the destructure, and the pass-through at line ~169.
- [ ] **`app/[username]/_components/profile-panel.tsx`** — remove `setVideoCallOpen`
  from the `useProfileRouteData()` destructure and the `onOpenVideoCall={() => setVideoCallOpen(true)}`
  prop on `<ProfileInfo>`.
- [ ] **`app/[username]/_providers/profile-route-data-context.tsx`** — remove the
  `dynamic()` `VideoCallModal` import, the `videoCallOpen`/`setVideoCallOpen` state,
  the two fields from the `ProfileRouteData` type + `useMemo` value (and from its
  dep array), and the `{videoCallOpen && <VideoCallModal … />}` render block.
- [ ] **`app/[username]/_providers/__tests__/clone-actions-context.test.tsx`** —
  remove the `videoCallOpen` / `setVideoCallOpen` fields from the mock route-data object.

## Phase 3 — Env & build config

- [ ] **`apps/mirror/lib/env/server.ts`** — this file validates **only** `TAVUS_*`
  and its sole consumers were the Tavus routes (now deleted). Delete the file.
- [ ] **`apps/mirror/lib/env/index.ts`** — remove `export { serverEnv, type ServerEnv } from "./server";`
  (keep the `clientEnv` export). Verify nothing else imports `@/lib/env/server` or `serverEnv` (grep = clean).
- [ ] **`apps/mirror/next.config.ts`** CSP (`cspDirectives`):
  - `connect-src`: remove `https://*.daily.co`, `wss://*.daily.co`, and `https://tavusapi.com`; update trailing comment.
  - `frame-src`: remove `https://*.daily.co` (leaves `https://vercel.live` only); update comment.
  - `media-src`: remove `https://*.daily.co` **but KEEP** `'self' https://*.convex.cloud https://*.convex.site blob:` (Convex cover-video, PLAN_010 — not Tavus); update comment.
  - **Decision (recommended):** tighten `Permissions-Policy` from `camera=(self), microphone=(self)` → `camera=(), microphone=()` — no remaining feature uses camera/mic.
- [ ] **`apps/mirror/.env.local.example`** — remove the `# Tavus CVI …` block (`TAVUS_API_KEY`, `TAVUS_PERSONA_ID`).
- [ ] **`turbo.json`** — remove `"TAVUS_API_KEY"` and `"TAVUS_PERSONA_ID"` from `globalEnv`.
- [ ] **`apps/mirror/package.json`** — remove deps `@feel-good/tavus`, `@daily-co/daily-js`, `@daily-co/daily-react`.
- [ ] Run `pnpm install` to regenerate `pnpm-lock.yaml`.

## Phase 4 — Convex dead code (query only reachable via the deleted route)

`api.articles.queries.getByUsernameForConversation` returns `{title, body}[]` used
solely to build the Tavus conversational context. Its only caller was the deleted
route. Remove it and its dedicated validator + test.

- [ ] **`packages/convex/convex/articles/queries.ts`** — delete the
  `getByUsernameForConversation` query and drop the now-unused
  `conversationArticleReturnValidator` from its import.
- [ ] **`packages/convex/convex/articles/helpers.ts`** — delete
  `conversationArticleReturnValidator` (verify no other consumer — grep = only that query).
- [ ] **`packages/convex/convex/articles/__tests__/queries.test.ts`** — delete the
  `getByUsernameForConversation — FR-05 …` describe block (~lines 171–end of block).
- [ ] **Mandatory:** `pnpm --filter=@feel-good/convex run verify:codegen` (schema/registry change).

## Phase 5 — Scripts

- [ ] **`scripts/restore-env-local.sh`** — remove the `# Tavus` echo block (the two
  `grep … TAVUS_*` lines), drop `TAVUS_*` from the header comment (line ~6), and drop
  "Tavus" from the `vercel env pull failed` warning (line ~52).
- [ ] **`scripts/sync-worktree-convex-env.sh`** — remove "Tavus" from the comment (line ~9).

## Phase 6 — Docs, rules, and skill cross-references

- [ ] **`apps/mirror/AGENTS.md`**:
  - Tech Stack table: delete the `| Video | Tavus CVI, Daily.co … |` row.
  - Dependencies: delete the `@feel-good/tavus — Tavus CVI video calling` bullet.
  - Project Structure: delete the `video-call/ # Tavus CVI video calling` line; change `api/ # API routes (auth, tavus)` → `(auth)`.
  - Workspace Shell: the `@interaction/` slot line says "renders chat or video call" → change to "renders chat" (also review the `@interaction/` note in the shell description).
- [ ] **`.claude/rules/worktrees.md`** + **`.agents/rules/worktrees.md`** — remove "Tavus"
  from the `vercel env pull` description (line ~124); leaves Sentry DSN.
- [ ] **`.claude/skills/create-codebase-expert/SKILL.md`** + **`.agents/…`** — remove
  "Tavus integration" from the "Does NOT own" line (~138).
- [ ] **`.claude/skills/create-skill/SKILL.md`** + **`.agents/…`** — replace the
  `tavus-cvi-quickstart` example in the tool-action fallbacks (~line 50) with a
  non-Tavus example (e.g. keep `sentry-cli`).

## Decisions / judgment calls (default = do NOT touch history)

1. **Historical tickets** — `workspace/tickets/canceled/FG_012` (an entire canceled
   ticket about the Tavus route), `FG_046`, `FG_048`, and `workspace/tickets/completed/FG_170`
   mention Tavus as archival record. **Recommendation: leave as-is** — editing
   canceled/completed tickets rewrites history and adds no value. Flip only if the
   user explicitly wants zero string matches.
2. **`.greyboard/task-worktree-runs/ISSUE-1.json`** — a captured turbo build log that
   happens to contain `@feel-good/tavus`. Generated artifact, not source. **Leave as-is.**
3. **`docs/plans/2026-02-17-feat-tavus-cvi-video-calling-plan.md`** — referenced by FG_012
   but not present in the current tree (already deleted). Verify with
   `ls docs/plans/*tavus* 2>/dev/null` and remove if it reappears.
4. **Permissions-Policy camera/mic** — see Phase 3; recommended to tighten to `()`.

## Verification (per `.claude/rules/verification.md` — Tier 5 + Convex gate)

- [ ] `pnpm install` — lockfile regenerates cleanly, no `@feel-good/tavus` / `@daily-co/*`.
- [ ] `pnpm --filter=@feel-good/convex run verify:codegen` — **mandatory** (Convex change); confirms `_generated` has no dangling `getByUsernameForConversation`.
- [ ] `pnpm build --filter=@feel-good/mirror` — passes (no unresolved `@feel-good/tavus` / `@/features/video-call` / `@/lib/env/server` imports).
- [ ] `pnpm lint --filter=@feel-good/mirror` — passes.
- [ ] `pnpm --filter=@feel-good/mirror test:unit` — `clone-actions-context` test green after mock edit.
- [ ] Chrome MCP: load a profile, confirm the profile actions render correctly with only the "Text" action and no console/CSP errors.
- [ ] Final sweep: `grep -ril tavus --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .` returns **only** the intentionally-retained historical artifacts from Decisions (or nothing, if the user opts to scrub those too).
- [ ] Confirm Playwright config globs tests (no hardcoded `video-call.spec.ts` reference left dangling).

## Suggested commit slicing (feature branch off `main`, never commit to main)

1. `chore(tavus): delete package, routes, feature, e2e, skills` (Phase 1)
2. `refactor(profile): drop video-call button wiring` (Phase 2)
3. `chore(config): remove Tavus/Daily env, CSP, deps` (Phase 3)
4. `refactor(convex): drop getByUsernameForConversation dead query` (Phase 4)
5. `docs+scripts: purge Tavus references` (Phases 5–6)
