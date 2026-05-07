/// <reference types="vite/client" />

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import { type Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { ORPHAN_GRACE_MS } from "../storagePolicy";
import { _internals, STORAGE_FIELD_REFERENCES } from "../../crons";

vi.mock("../../auth/client", () => ({
  authComponent: {
    getAuthUser: vi.fn(async () => {
      throw new Error("Not authenticated");
    }),
    safeGetAuthUser: vi.fn(async () => null),
  },
}));

function normalizeConvexGlob(
  raw: Record<string, () => Promise<unknown>>,
): Record<string, () => Promise<unknown>> {
  const out: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(raw)) {
    let k = key;
    if (k.startsWith("./")) {
      k = "../../content/__tests__/" + k.slice(2);
    } else if (k.startsWith("../") && !k.startsWith("../../")) {
      k = "../../content/" + k.slice(3);
    }
    out[k] = loader;
  }
  return out;
}

const rawModules = import.meta.glob("../../**/*.{ts,js}");
const modules = normalizeConvexGlob(rawModules);

function makeT() {
  return convexTest(schema, modules);
}

async function storeBlob(t: ReturnType<typeof makeT>, contents = "x") {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([contents])));
}

async function blobExists(
  t: ReturnType<typeof makeT>,
  id: Id<"_storage">,
): Promise<boolean> {
  return await t.run(async (ctx) => {
    return (await ctx.db.system.get(id)) !== null;
  });
}

// `_creationTime` on a blob is set when `ctx.storage.store` is called. To
// simulate "old" blobs without sleeping, we leverage `vi.useFakeTimers` and
// advance the system clock past `ORPHAN_GRACE_MS` between store calls. The
// sweep computes its cutoff from `Date.now()`, which the fake timers also
// affect.

describe("crons.sweepOrphanedStorage — FR-10", () => {
  it("deletes orphans older than ORPHAN_GRACE_MS not referenced by any record", async () => {
    const t = makeT();

    // Older orphans: store, then advance the clock so they fall outside the
    // grace window relative to "now".
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const orphanA = await storeBlob(t, "old-orphan-a");
    const orphanB = await storeBlob(t, "old-orphan-b");

    // Move forward 25h
    vi.setSystemTime(ORPHAN_GRACE_MS + 60 * 60 * 1000);

    // Younger orphan (just created) — must survive the sweep because it's
    // inside the grace window.
    const youngOrphan = await storeBlob(t, "young");

    const result = await t.mutation(
      internal.crons.sweepOrphanedStorage,
      {},
    );

    vi.useRealTimers();

    // Exact-2 contract per spec FR-10 — anything else (including deleting
    // `youngOrphan`) is a regression on the grace-window logic.
    expect(result.deleted).toBe(2);
    expect(await blobExists(t, orphanA)).toBe(false);
    expect(await blobExists(t, youngOrphan)).toBe(true);
    expect(await blobExists(t, orphanB)).toBe(false);
  });

  it("skips orphans younger than ORPHAN_GRACE_MS (dedicated, single-blob)", async () => {
    const t = makeT();

    vi.useFakeTimers();
    // Set "now" first, then store the blob — its `_creationTime` is set
    // from the (fake) clock at store time. With the clock unmoved, the
    // sweep's cutoff (now - ORPHAN_GRACE_MS) is BEFORE the blob's
    // creation, so the blob falls inside the grace window.
    vi.setSystemTime(2 * ORPHAN_GRACE_MS);
    const young = await storeBlob(t, "young-only");

    const result = await t.mutation(
      internal.crons.sweepOrphanedStorage,
      {},
    );

    vi.useRealTimers();

    expect(result.deleted).toBe(0);
    expect(await blobExists(t, young)).toBe(true);
  });

  it("skips referenced blobs (cover, inline, avatar)", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(0);

    // Seed referenced blobs.
    const cover = await storeBlob(t, "cover");
    const inline = await storeBlob(t, "inline");
    const avatar = await storeBlob(t, "avatar");
    const orphan = await storeBlob(t, "orphan");

    // Insert a user, an article, a post with these references.
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authId: "auth-sweep",
        email: "sweep@example.com",
        avatarStorageId: avatar,
        onboardingComplete: true,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        userId,
        slug: "ref-article",
        title: "Ref",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "image", attrs: { storageId: inline } },
              ],
            },
          ],
        },
        coverImageStorageId: cover,
        category: "general",
        status: "published",
        createdAt: 0,
      }),
    );

    // Advance past grace.
    vi.setSystemTime(ORPHAN_GRACE_MS + 60 * 60 * 1000);

    await t.mutation(internal.crons.sweepOrphanedStorage, {});

    vi.useRealTimers();

    expect(await blobExists(t, cover)).toBe(true);
    expect(await blobExists(t, inline)).toBe(true);
    expect(await blobExists(t, avatar)).toBe(true);
    expect(await blobExists(t, orphan)).toBe(false);
  });
});

describe("crons.sweepOrphanedStorage — pagination (NFR-02)", () => {
  it("processes 500 candidates across multiple pages and deletes them all", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(0);

    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 500; i++) {
      ids.push(await storeBlob(t, `orphan-${i}`));
    }

    vi.setSystemTime(ORPHAN_GRACE_MS + 60 * 60 * 1000);

    // Run the first page, then drain scheduled re-runs.
    await t.mutation(internal.crons.sweepOrphanedStorage, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    vi.useRealTimers();

    let alive = 0;
    for (const id of ids) {
      if (await blobExists(t, id)) alive += 1;
    }
    expect(alive).toBe(0);
  }, 30_000);

  // FG_102: the referenced-set is invariant within a single sweep run, so
  // recomputing it for every paginated `_storage` page would wastefully
  // re-scan the articles/posts/users tables P times. The first page should
  // compute it once, then thread it forward through `scheduler.runAfter` args
  // for continuation pages. This test seeds enough orphan blobs to guarantee
  // multiple pages (SWEEP_PAGE_SIZE=200), wraps `buildReferencedStorageSet`
  // with a counter, and asserts it ran exactly once across the entire
  // multi-page sweep run.
  it("computes the referenced-set exactly once across a multi-page sweep run", async () => {
    const t = makeT();

    vi.useFakeTimers();
    vi.setSystemTime(0);

    // 500 orphans → 3 pages at SWEEP_PAGE_SIZE=200 → 1 first page + 2
    // continuations. Pre-FG_102 this would invoke buildReferencedStorageSet 3
    // times; post-FG_102, exactly once.
    for (let i = 0; i < 500; i++) {
      await storeBlob(t, `orphan-${i}`);
    }

    vi.setSystemTime(ORPHAN_GRACE_MS + 60 * 60 * 1000);

    const realBuilder = _internals.buildReferencedStorageSet;
    const builderSpy = vi.fn(realBuilder);
    _internals.buildReferencedStorageSet = builderSpy;

    try {
      await t.mutation(internal.crons.sweepOrphanedStorage, {});
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    } finally {
      _internals.buildReferencedStorageSet = realBuilder;
      vi.useRealTimers();
    }

    expect(builderSpy).toHaveBeenCalledTimes(1);
  }, 30_000);
});

// -----------------------------------------------------------------------
// Schema-introspection regression test: enumerate every `v.id("_storage")`
// occurrence in the convex/ schema source tree and confirm each matches one
// entry in `STORAGE_FIELD_REFERENCES`. This means: adding a new storage-
// bearing field anywhere in the schema without updating `crons.ts` will
// fail this test.
// -----------------------------------------------------------------------

const CONVEX_DIR = path.resolve(__dirname, "../../");

function walkConvexFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    if (entry === "_generated" || entry === "__tests__") continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkConvexFiles(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
}

type SchemaStorageRef = {
  file: string;
  // Absolute file path's basename for log/snapshot readability.
  table: string;
  field: string;
};

/**
 * Build a map from line index → table key. Handles two schema patterns:
 *
 *   Pattern A — named fields variable:
 *     export const <fieldsVar>Fields = { ... };
 *     export const <tableKey>Table = defineTable(<fieldsVar>Fields)
 *
 *   Pattern B — inline object literal:
 *     export const <tableKey>Table = defineTable({
 *       ...
 *     })
 *
 * For Pattern A, first build a fieldsVar→tableKey map from defineTable(...)
 * calls, then track the line range of each `<fieldsVar>Fields = { ... }` block.
 * For Pattern B, track the line range of the inline `{ ... }` inside the
 * `defineTable({...})` call.
 *
 * Each line inside a tracked block maps to the table key that owns that block.
 */
function buildLineToTableMap(lines: string[]): Map<number, string> {
  const lineToTable = new Map<number, string>();

  // Pass 1: find all defineTable(...) calls and what they bind to.
  // Pattern A: defineTable(<varName>) — named variable reference.
  // Pattern B: defineTable({ — inline object literal opened on this line.
  const defineTableNamedRe =
    /export\s+const\s+(\w+)Table\s*=\s*defineTable\(\s*(\w+)\s*\)/;
  const defineTableInlineRe =
    /export\s+const\s+(\w+)Table\s*=\s*defineTable\(\s*\{/;

  // Map: fieldsVarName → tableKey (for Pattern A).
  const fieldsVarToTable = new Map<string, string>();
  // List of {lineIdx, tableKey} for inline defineTable starts (Pattern B).
  const inlineStarts: Array<{ lineIdx: number; tableKey: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const mNamed = line.match(defineTableNamedRe);
    if (mNamed) {
      fieldsVarToTable.set(mNamed[2]!, mNamed[1]!);
      continue;
    }
    const mInline = line.match(defineTableInlineRe);
    if (mInline) {
      inlineStarts.push({ lineIdx: i, tableKey: mInline[1]! });
    }
  }

  // Pass 2: track line ranges for Pattern A blocks.
  // Scan for `export const <name> = {` where <name> is in fieldsVarToTable.
  const blockStartRe = /^(export\s+const\s+)(\w+)\s*=\s*\{/;

  {
    let activeTable: string | null = null;
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (activeTable !== null) {
        for (const ch of line) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        lineToTable.set(i, activeTable);
        if (depth <= 0) {
          activeTable = null;
          depth = 0;
        }
      } else {
        const m = line.match(blockStartRe);
        if (m) {
          const varName = m[2]!;
          const tableKey = fieldsVarToTable.get(varName);
          if (tableKey !== undefined) {
            activeTable = tableKey;
            depth = 0;
            for (const ch of line) {
              if (ch === "{") depth++;
              else if (ch === "}") depth--;
            }
            lineToTable.set(i, activeTable);
          }
        }
      }
    }
  }

  // Pass 3: track line ranges for Pattern B inline blocks.
  // For each inline defineTable({ ... }) start, count from the opening `{`
  // until the matching `}` to find the block's extent.
  for (const { lineIdx, tableKey } of inlineStarts) {
    let depth = 0;
    let started = false;

    for (let i = lineIdx; i < lines.length; i++) {
      const line = lines[i]!;
      for (const ch of line) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") {
          depth--;
        }
      }
      // Mark lines inside the inline object literal (depth > 0 after the
      // first `{`; the block starts inside the `defineTable({` line itself
      // but we only want interior lines that can contain field declarations).
      if (started && depth > 0) {
        lineToTable.set(i, tableKey);
      }
      if (started && depth <= 0) {
        break;
      }
    }
  }

  return lineToTable;
}

/**
 * Parses `defineTable({...})` blocks from Convex *_schema.ts_*-shaped files
 * and finds keys whose value contains `v.id("_storage")`. Tables are inferred
 * by matching each `v.id("_storage")` line against the line-range of the
 * object literal that is bound to a table via `defineTable(...)` — NOT from
 * the file's parent directory, which would mis-attribute fields when multiple
 * tables share a single schema file (e.g. articles/schema.ts defines both
 * `articlesTable` and `coverImageOwnershipTable`).
 */
function findSchemaStorageRefs(): SchemaStorageRef[] {
  const out: SchemaStorageRef[] = [];
  const files: string[] = [];
  walkConvexFiles(CONVEX_DIR, files);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes('v.id("_storage")')) continue;
    // Only consider files whose basename is `schema.ts` — those declare the
    // shape of a table. Mutation/action files use `v.id("_storage")` in
    // function args, which are NOT persisted fields.
    if (path.basename(file) !== "schema.ts") continue;

    // Walk the file line-by-line; record `<key>: ... v.id("_storage")`
    // (also handles `v.optional(v.id("_storage"))`).
    //
    // FG_114: the optional group consumes the WHOLE `optional(\s*v.`
    // prefix when present, so the literal `id("_storage")` is what
    // follows in both required and optional forms. The previous regex
    // (`v\.(?:optional\(\s*)?v\.id`) matched only the optional form
    // because the trailing `v.` was unconditional — required fields
    // (`coverImageStorageId: v.id("_storage")`) silently slipped past
    // the introspection set, opening the cron sweep to delete their blobs.
    const lines = text.split("\n");

    // Build the line→table attribution map for this file.
    const lineToTable = buildLineToTableMap(lines);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Anchored to the line so we only match top-level schema fields —
      // `<key>: v.id("_storage"),` — and reject inline shapes like
      // `args: { storageId: v.id("_storage") }`. The optional `\)?` swallows
      // the closing paren of `v.optional(...)`.
      const match = line.match(
        /^\s*(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)\)?\s*,?\s*$/,
      );
      if (match) {
        const table = lineToTable.get(i);
        if (table !== undefined) {
          out.push({ file, table, field: match[1]! });
        }
        // If no table mapping exists for this line, the field is inside a
        // block that isn't bound to a `defineTable(...)` call (e.g. inline
        // args validators) — intentionally skipped.
      }
    }
  }
  return out;
}

describe("STORAGE_FIELD_REFERENCES — schema-introspection regression test (FR-10)", () => {
  it("covers every v.id(\"_storage\") field declared in the schema (set equality on canonical <table>.<field> keys)", () => {
    const declared = findSchemaStorageRefs();
    // Sanity: must have found at least the known three (articles cover,
    // posts cover, users avatar).
    expect(declared.length).toBeGreaterThanOrEqual(3);

    // Intentional non-sweep exclusions: tables whose `v.id("_storage")` fields
    // are ownership/metadata rows — NOT live blob references — and therefore
    // must NOT appear in STORAGE_FIELD_REFERENCES (sweep would treat them as
    // keep-forever anchors). Each entry must have a documented rationale.
    //
    // FG_147: coverImageOwnership.storageId tracks who uploaded a cover image.
    // Adding it to STORAGE_FIELD_REFERENCES would prevent the sweep from ever
    // reclaiming abandoned upload blobs — which is the exact opposite of what
    // the sweep is for.
    const INTENTIONAL_NON_SWEEP_FIELDS = new Set([
      "coverImageOwnership.storageId",
    ]);

    // Canonical key shape: `<table>.<field>`. Build the same shape from
    // BOTH the schema source AND the scalar entries in
    // `STORAGE_FIELD_REFERENCES`, then assert set equality. No description
    // substring matching — `field` is the load-bearing key.
    const declaredKeys = new Set(
      declared
        .map((d) => `${d.table}.${d.field}`)
        .filter((k) => !INTENTIONAL_NON_SWEEP_FIELDS.has(k)),
    );
    const coveredKeys = new Set(
      STORAGE_FIELD_REFERENCES.filter((r) => r.kind === "scalar").map(
        (r) => `${r.table}.${r.field}`,
      ),
    );

    // Bidirectional check: declared ⊂ covered AND covered ⊂ declared.
    const uncovered = [...declaredKeys].filter((k) => !coveredKeys.has(k));
    const stale = [...coveredKeys].filter((k) => !declaredKeys.has(k));
    expect({ uncovered, stale }).toEqual({ uncovered: [], stale: [] });
  });

  it("references the same scalar tables in `STORAGE_FIELD_REFERENCES`", () => {
    // Snapshot: scalar entries in a stable shape so an unintentional removal
    // shows up as a diff.
    const scalars = STORAGE_FIELD_REFERENCES.filter((r) => r.kind === "scalar")
      .map((r) => r.description)
      .sort();
    expect(scalars).toEqual([
      "articles.coverImageStorageId",
      "posts.coverImageStorageId",
      "users.avatarStorageId",
    ]);

    const inline = STORAGE_FIELD_REFERENCES.filter(
      (r) => r.kind === "inline-body",
    )
      .map((r) => r.description)
      .sort();
    expect(inline).toEqual([
      "articles.body inline image storageIds",
      "posts.body inline image storageIds",
    ]);
  });

  it("findSchemaStorageRefs regex matches both required and optional storage fields (FG_114)", () => {
    // Test-of-the-test: pin the regex against the two source-line shapes
    // schema files actually use. Without this, a regression that breaks
    // either form would pass the bidirectional check today (every current
    // field is optional) and silently fail the day someone adds a
    // required `v.id("_storage")` field.
    const re =
      /^\s*(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)\)?\s*,?\s*$/;
    expect(re.exec('  coverImageStorageId: v.id("_storage"),')?.[1]).toBe(
      "coverImageStorageId",
    );
    expect(
      re.exec('  coverImageStorageId: v.optional(v.id("_storage")),')?.[1],
    ).toBe("coverImageStorageId");
    // Negative: function-arg shape (no leading field name + colon at the
    // start of a line) should not match. The introspection harness already
    // filters non-schema.ts files, but pinning the regex shape itself keeps
    // it tight against future drift.
    expect(
      re.exec('args: { storageId: v.id("_storage") }')?.[1],
    ).toBeUndefined();
  });

  it("introspector attributes multiple tables in the same schema file correctly (FG_164)", () => {
    // articles/schema.ts defines two tables: articlesTable (coverImageStorageId)
    // and coverImageOwnershipTable (storageId). The introspector must attribute
    // each field to its actual table, not the containing directory ("articles").
    const refs = findSchemaStorageRefs();
    const keys = refs.map((r) => `${r.table}.${r.field}`);

    // coverImageOwnership.storageId must be attributed correctly.
    expect(keys).toContain("coverImageOwnership.storageId");

    // articles.storageId is NOT a real field — directory-based inference
    // would produce it, but the correct introspector must NOT.
    expect(keys).not.toContain("articles.storageId");

    // The articles table's real storage field must still be found.
    expect(keys).toContain("articles.coverImageStorageId");
  });
});
