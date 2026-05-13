---
id: FG_204
title: "Add openProfileSection execute-level test for section='contact'"
date: 2026-05-12
type: test
status: completed
priority: p1
description: "The `chat/tools.openProfileSection — execute` describe block covers bio, articles, and posts behaviorally but has no case for `section='contact'`. The new contact dispatch branch (`if (section === 'contact')` → `internal.chat.toolQueries.queryContactPanel`) is asserted only by the `inputSchema invariants` enum check — a rename of `queryContactPanel` or removal of the dispatch branch would silently break clone-agent navigation to the contact panel."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A new `it('opens the contact panel for the profile owner', ...)` test in the existing `chat/tools.openProfileSection — execute` describe block calls `tools.openProfileSection.execute(ctx, { section: 'contact' })` against an owner with at least one `contactEntries` row and asserts `result.kind === 'contact'`, `result.hasEntries === true`, and `result.href === buildContactHref(ownerUsername)`"
  - "A second test covers the empty-section case: same call, no contact entries seeded, asserts `result.hasEntries === false` and `result.href` still resolves"
  - "A cross-user isolation test mirroring the existing posts SECURITY case (`packages/convex/convex/chat/__tests__/tools.test.ts:1616`) seeds a contact entry for user B and confirms `openProfileSection({ section: 'contact' })` for user A's owner factory returns `hasEntries: false`"
  - "`pnpm --filter=@feel-good/convex test:unit packages/convex/convex/chat/__tests__/tools.test.ts` exits 0"
owner_agent: "Test Author"
---

# Add Execute-Level Test for openProfileSection section='contact'

## Context

Review finding from `/review-code` on `feature-add-contact-panel` (2026-05-12). Flagged by
both the tests and agent-native reviewers (kept at P1 — tests rated it P1, agent-native
rated it P2; the more severe priority wins).

The feature adds a new dispatch branch in `packages/convex/convex/chat/tools.ts:580-595`:

```ts
if (section === "contact") {
  const row = await ctx.runQuery(
    internal.chat.toolQueries.queryContactPanel,
    { userId: profileOwnerId },
  );
  if (!row) throw new Error("Contact panel is unavailable for this profile.");
  return { kind: "contact", href: row.href, hasEntries: row.hasEntries };
}
```

The existing `chat/__tests__/tools.test.ts:1473-1651` `openProfileSection — execute`
describe block covers:

- `section='bio'` — two cases (with and without entries)
- `section='articles'` — two cases (with and without published rows)
- `section='posts'` — two cases (with and without published rows)
- a cross-user isolation SECURITY case for posts

The `contact` branch has **no** execute-level coverage. The
`inputSchema invariants` block at line 1228 pins the value list (`["articles","bio","contact","posts"]`)
but does not invoke the handler.

## Risk

The `queryContactPanel` dispatch branch is untested at the integration level. A future
refactor that:

- renames `internal.chat.toolQueries.queryContactPanel`,
- changes the result shape (`{ kind, href, hasEntries }`),
- deletes the `if (section === "contact")` block,
- or breaks the `buildContactHref` integration,

would pass all current tests while silently breaking clone-agent navigation to the
contact panel. This is exactly the parity-regression class the `inputSchema invariants`
test was written to catch — but the inputSchema test only covers the LLM-visible enum,
not the server handler.

## Suggested Fix

Add three test cases to the `openProfileSection — execute` describe block, mirroring the
existing bio/posts cases. Use the same `buildCtx(t)` helper and the same owner-factory
setup. Reference shapes:

```ts
it("opens the contact panel for the profile owner", async () => {
  // seed one contactEntries row for owner
  // call tools.openProfileSection.execute(buildCtx(t), { section: "contact" })
  // expect result.kind === "contact"
  // expect result.hasEntries === true
  // expect result.href === buildContactHref(ownerUsername)
});

it("returns hasEntries:false when the owner has no contact entries", async () => {
  // ...
});

it("does not leak another user's contact rows into hasEntries", async () => {
  // mirror the posts SECURITY test at line 1616
});
```

## Verification

- Run the unit test suite and confirm the three new cases pass.
- Mutation-test by temporarily renaming `queryContactPanel` → `queryContactPanelX` in
  `tools.ts` and confirm one of the new tests fails. Revert.
