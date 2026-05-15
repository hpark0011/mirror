---
id: FG_232
title: "Consolidate withoutTrailingSlash into a single shared helper"
date: 2026-05-15
type: refactor
status: completed
priority: p1
branch: hpark0011/post-edit-delete
verification_tier: 2
description: "withoutTrailingSlash is defined as a named function in apps/mirror/lib/env/client.ts:22 and apps/mirror/app/api/test/session/route.ts:30, and inlined as .replace(/\\/+$/, '') in apps/mirror/e2e/lib/env.ts:13. Three copies of the one-liner mean any future tweak (e.g., normalising mid-path doubled slashes) must update all three. The workspace/lessons.md 2026-05-15 entry argues precisely for one canonical fix — violating the 'compounding option' principle in the same commit that introduced the lesson."
dependencies: []
acceptance_criteria:
  - "Exactly one named export `withoutTrailingSlash` exists in the apps/mirror directory: grep -rn 'function withoutTrailingSlash' apps/mirror returns exactly one match (or zero local copies if the helper lives in a shared package)"
  - "grep -rn 'replace(/\\\\/+\\$/' apps/mirror returns no inline copies in production code"
  - "apps/mirror/app/api/test/session/route.ts and apps/mirror/e2e/lib/env.ts both import withoutTrailingSlash from the canonical module"
  - "pnpm build --filter=@feel-good/mirror passes; pnpm lint --filter=@feel-good/mirror passes"
---

# Consolidate withoutTrailingSlash into a single shared helper

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. The trailing-slash defense is currently triplicated:

- `apps/mirror/lib/env/client.ts:22` — `function withoutTrailingSlash(url: string): string { return url.replace(/\/+$/, ""); }`
- `apps/mirror/app/api/test/session/route.ts:30` — byte-for-byte identical
- `apps/mirror/e2e/lib/env.ts:13` — `return requireEnv(name).replace(/\/+$/, "");`

`workspace/lessons.md` (2026-05-15 entry) records the lesson behind these fixes. The `AGENTS.md` "Always Choose the Compounding Option" principle requires patching the upstream artifact when fixing the downstream instance. Two independent reviewers (convention, maintainability) agreed (merged confidence 0.98).

## Scope

- Export `withoutTrailingSlash` from one canonical location.
- Update `route.ts` and `e2e/lib/env.ts` to import it.

## Approach

Export `withoutTrailingSlash` from `apps/mirror/lib/env/client.ts` (or move to a thin `apps/mirror/lib/url.ts` if the e2e file cannot import from `lib/env/client.ts` due to Zod-side-effects-at-import). Update the two duplicate call sites.

## Implementation Steps

1. Add `export` to the existing `withoutTrailingSlash` declaration in `apps/mirror/lib/env/client.ts:22`. If importing `clientEnv` from `e2e/` is problematic (it triggers env validation on test boot), move the helper to a new `apps/mirror/lib/url.ts` instead.
2. Replace the local declaration in `apps/mirror/app/api/test/session/route.ts:25-27` with an import.
3. Replace the inline `.replace(/\/+$/, "")` in `apps/mirror/e2e/lib/env.ts:13` with an import + call.
4. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
