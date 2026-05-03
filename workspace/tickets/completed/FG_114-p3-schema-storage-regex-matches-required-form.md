---
id: FG_114
title: "Schema-storage regex catches required v.id('_storage') fields, not just optional"
date: 2026-05-02
type: fix
status: completed
priority: p3
description: "The schema-introspection regression test in orphan-sweep.test.ts uses /(\\w+)\\s*:\\s*v\\.(?:optional\\(\\s*)?v\\.id\\(\"_storage\"\\)/ which only matches v.optional(v.id(\"_storage\")). Required fields like coverImageStorageId: v.id(\"_storage\") (no v.optional wrapper) are silently skipped — the test passes but the new field would not be in STORAGE_FIELD_REFERENCES, so cron sweep would delete its blob. All current schema fields use v.optional, so the gap is dormant — but it's a false-safety regression guard."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "The regex in packages/convex/convex/content/__tests__/orphan-sweep.test.ts findSchemaStorageRefs matches both `field: v.id(\"_storage\")` AND `field: v.optional(v.id(\"_storage\"))` forms"
  - "New self-test asserts the regex matches both forms (test-of-the-test)"
  - "The bidirectional set-equality test in `STORAGE_FIELD_REFERENCES — schema-introspection regression test` continues to pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend / test infrastructure specialist"
---

# Schema-storage regex catches required v.id('_storage') fields, not just optional

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #37, correctness reviewer at confidence 0.97.

`packages/convex/convex/content/__tests__/orphan-sweep.test.ts:265`:

```ts
const match = line.match(/(\w+)\s*:\s*v\.(?:optional\(\s*)?v\.id\("_storage"\)/);
```

This regex requires a leading `v.` and then OPTIONALLY consumes `optional(\s*` before expecting another `v.id("_storage")`. So it matches:

- `field: v.optional(v.id("_storage"))` ✓ (consumes `v.optional( ` then matches `v.id("_storage")`)
- `field: v.id("_storage")` ✗ (no `v.optional(` to consume, but the regex still expects another `v.` before `id`)

Verified by ce:review: the regex returns `false` for `'coverImageStorageId: v.id("_storage"),'` and `true` for the `v.optional` form.

All three current schema fields (`articles.coverImageStorageId`, `posts.coverImageStorageId`, `users.avatarStorageId`) happen to use `v.optional`, so the introspection test passes today. But if a future feature adds a non-optional storage field (e.g., a required avatar for paid accounts), `STORAGE_FIELD_REFERENCES` will not include it and the cron sweep will delete its blob.

## Goal

After this ticket, the regex matches both forms. Adding a required `v.id("_storage")` field is correctly tracked by the introspection test, and the cron sweep will not delete its blob.

## Scope

- `packages/convex/convex/content/__tests__/orphan-sweep.test.ts` — fix the regex.
- Add a self-test asserting both forms match.

## Out of Scope

- Replacing the regex-based introspection with AST parsing (out of scope; regex is fine if correct).
- Other schema-shape regression tests.

## Approach

Two valid forms; correct regex either way:

```ts
const match = line.match(
  /(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)/,
);
```

Difference: the optional group consumes `optional(\s*v.` (including the second `v.`) when present, so the literal `id("_storage")` is what comes after.

Test-of-test:

```ts
it("findSchemaStorageRefs regex matches both required and optional storage fields", () => {
  // construct a fake schema source line and re-run the regex against it
  const requiredLine = '  coverImageStorageId: v.id("_storage"),';
  const optionalLine = '  coverImageStorageId: v.optional(v.id("_storage")),';
  const re = /(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)/;
  expect(re.exec(requiredLine)?.[1]).toBe("coverImageStorageId");
  expect(re.exec(optionalLine)?.[1]).toBe("coverImageStorageId");
});
```

- **Effort:** Small
- **Risk:** Low — pure test-only change.

## Implementation Steps

1. Update the regex in `findSchemaStorageRefs` in `packages/convex/convex/content/__tests__/orphan-sweep.test.ts:265`.
2. Add a self-test (above) inside the `STORAGE_FIELD_REFERENCES` describe block.
3. Run `pnpm --filter=@feel-good/convex test` — confirm existing schema-introspection test passes and new self-test passes.

## Constraints

- Regex must continue to handle whitespace variations between `:` and `v.`.
- Must not match unrelated lines (e.g., function args declared as `v.id("_storage")` in a query handler).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #37.
- `packages/convex/convex/content/__tests__/orphan-sweep.test.ts:213-323` — the introspection harness.
