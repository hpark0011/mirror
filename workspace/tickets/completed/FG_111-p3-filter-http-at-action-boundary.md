---
id: FG_111
title: "Markdown-import action filters out http:// URLs at the boundary instead of failing per-image"
date: 2026-05-02
type: fix
status: completed
priority: p3
description: "isAbsoluteHttpUrl in articles/actions.ts and posts/actions.ts uses /^https?:\\/\\//i, accepting http:// URLs as candidates. safeFetchImage correctly rejects them via assertHttps (no SSRF), but each http:// reference becomes a per-image failure recorded in the ImportResult — confusing UX. Tighten the regex to https-only so http:// references are silently skipped (left unrewritten in the body) like data: or relative URLs."
dependencies: [FG_095]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "isAbsoluteHttpUrl is renamed to isAbsoluteHttpsUrl (or similar) and uses /^https:\\/\\//i in the shared content/ helper from FG_095 — or in both actions.ts files if FG_095 hasn't landed"
  - "http:// image references in markdown bodies are NOT included in the ImportResult.failures list"
  - "https:// references continue to work"
  - "New Vitest case: body with mixed https + http image URLs — assert only https URLs are processed and the http URL is left unrewritten in the body without an associated failure"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend specialist"
---

# Markdown-import action filters out http:// URLs at the boundary instead of failing per-image

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #30, security reviewer at confidence 0.75.

`packages/convex/convex/articles/actions.ts:131`:

```ts
function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
```

The function name suggests "is an external URL we want to fetch." The regex accepts both `http://` and `https://`. Every http:// URL in a markdown body becomes a candidate, gets passed to `safeFetchImage`, which correctly throws `SafeFetchError("invalid-scheme")`, which the action catches and records as a failure.

User-visible: the markdown-upload dialog reports "Failed to import N images: invalid-scheme for http://example.com/foo.png ..." for every http:// reference. This is noise — the policy intentionally rejects http:// at the SSRF layer, so the user can do nothing about it.

Cleaner UX: filter http:// out at the candidate-selection step, leaving them in the body unchanged (just like data: URIs and relative paths today). The user sees the original markdown rendering untouched, no failure entry.

The same code exists in `posts/actions.ts:126`.

## Goal

After this ticket, http:// references in imported markdown bodies are silently passed through. https:// references continue to be fetched and rewritten. The failure list contains only genuinely-attempted-and-failed imports.

## Scope

- The shared markdown-import helper (after FG_095) or both `actions.ts` files — tighten the URL filter regex.
- Vitest case asserting the new behavior.
- (Optional) rename function to `isAbsoluteHttpsUrl` for clarity.

## Out of Scope

- Surfacing a one-time "we skipped N http:// images" warning to the user — the user can reasonably assume http:// was deliberate.
- Changing the SSRF guard behavior in `safe-fetch.ts` — `assertHttps` continues to throw on http:// (defense in depth).

## Approach

```ts
function isAbsoluteHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}
```

Update both call sites (action body + walk helper). After FG_095 the function lives once; without it, both `actions.ts` files need the change.

- **Effort:** Small
- **Risk:** Low — narrows the candidate set; can only reduce work, not add it.

## Implementation Steps

1. Coordinate with FG_095 — prefer landing this in the shared helper.
2. Rename `isAbsoluteHttpUrl` → `isAbsoluteHttpsUrl` and update regex to `/^https:\/\//i`.
3. Update all call sites.
4. Add Vitest case in `inline-images.test.ts` (or appropriate test) with a body containing both http:// and https:// images.
5. Run all tests.

## Constraints

- Behavior for non-URL `src` values (data:, relative paths, empty strings) must not change — they already pass through as non-candidates.
- The function rename is optional but recommended for clarity.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #30.
- `packages/convex/convex/content/safe-fetch.ts:168-181` — `assertHttps`, the secondary check.
- `packages/convex/convex/articles/actions.ts:131` and `posts/actions.ts:126`.
