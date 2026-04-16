# Mirror

Interactive blogging platform that turns blog articles into a conversational digital clone of the author that readers can chat with.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3001)
pnpm build        # Production build
pnpm lint         # ESLint — must pass before commits
pnpm test:unit    # Vitest unit tests
pnpm test:e2e     # Playwright e2e tests
pnpm test:e2e:ui  # Playwright with UI
```

Or from monorepo root: `pnpm dev --filter=@feel-good/mirror`

## Tech Stack

| Category  | Technology                                         |
| --------- | -------------------------------------------------- |
| Framework | Next.js 15 (App Router), React 19, TypeScript      |
| Backend   | Convex (real-time), @convex-dev/agent (clone chat)  |
| Auth      | Better Auth with @convex-dev/better-auth            |
| AI/Chat   | Vercel AI SDK (`ai`), streaming clone responses     |
| Editor    | Tiptap (@tiptap/core) for post content              |
| Video     | Tavus CVI, Daily.co (@daily-co/daily-js)            |
| Styling   | Tailwind CSS, @tailwindcss/typography, framer-motion |
| UI        | @feel-good/ui (shadcn/ui primitives)                |
| i18n      | react-i18next                                       |

## Dependencies

- `@feel-good/convex` — Shared Convex backend
- `@feel-good/features` — Auth components and hooks
- `@feel-good/ui` — Shared UI components (shadcn/ui)
- `@feel-good/tavus` — Tavus CVI video calling
- `@feel-good/utils` — Utilities (cn, etc.)
- `@feel-good/sentry-config` — Error tracking

## Project Structure

```text
features/
  articles/             # Article list, pagination, filtering, search, sort
  posts/                # Blog post authoring, markdown import, publish/unpublish
  chat/                 # Clone chat — AI conversation with author's digital clone
  clone-settings/       # Clone persona configuration (tone, instructions)
  content/              # Shared list utilities (toolbar, filter, sort, date presets)
  profile/              # Profile display, inline editing, avatar
  profile-tabs/         # Tab navigation between articles/posts/chat
  home/                 # Landing page
  onboarding/           # New user onboarding wizard
  video-call/           # Tavus CVI video calling

app/
  [username]/           # Public profile routes (/@username via rewrites)
    _components/        # Workspace shell (desktop/mobile layouts, panels)
    _providers/         # Route-level providers (chat, profile data, workspace chrome)
    @content/           # Parallel route slot — content panel
      articles/         # Article list + detail
      posts/            # Post list + detail
      clone-settings/   # Clone settings page
    @interaction/       # Parallel route slot — interaction panel
    articles/           # Canonical article routes
    posts/              # Canonical post routes
    chat/               # Chat routes (list + conversation)
    clone-settings/     # Clone settings route
  (auth)/               # Auth flow (sign-in, sign-up)
  (protected)/
    dashboard/          # Insights (auth required)
    onboarding/         # New user onboarding
  api/                  # API routes (auth, tavus)

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

| Directory    | Purpose                              |
| ------------ | ------------------------------------ |
| `components/`| All React components                 |
| `hooks/`     | Custom hooks                         |
| `context/`   | React context providers              |
| `lib/`       | Schemas, data parsing, adapters      |
| `utils/`     | Pure utility functions               |
| `types.ts`   | Feature-specific types               |
| `index.ts`   | Public exports                       |

## Workspace Shell Architecture

The `[username]` route uses a **panel-based workspace** with parallel routes:

- **Desktop**: sidebar profile panel + content panel + optional interaction panel
- **Mobile**: stacked layout with bottom sheet navigation
- **Panels**: `profile-panel`, `content-panel`, `chat-panel`, `interaction-panel`
- **Providers**: `WorkspaceChromeContext` (panel visibility), `ProfileRouteDataContext` (profile data), `ChatRouteController` (chat state)
- **Content slot** (`@content/`): renders articles, posts, or clone-settings based on route
- **Interaction slot** (`@interaction/`): renders chat or video call

## URL Routing

| URL | Route | Auth | Content |
|-----|-------|------|---------|
| `/@username` | `[username]/page.tsx` | Public | Profile + default content |
| `/@username/articles` | `[username]/articles/page.tsx` | Public | Article list |
| `/@username/articles/:slug` | `[username]/articles/[slug]/page.tsx` | Public | Article detail |
| `/@username/posts` | `[username]/posts/page.tsx` | Public | Post list |
| `/@username/posts/:slug` | `[username]/posts/[slug]/page.tsx` | Public | Post detail |
| `/@username/chat` | `[username]/chat/page.tsx` | Public | Chat with clone |
| `/@username/chat/:conversationId` | `[username]/chat/[conversationId]/page.tsx` | Public | Specific conversation |
| `/@username/clone-settings` | `[username]/clone-settings/page.tsx` | Owner | Clone persona config |
| `/onboarding` | `(protected)/onboarding/page.tsx` | Required | New user wizard |
| `/dashboard` | `(protected)/dashboard/page.tsx` | Required | Insights |
| `/sign-in` | `(auth)/sign-in/page.tsx` | Public | Login |
| `/sign-up` | `(auth)/sign-up/page.tsx` | Public | Sign up |

`/@username` URLs are mapped to `/[username]` via Next.js rewrites in `next.config.ts`.

## Key Patterns

- Server components by default; `"use client"` only when needed
- Better Auth for session management (OTP login)
- Convex for real-time data synchronization
- Workspace layout: navbar / toolbar slot / content panel separation
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

| Topic      | File                                     |
| ---------- | ---------------------------------------- |
| Articles   | `.claude/rules/apps/mirror/articles.md`  |
| Navigation | `.claude/rules/apps/mirror/navigation.md`|
