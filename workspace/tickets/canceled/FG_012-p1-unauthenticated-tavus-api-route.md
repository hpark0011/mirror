---
id: FG_012
title: "Tavus API route rejects unauthenticated requests"
date: 2026-02-17
type: fix
status: to-do
priority: p1
description: "The /api/tavus/conversations POST route has no authentication check, allowing any unauthenticated user to create Tavus conversations and consume paid API credits."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'getSession\\|auth.api' apps/mirror/app/api/tavus/conversations/route.ts` returns a match showing session validation"
  - "`grep -n 'status: 401\\|Unauthorized' apps/mirror/app/api/tavus/conversations/route.ts` returns a match showing 401 response for unauthenticated requests"
  - "`pnpm build --filter=@feel-good/mirror` exits 0"
  - "Unauthenticated POST to `/api/tavus/conversations` returns HTTP 401"
owner_agent: "API Security Agent"
---

# Tavus API route rejects unauthenticated requests

## Context

The `/api/tavus/conversations` POST route at `apps/mirror/app/api/tavus/conversations/route.ts:9-48` has no authentication check. The existing middleware explicitly passes through all `/api/` routes (`pathname.startsWith("/api/")` -> `NextResponse.next()`). Any unauthenticated user can call this endpoint to create Tavus conversations, consuming paid API credits with no rate limiting or access control.

This was flagged in PR #133 review (cursor[bot], comment id 2815369840). The implementation plan (`docs/plans/2026-02-17-feat-tavus-cvi-video-calling-plan.md`) explicitly deferred auth for v1, relying on `max_duration` (10 min) as the only cost control, but the review flags this as insufficient.

## Goal

Unauthenticated requests to the Tavus conversations endpoint are rejected with a 401 status, preventing unauthorized consumption of paid API credits.

## Scope

- Add session validation to the Tavus conversations API route
- Return 401 for unauthenticated requests
- Preserve existing functionality for authenticated users

## Out of Scope

- Per-user or per-IP rate limiting (separate ticket if needed)
- Middleware-level API route authentication (broader scope)
- Changes to the Tavus CVI frontend components

## Approach

Add session validation at the top of the POST handler:

```typescript
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... existing logic
}
```

- **Effort:** Small
- **Risk:** Low

## Constraints

- Must use the existing auth infrastructure (`@/lib/auth`)
- Must not change the response format for authenticated requests

## Resources

- PR #133 review flagging the issue
- `docs/plans/2026-02-17-feat-tavus-cvi-video-calling-plan.md` — original plan that deferred auth
- `apps/mirror/app/api/tavus/conversations/route.ts` — the route to fix
