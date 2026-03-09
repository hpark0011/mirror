---
id: FG_056
title: "Desktop profile root returns metadata instead of null"
date: 2026-03-09
type: improvement
status: completed
priority: p3
description: "The profile root page.tsx returns null for desktop user agents, meaning crawlers and link previews hitting /@username on desktop get an empty page. Should return appropriate metadata or a minimal server component for SEO and social sharing."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Fetching /@username with a desktop UA returns HTML with og:title and og:description meta tags"
  - "The page still does not render visible content for desktop (panel starts collapsed)"
  - "Mobile redirect behavior is unchanged"
owner_agent: "SEO and server rendering specialist"
---

# Desktop profile root returns metadata instead of null

## Context

In `apps/mirror/app/[username]/page.tsx:38-39`, when a desktop UA is detected, the page returns `null`. This means crawlers (Googlebot, social card generators) hitting `/@username` get an empty page with no metadata. The layout shell renders but the `children` slot is empty. A comment in the file should also explain the dual-role design (null for desktop, redirect for mobile).

## Goal

Desktop profile root serves appropriate metadata for crawlers and social sharing, while still rendering no visible content (panel starts collapsed, toggle reveals content).

## Scope

- Return metadata (og:title, og:description) from page.tsx for desktop
- Add explanatory comment about the dual-role design
- Keep visual behavior unchanged (no visible content on desktop profile root)

## Out of Scope

- Adding a full profile preview component for desktop root
- Changing the mobile redirect behavior
- Adding structured data (JSON-LD) for profiles

## Approach

Use Next.js `generateMetadata` to return profile-specific metadata regardless of device. The page component itself can still return `null` for desktop visual rendering. Add a brief comment explaining the design choice.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add `generateMetadata` export to `apps/mirror/app/[username]/page.tsx` with profile og tags
2. Add comment explaining the dual-role page design
3. Verify with `curl -H "User-Agent: ..." /@username` that meta tags are present
4. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Must not change visible behavior for desktop or mobile users
- Metadata should come from the profile data already available in the route

## Resources

- `apps/mirror/app/[username]/page.tsx`
- Next.js generateMetadata docs
