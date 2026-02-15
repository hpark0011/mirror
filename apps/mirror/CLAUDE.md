# Mirror

Mirror is an interactive blogging platform that turns blog articles into a conversational digital clone of the author that readers can chat with.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3001)
pnpm build        # Production build
pnpm lint         # ESLint - MUST pass before commits
```

Or from monorepo root:

```bash
pnpm dev --filter=@feel-good/mirror
```

## Tech Stack

| Category  | Technology                                    |
| --------- | --------------------------------------------- |
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Backend   | Convex (real-time)                            |
| Auth      | Better Auth with @convex-dev/better-auth      |
| Styling   | Tailwind CSS, @feel-good/ui                   |

## Dependencies

- `@feel-good/convex` - Shared Convex backend
- `@feel-good/features` - Auth components and hooks
- `@feel-good/ui` - Shared UI components

## Project Structure

```
features/
  home/                 # Landing page feature
    views/
      home-page-view.tsx

  profile/              # Profile display + bottom sheet
    components/
      profile-actions.tsx
      profile-media.tsx
    context/
      profile-context.tsx
    views/
      mobile-profile-layout.tsx
      profile-info-view.tsx
    lib/
      mock-profile.ts

  articles/             # Article list, pagination, filtering, search, sort
    components/
      animated-article-row.tsx
      article-filter-dropdown.tsx
      article-list-item.tsx
      article-list-loader.tsx
      article-search-input.tsx
      article-sort-dropdown.tsx
      article-toolbar.tsx
      article-toolbar-view.tsx
      scrollable-article-list.tsx
      filter/            # Nested filter UI components
    context/
      article-list-context.tsx
      article-toolbar-context.tsx
      article-workspace-context.tsx
      scroll-root-context.tsx
    hooks/
      use-article-filter.ts
      use-article-pagination.ts
      use-article-search.ts
      use-article-selection.ts
      use-article-sort.ts
    views/
      article-detail-toolbar-view.tsx
      article-detail-view.tsx
      article-list-view.tsx
      delete-articles-dialog.tsx
    lib/
      format-date.ts
      mock-articles.ts
    utils/
      article-filter.ts
      article-list.config.ts
      date-preset.ts

app/
  [username]/          # Public profile routes (/@username via rewrites)
    _components/       # Profile shell and header
    [slug]/            # Article detail page
  (auth)/              # Auth flow (sign-in, sign-up, callback)
  (protected)/
    dashboard/         # Insights (auth required)

components/            # App-level shared components
  workspace-navbar.tsx
  workspace-toolbar-slot.tsx

hooks/                 # App-level shared hooks
  use-local-storage.ts
  use-nav-direction.ts
  use-pathname-transition.ts
  use-scroll-memory.ts

lib/                   # Auth client, env, services
providers/             # React context providers
```

**Path aliases:** `@/*` maps to `apps/mirror/` root

## Key Patterns

- Server components by default
- Better Auth for session management
- Convex for real-time data synchronization
- Uses shared auth components from @feel-good/features
- Workspace layout: navbar / toolbar slot / content separation
- Feature contexts split by concern (toolbar vs list vs scroll-root)

## URL Routing

| URL | Route | Auth | Content |
|-----|-------|------|---------|
| `/@username` | `app/[username]/page.tsx` | Public | Profile + article list |
| `/@username/slug` | `app/[username]/[slug]/page.tsx` | Public | Article detail |
| `/dashboard` | `app/(protected)/dashboard/page.tsx` | Required | Insights |
| `/sign-in` | `app/(auth)/sign-in/page.tsx` | Public | Login |
| `/sign-up` | `app/(auth)/sign-up/page.tsx` | Public | Sign up |

`/@username` URLs are mapped to `/[username]` via Next.js rewrites in `next.config.ts`.

## Auth Flow

Authentication is handled by the shared `@feel-good/features` package (OTP and magic-link):

```typescript
// Forms
import {
  MagicLinkLoginForm,
  MagicLinkSignUpForm,
  OTPLoginForm,
  OTPSignUpForm,
} from "@feel-good/features/auth/components/forms";

// Hooks
import {
  useMagicLinkRequest,
  useOTPAuth,
  createUseSession,
} from "@feel-good/features/auth/hooks";

// Blocks (drop-in page sections)
import { LoginBlock, SignUpBlock } from "@feel-good/features/auth/blocks";
```
