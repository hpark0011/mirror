# Mirror

Interactive blogging platform that turns blog articles into a conversational digital clone of the author that readers can chat with.

## Commands

```bash
pnpm dev          # Start dev server (main prefers 3001; worktrees auto-allocate)
pnpm build        # Production build
pnpm lint         # ESLint — must pass before commits
pnpm test:unit    # Vitest unit tests
pnpm test:e2e     # Playwright e2e tests
pnpm test:e2e:ui  # Playwright with UI
```

Or from monorepo root: `pnpm dev --filter=@feel-good/mirror`

In parallel worktrees, Mirror dev and Playwright e2e scripts use
`scripts/with-worktree-port.mjs` to allocate a stable per-worktree port. Use
`MIRROR_PORT=<port>` when you need an explicit port.

## Tech Stack

| Category  | Technology                                           |
| --------- | ---------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript        |
| Backend   | Convex (real-time), @convex-dev/agent (clone chat)   |
| Auth      | Better Auth with @convex-dev/better-auth             |
| AI/Chat   | Vercel AI SDK (`ai`), streaming clone responses      |
| Editor    | Tiptap (@tiptap/core) for post content               |
| Styling   | Tailwind CSS, @tailwindcss/typography, framer-motion |
| UI        | @feel-good/ui (shadcn/ui primitives)                 |
| i18n      | react-i18next                                        |

## Dependencies

- `@feel-good/convex` — Shared Convex backend
- `@feel-good/features` — Auth components and hooks
- `@feel-good/ui` — Shared UI components (shadcn/ui)
- `@feel-good/utils` — Utilities (cn, etc.)
- `@feel-good/sentry-config` — Error tracking

## Project Structure

```text
features/
  articles/             # Article list, pagination, filtering, search, sort
  posts/                # Blog post authoring, markdown import, publish/unpublish
  chat/                 # Clone chat — AI conversation with author's digital clone
  content/              # Shared list utilities (toolbar, filter, sort, date presets)
  profile/              # Profile display, inline editing, avatar
  profile-tabs/         # Bio, Contact, Projects, Posts, and Articles tabs
  waitlist/             # Landing page + waitlist signup form
  onboarding/           # New user onboarding wizard

app/
  [username]/           # Public profile routes (/@username via rewrites)
    _components/        # Single-surface workspace shell and content chrome
    _providers/         # Profile data and shared clone-action dispatcher
    @content/           # Parallel route slot — full-width content surface
      articles/         # Article list + detail
      posts/            # Post list + detail
    articles/           # Canonical article routes
    posts/              # Canonical post routes
    chat/               # Legacy chat routes redirecting to Articles
  (auth)/               # Auth flow (sign-in, sign-up)
  (protected)/
    dashboard/          # Insights (auth required)
    onboarding/         # New user onboarding
  api/                  # API routes (auth)

components/             # App-level shared (navbar, toolbar slot, avatar, logo)
hooks/                  # App-level shared hooks
lib/                    # Auth client/server, Convex client, env, Sentry
providers/              # React context providers (Convex, root)
styles/                 # Global CSS
e2e/                    # Playwright e2e tests
```

**Path aliases:** `@/*` maps to `apps/mirror/` root

## Feature Module Convention

Each feature under `features/` follows this layout:

| Directory     | Purpose                         |
| ------------- | ------------------------------- |
| `components/` | All React components            |
| `hooks/`      | Custom hooks                    |
| `context/`    | React context providers         |
| `lib/`        | Schemas, data parsing, adapters |
| `utils/`      | Pure utility functions          |
| `types.ts`    | Feature-specific types          |
| `index.ts`    | Public exports                  |

## Workspace Shell Architecture

The `[username]` route uses a single full-width content workspace at every
breakpoint:

- **Content slot** (`@content/`): renders posts, articles, bio, contact, or projects based on route
- **Default**: `/@username` temporarily redirects to `/@username/articles`
- **Legacy chat state**: chat routes and chat query parameters temporarily redirect to clean Articles
- **Providers**: `ProfileRouteDataContext` supplies profile data; `CloneActionsProvider` is the shared UI/agent navigation dispatcher
- **Dormant features**: reusable profile/chat components and backend code remain, but no interaction surface mounts in the workspace

URL routing table lives in [`.claude/rules/apps/mirror/routing.md`](../../.claude/rules/apps/mirror/routing.md) (loads on demand under `app/`).

## Key Patterns

- Server components by default; `"use client"` only when needed
- Better Auth for session management (OTP login)
- Convex for real-time data synchronization
- Workspace layout: navbar / toolbar slot / full-width content surface
- Feature contexts split by concern (toolbar vs list vs workspace)
- Context connector pattern: `*-connector.tsx` reads context, passes props to pure UI
- `content/` feature provides shared list infrastructure reused by articles and posts

## Auth Flow

Authentication uses the shared `@feel-good/features` package (OTP-based):

```typescript
import { LoginBlock, SignUpBlock } from "@feel-good/features/auth/blocks";
import { useOTPAuth, createUseSession } from "@feel-good/features/auth/hooks";
```

## Topic Rules

Feature-specific rules live in `.claude/rules/apps/mirror/`:

| Topic      | File                                      |
| ---------- | ----------------------------------------- |
| Articles   | `.claude/rules/apps/mirror/articles.md`   |
| Navigation | `.claude/rules/apps/mirror/navigation.md` |
| Routing    | `.claude/rules/apps/mirror/routing.md`    |
