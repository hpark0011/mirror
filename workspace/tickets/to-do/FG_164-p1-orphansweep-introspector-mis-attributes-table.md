---
id: FG_164
title: "orphanSweep schema introspector mis-attributes coverImageOwnership.storageId to articles"
date: 2026-05-07
type: fix
status: to-do
priority: p1
description: "The FR-10 schema-introspection regression test in orphanSweep.test.ts fails on pristine main because its introspector infers a table name from the schema file's parent directory. coverImageOwnership is defined inside articles/schema.ts so its storageId field is mis-keyed as articles.storageId, which is not in STORAGE_FIELD_REFERENCES, so the set-equality assertion explodes. The bug ships one broken test on main HEAD that every PR inherits."
dependencies: []
acceptance_criteria:
  - "`pnpm --filter=@feel-good/convex test orphanSweep` exits 0 with all 8 tests passing on the branch's HEAD."
  - "`findSchemaStorageRefs()` (or its replacement) returns a `coverImageOwnership.storageId` entry — not `articles.storageId` — when run against `packages/convex/convex/articles/schema.ts`. Add a unit assertion in the same test file proving the new attribution."
  - "The three pre-existing scalar attributions still resolve correctly: `articles.coverImageStorageId`, `posts.coverImageStorageId`, `users.avatarStorageId` (the existing sanity assertion at orphanSweep.test.ts:332 still passes)."
  - "`packages/convex/convex/content/storageRegistry.ts` is NOT modified — `coverImageOwnership` is ownership metadata, not a blob reference, and must not be added to `STORAGE_FIELD_REFERENCES` (otherwise the orphan-sweep cron would treat ownership rows as live blob holders forever)."
  - "`grep -n 'path.basename(path.dirname(file))' packages/convex/convex/content/__tests__/orphanSweep.test.ts` returns no matches — the directory-based inference is gone, replaced by parsing of `defineTable(<fieldsVar>)` callsites or the schema-registration map."
owner_agent: "Convex schema-introspection refactorer"
---

# orphanSweep schema introspector mis-attributes coverImageOwnership.storageId to articles

## Context

`packages/convex/convex/content/__tests__/orphanSweep.test.ts:286-325` walks every `*/schema.ts` file under `convex/`, scans for `v.id("_storage")` field declarations, and infers the owning table name from the file's parent directory (`packages/convex/convex/content/__tests__/orphanSweep.test.ts:319`):

```ts
// Infer the table name from the directory the schema lives in.
const tableDir = path.basename(path.dirname(file));
out.push({ file, table: tableDir, field: match[1]! });
```

Main now defines two tables in the same file: `articles` (cover image) and `coverImageOwnership` (ownership metadata for FG_147), both inside `packages/convex/convex/articles/schema.ts:7-46`. The introspector picks up `storageId: v.id("_storage")` from `coverImageOwnershipFields` at line 40 but attributes it to `articles` (the directory name), producing the bogus key `articles.storageId`.

`STORAGE_FIELD_REFERENCES` at `packages/convex/convex/content/storageRegistry.ts:47-83` does not contain `articles.storageId` (correctly — there's no such field on the `articles` table) and does not contain `coverImageOwnership.storageId` (correctly — ownership rows are not sweep targets). So the set-equality assertion at `packages/convex/convex/content/__tests__/orphanSweep.test.ts:350` reports `uncovered: ["articles.storageId"]` and the test fails.

Confirmed pre-existing on `main` (commit `ecc5e7dc`) by running the test in the pristine `/Users/disquiet/Desktop/mirror` worktree — fails identically with no branch-local code involved. The test is a permanent CI red on main today.

## Goal

`orphanSweep.test.ts` correctly attributes every `v.id("_storage")` field to the table that actually holds it, regardless of whether multiple tables are colocated in a single schema file. The FR-10 regression assertion passes on a pristine main checkout.

## Scope

- Replace the directory-based table inference inside `findSchemaStorageRefs` (`packages/convex/convex/content/__tests__/orphanSweep.test.ts:286-325`) with a parser that reads the actual table-to-fields binding inside the schema file.
- Add a focused unit assertion that calls `findSchemaStorageRefs` (or its replacement) and asserts `coverImageOwnership.storageId` is in the result and `articles.storageId` is not.

## Out of Scope

- Adding a `coverImageOwnership.storageId` entry to `STORAGE_FIELD_REFERENCES`. That is the wrong fix — ownership rows are metadata, not live blob references; sweep would treat them as keep-forever.
- Refactoring `STORAGE_FIELD_REFERENCES` itself or the orphan-sweep cron implementation.
- Splitting `coverImageOwnership` out into its own `convex/coverImageOwnership/schema.ts` directory. That would make the directory-based heuristic accidentally correct again, but the introspector would still be wrong for any future file that legitimately defines two tables.
- Any change to articles/coverImageOwnership runtime behavior — this is a test-file-only fix.

## Approach

The convex schema convention in this repo is:

```ts
export const <table>Fields = { ... };
export const <table>Table = defineTable(<table>Fields).index(...);
```

and `convex/schema.ts` registers the tables via `defineSchema({ <tableKey>: <table>Table, ... })`. Either layer can be used as the source of truth — both are AST-ish but parseable with line regexes. Recommended: read `<schemaFile>` once, find every `defineTable(<X>)` call and the `<X>Fields` object literal it points at, then attribute each `v.id("_storage")` line inside that literal to the table key derived from the surrounding `export const <key>Table = defineTable(<X>)` line.

Sketch:

```ts
// For each schema.ts file:
//   1. Find every `export const <key>Table = defineTable(<fieldsVar>)`
//   2. Find each `<fieldsVar> = { ... }` block and its line range
//   3. Inside each block, scan for `v.id("_storage")` field declarations
//   4. Attribute the match to <key> (the table-variable prefix)
```

Then look up `<key>` in `convex/schema.ts`'s `defineSchema({...})` map to confirm the registered table name (the LHS of the `<tableKey>: <key>Table` entry). For the current schema, `<key>Table` and `<tableKey>` already match by convention, so the schema-map lookup is a belt-and-braces sanity check rather than a different source of truth.

- **Effort:** Small
- **Risk:** Low (test-file change, no runtime impact)

## Implementation Steps

1. Read `packages/convex/convex/content/__tests__/orphanSweep.test.ts:280-325` and confirm the current shape of `SchemaStorageRef` / `findSchemaStorageRefs`.
2. Add a helper that parses `<fieldsVar> = { ... }` blocks and `defineTable(<fieldsVar>)` callsites from each schema file, returning a map from line ranges to `{ table, field }` tuples.
3. Replace the inner loop at lines 308-322 so each `v.id("_storage")` match is attributed via the line-range map instead of `path.basename(path.dirname(file))`.
4. Add a new test in the same `describe` block: "introspector attributes multiple tables in the same schema file correctly" — assert that running the helper against `articles/schema.ts` returns both `articles.coverImageStorageId` and `coverImageOwnership.storageId`, and that no key is `articles.storageId`.
5. Run `pnpm --filter=@feel-good/convex test orphanSweep` and confirm 8/8 pass.
6. Run `pnpm --filter=@feel-good/convex test` and confirm the previously-stuck-at-1-failure suite is now fully green (modulo any other unrelated pre-existing failures).

## Constraints

- Test-file-only change. Do not modify `packages/convex/convex/content/storageRegistry.ts`, the orphan-sweep cron, or any schema file.
- The helper should not depend on TypeScript compiler APIs — simple regex/line-range scanning is sufficient and matches the existing implementation style at lines 308-322.
- Keep `findSchemaStorageRefs`'s public shape (`SchemaStorageRef[]`) unchanged; existing callers and the FR-10 set-equality test must still consume the same shape.

## Resources

- Failing test: `packages/convex/convex/content/__tests__/orphanSweep.test.ts:327-351` (FR-10 set-equality assertion).
- Current introspector: `packages/convex/convex/content/__tests__/orphanSweep.test.ts:286-325`.
- Storage registry (must NOT change): `packages/convex/convex/content/storageRegistry.ts:47-83`.
- Schema source of the bug: `packages/convex/convex/articles/schema.ts:39-46` (`coverImageOwnershipFields` + `coverImageOwnershipTable`).
- Confirmed failing on pristine main HEAD `ecc5e7dc` by running the test in `/Users/disquiet/Desktop/mirror` (main worktree) — independent of any branch.
