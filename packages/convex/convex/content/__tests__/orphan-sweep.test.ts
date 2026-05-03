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
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { ORPHAN_GRACE_MS } from "../storage-policy";
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
 * Parses `defineTable({...})` blocks from Convex *_schema.ts_*-shaped files
 * and finds keys whose value contains `v.id("_storage")`. Tables here are
 * inferred by file convention: `<dir>/schema.ts` defines `<dir>` table.
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
    for (const line of lines) {
      const match = line.match(
        /(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)/,
      );
      if (match) {
        // Infer the table name from the directory the schema lives in.
        const tableDir = path.basename(path.dirname(file));
        out.push({ file, table: tableDir, field: match[1]! });
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

    // Canonical key shape: `<table>.<field>`. Build the same shape from
    // BOTH the schema source AND the scalar entries in
    // `STORAGE_FIELD_REFERENCES`, then assert set equality. No description
    // substring matching — `field` is the load-bearing key.
    const declaredKeys = new Set(
      declared.map((d) => `${d.table}.${d.field}`),
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
    const re = /(\w+)\s*:\s*v\.(?:optional\(\s*v\.)?id\("_storage"\)/;
    expect(re.exec('  coverImageStorageId: v.id("_storage"),')?.[1]).toBe(
      "coverImageStorageId",
    );
    expect(
      re.exec('  coverImageStorageId: v.optional(v.id("_storage")),')?.[1],
    ).toBe("coverImageStorageId");
    // Negative: function-arg shape (no leading field name + colon) should
    // not match. The introspection harness already filters non-schema.ts
    // files, but pinning the regex shape itself keeps it tight.
    expect(re.exec('args: { storageId: v.id("_storage") }')?.[1]).toBe(
      "storageId",
    );
  });
});
