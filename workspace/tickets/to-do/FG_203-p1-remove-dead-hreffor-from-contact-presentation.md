---
id: FG_203
title: "Remove dead hrefFor from contact presentation record (URL kinds)"
date: 2026-05-12
type: refactor
status: pending
priority: p1
description: "`CONTACT_KIND_PRESENTATION` defines `hrefFor` on every kind, but `contact-entry-card.tsx` only calls it for `email`. The five URL-kind `hrefFor` implementations (`value.trim()`) are dead code. The presentation record currently lies about being the single source of truth for href construction — a future caller reading the record may use `hrefFor` and skip the `safeHttpsUrl` https sanitizer, rendering an un-validated URL into `<a href>`."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`hrefFor` is removed from the `Presentation` type and from all five URL-kind entries in `apps/mirror/features/contact/lib/contact-kind-presentation.ts`"
  - "`contact-entry-card.tsx` builds the email anchor inline (`mailto:${trimmed}`) without going through `presentation.hrefFor`, OR `hrefFor` is folded into the email entry only"
  - "`grep -rn 'hrefFor' apps/mirror/features/contact` returns no matches outside the email branch"
  - "`pnpm build --filter=@feel-good/mirror` exits 0"
  - "`pnpm lint --filter=@feel-good/mirror` exits 0"
owner_agent: "Review Fixer"
---

# Remove Dead hrefFor From Contact Presentation Record

## Context

Review finding from `/review-code` on `feature-add-contact-panel` (2026-05-12). Flagged by both
the maintainability and convention reviewers (kept at P1 — maintainability rated it P1,
convention rated it P3; the more severe priority wins).

`apps/mirror/features/contact/lib/contact-kind-presentation.ts:33-69` declares
`CONTACT_KIND_PRESENTATION` as a `Record<ContactEntryKind, Presentation>` where every
entry — `email`, `linkedin`, `instagram`, `x`, `tiktok`, `youtube` — has an `hrefFor(value)`
function. The shape implies `hrefFor` is the canonical href-building surface for all kinds.

In practice, only the email branch ever calls it. `apps/mirror/features/contact/components/contact-entry-card.tsx:30-33`:

```ts
const href =
  entry.kind === "email"
    ? presentation.hrefFor(trimmed)
    : safeHttpsUrl(trimmed);
```

The five URL-kind `hrefFor` implementations (all `value.trim()`) are never reached.

## Risk

Future maintainers reading the `Presentation` record will assume `hrefFor` is the
authoritative href-building path for every kind and spend time tracing through it, only
to discover the card ignores it for URLs. If a developer adds a new kind (e.g. `phone` →
`tel:`) by following the `Presentation` pattern, they may wire `hrefFor` correctly on the
record and never touch the card — silently rendering nothing for the new kind. Or worse,
a future refactor that consolidates the card to "always call `presentation.hrefFor`" will
strip the `safeHttpsUrl` sanitizer, opening a raw-URL-injection path into `<a href>` for
URL kinds.

## Suggested Fix

Remove `hrefFor` from the `Presentation` type entirely. Inline `mailto:${trimmed}` directly
in the email branch of `contact-entry-card.tsx`. The card already owns the per-kind href
dispatch — let it be the single source of truth, and stop pretending the presentation
record participates.

Alternative: keep `hrefFor` on email only, drop it from the five URL kinds.

## Verification

- Read `contact-entry-card.tsx` after the change and confirm `presentation.hrefFor` no
  longer appears anywhere in the file (or only appears in the email branch).
- Confirm the existing public e2e spec (`contact-tab-public.spec.ts`) still asserts
  `mailto:` anchors for email-kind cards and `https:`-only anchors for URL kinds.
