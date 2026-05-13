---
id: FG_209
title: "validateValue enforces contact URL hostname matches declared kind"
date: 2026-05-13
type: fix
status: to-do
priority: p1
description: "contacts/writeHelpers.validateValue accepts any https URL for non-email kinds, so a contact entry with kind='linkedin' can store value='https://tiktok.com/...'. The configuration agent or a stale-client form submission can therefore persist mislabeled data, break the one-per-platform invariant, and cause the wrong icon/label to render."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/contacts/writeHelpers.ts validateValue rejects a 'linkedin' contact whose value points at tiktok.com (or any non-linkedin host)"
  - "A per-kind hostname allowlist constant lives in contacts/writeHelpers.ts (or a sibling lib file) and is the single source of truth shared with detectContactKind in contacts/detectContactKind.ts"
  - "A new unit test in packages/convex/convex/contacts/__tests__/ asserts hostname-vs-kind enforcement for every kind in CONTACT_ENTRY_KIND_VALUES except email"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/contacts/__tests__/ passes"
  - "The configuration agent's applyContactEntryPatch tool inherits the tightened validation because it routes through writeHelpers"
owner_agent: "Convex contacts engineer"
---

# validateValue enforces contact URL hostname matches declared kind

## Context

`packages/convex/convex/contacts/writeHelpers.ts:21-37` defines `validateValue`:

```ts
if (kind === "email") {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { throw ... }
  return;
}
let url: URL;
try { url = new URL(trimmed); } catch { throw ... }
if (url.protocol !== "https:") { throw ... }
```

Once the protocol is `https:`, the function returns. There is no hostname check. The same writeHelpers are used by:
- The public `authMutation` create/update at `contacts/mutations.ts`
- The configuration-mode tool `applyContactEntryPatch` via `chat/toolMutations.ts:applyContactEntryPatch`, which calls `upsertContactEntryForUser` → `validateValue`

The codex bot flagged this in PR #93 review thread `r3232592084`:

> For non-email entries this accepts any https:// URL, so a linkedin entry can still store a TikTok URL. Please tighten the server-side trust boundary by checking the hostname/profile shape against kind.

Adjacent file `contacts/detectContactKind.ts` already encodes the hostname-to-kind mapping:

```ts
if (host === "linkedin.com") return "linkedin";
if (host === "instagram.com") return "instagram";
if (host === "x.com" || host === "twitter.com") return "x";
if (host === "tiktok.com") return "tiktok";
if (host === "youtube.com" || host === "youtu.be") return "youtube";
```

That mapping IS the allowlist; it just isn't used as one yet. The fix is to share a single mapping between `detectContactKind` (input → kind) and `validateValue` (kind + URL → valid?).

## Goal

A contact entry can only be created/updated when the URL hostname matches the declared kind. Cross-platform value-injection is rejected at the mutation boundary regardless of whether the call comes from the UI authMutation or the configuration agent's internal mutation.

## Scope

- `packages/convex/convex/contacts/writeHelpers.ts` — extend `validateValue` to enforce hostname-vs-kind for non-email kinds.
- `packages/convex/convex/contacts/detectContactKind.ts` — refactor the hardcoded hostname checks into a shared `CONTACT_HOSTNAME_ALLOWLIST: Record<DetectedContactKind, ReadonlySet<string>>` map (or similar) that both `detectContactKind` and `validateValue` import.
- New unit test in `packages/convex/convex/contacts/__tests__/validateValue.test.ts` (or extend existing) covering: each kind with a matching hostname (accepts), each kind with a wrong hostname (rejects), www. prefix handled, twitter.com→x kind alias handled.

## Out of Scope

- Adding new contact kinds.
- Changing the regex shape for email validation.
- The configuration agent's `fetchProfileSource` hostname blocking (covered in FG_206, FG_210-212).

## Approach

Define one canonical mapping:

```ts
// contacts/writeHelpers.ts (or a new contacts/lib/hostname-allowlist.ts)
export const CONTACT_HOSTNAME_ALLOWLIST: Record<
  Exclude<ContactEntryKind, "email">,
  ReadonlyArray<string>
> = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
};

export function isAllowedContactHost(
  kind: Exclude<ContactEntryKind, "email">,
  hostname: string,
): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return CONTACT_HOSTNAME_ALLOWLIST[kind].includes(normalized);
}
```

Then in `validateValue`:

```ts
if (kind !== "email") {
  // ...existing URL parse + https check
  if (!isAllowedContactHost(kind, url.hostname)) {
    throw new Error(`${kind} value must point at ${CONTACT_HOSTNAME_ALLOWLIST[kind].join(" or ")}`);
  }
}
```

Refactor `detectContactKind.ts` to import the same constant.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add `CONTACT_HOSTNAME_ALLOWLIST` and `isAllowedContactHost` to `packages/convex/convex/contacts/writeHelpers.ts` (or a new `contacts/lib/hostname-allowlist.ts` if file size becomes an issue).
2. Refactor `contacts/detectContactKind.ts` to import the same mapping rather than re-declaring it inline.
3. Extend `validateValue` to call `isAllowedContactHost` for non-email kinds and throw with a descriptive error on mismatch.
4. Add `packages/convex/convex/contacts/__tests__/validateValue.test.ts` (or extend the existing detectContactKind test file) with: linkedin+tiktok URL rejected; linkedin+linkedin URL accepted (with www. and without); x+twitter.com URL accepted (alias); youtube+youtu.be URL accepted (alias); unknown host rejected.
5. Run the test suite and confirm no regression in existing contact tests.
6. Verify the configuration agent path: existing `tools.test.ts` `applyContactEntryPatch` tests should still pass with linkedin URLs; add one negative case asserting `applyContactEntryPatch` rolls back the whole batch when a single operation has a mismatched URL.

## Constraints

- Do not loosen any existing validation — this strictly tightens.
- Keep the mapping isomorphic with `detectContactKind` to avoid drift.
- Email validation is unchanged.

## Resources

- PR #93 thread r3232592084: https://github.com/hpark0011/mirror/pull/93#discussion_r3232592084
- `.claude/rules/identifiers.md` — "trust boundary at the mutation" pattern
- `packages/convex/convex/contacts/detectContactKind.ts` — existing hostname map
