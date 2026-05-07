---
paths:
  - "apps/mirror/app/**"
  - "apps/mirror/middleware.ts"
  - "apps/mirror/next.config.ts"
---

# Mirror URL Routing

| URL | Route | Auth | Content |
|-----|-------|------|---------|
| `/@username` | `[username]/page.tsx` | Public | Profile + default content |
| `/@username/articles` | `[username]/articles/page.tsx` | Public | Article list |
| `/@username/articles/:slug` | `[username]/articles/[slug]/page.tsx` | Public | Article detail |
| `/@username/articles/:slug/edit` | `[username]/@content/articles/[slug]/edit/page.tsx` | Owner (server-component check; redirect on miss) | Article inline editor |
| `/@username/posts` | `[username]/posts/page.tsx` | Public | Post list |
| `/@username/posts/:slug` | `[username]/posts/[slug]/page.tsx` | Public | Post detail |
| `/@username/posts/:slug/edit` | `[username]/@content/posts/[slug]/edit/page.tsx` | Owner (server-component check; redirect on miss) | Post inline editor |
| `/@username/chat` | `[username]/chat/page.tsx` | Public | Chat with clone |
| `/@username/chat/:conversationId` | `[username]/chat/[conversationId]/page.tsx` | Public | Specific conversation |
| `/@username/clone-settings` | `[username]/clone-settings/page.tsx` | Owner | Clone persona config |
| `/onboarding` | `onboarding/page.tsx` | Required | New user wizard |
| `/dashboard` | `(protected)/dashboard/page.tsx` | Required | Insights |
| `/sign-in` | `(auth)/sign-in/page.tsx` | Public | Login |
| `/sign-up` | `(auth)/sign-up/page.tsx` | Public | Sign up |

`/@username` URLs are mapped to `/[username]` via Next.js rewrites in `next.config.ts`.
