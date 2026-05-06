/**
 * One-shot backfill: generates thumbhash LQIP for every article that has a
 * cover image but is missing a coverImageThumbhash value.
 *
 * Run:
 *   pnpm --filter=@feel-good/convex exec tsx scripts/backfill-cover-thumbhash.ts [--dry-run]
 *
 * Requirements:
 *   - CONVEX_URL env var must be set (e.g. https://happy-animal-123.convex.cloud)
 *   - CONVEX_DEPLOY_KEY env var must be set for admin auth (used to call internal
 *     functions). Pass it shell-scoped:
 *       CONVEX_URL=... CONVEX_DEPLOY_KEY=dev:... pnpm --filter=@feel-good/convex exec tsx scripts/backfill-cover-thumbhash.ts
 *
 * Idempotent: listMissingThumbhash only returns articles where
 * coverImageStorageId is set AND coverImageThumbhash is undefined, so
 * re-running skips already-backfilled rows.
 *
 * Dependencies:
 *   - sharp / thumbhash: declared in `packages/convex/package.json` devDeps for now.
 *     They are script-only — not imported from `convex/`. If you split scripts/ into
 *     its own workspace, move them there.
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import { rgbaToThumbHash } from "thumbhash";
import sharp from "sharp";
import { type FunctionReference } from "convex/server";
import { type Id } from "../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes("--dry-run");

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) {
  console.error(
    "Error: CONVEX_URL is not set. Export it before running this script:\n" +
      "  CONVEX_URL=https://happy-animal-123.convex.cloud CONVEX_DEPLOY_KEY=dev:... " +
      "pnpm --filter=@feel-good/convex exec tsx scripts/backfill-cover-thumbhash.ts",
  );
  process.exit(1);
}

const deployKey = process.env.CONVEX_DEPLOY_KEY;
if (!deployKey) {
  console.error(
    "Error: CONVEX_DEPLOY_KEY is not set. The backfill calls internal Convex\n" +
      "functions that require admin auth. Pass it shell-scoped — do NOT put it\n" +
      "in .env.local (see .claude/rules/auth.md).\n" +
      "  CONVEX_URL=... CONVEX_DEPLOY_KEY=dev:... pnpm --filter=@feel-good/convex exec tsx scripts/backfill-cover-thumbhash.ts",
  );
  process.exit(1);
}

// Hard guard against accidentally pointing this at production. Dev deploy
// keys start with `dev:`; prod keys do not. The `--force-prod` flag is the
// explicit override for the rare case where this is intentional.
if (!deployKey.startsWith("dev:") && !process.argv.includes("--force-prod")) {
  console.error(
    "Error: CONVEX_DEPLOY_KEY does not start with 'dev:' — refusing to run against a non-dev deployment.\n" +
      "Pass --force-prod to override (and confirm CONVEX_URL points where you intend).",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Convex client — admin auth via deploy key
//
// setAdminAuth is a runtime method on ConvexHttpClient that is not reflected
// in the public TypeScript type declarations (it's marked `private adminAuth`
// in the .d.ts). We reach it through a cast. The Authorization header it sets
// is `Convex <deployKey>`, which the Convex backend accepts for internal
// function calls.
//
// ConvexHttpClient.query / .mutation are typed to only accept public function
// references at the TypeScript level. Our internal functions have visibility
// "internal", so each call site casts the ref through FunctionReference with
// visibility "public". The runtime behaviour is correct because setAdminAuth
// lifts the visibility restriction server-side.
// ---------------------------------------------------------------------------

const client = new ConvexHttpClient(convexUrl);
(client as unknown as { setAdminAuth: (token: string) => void }).setAdminAuth(
  deployKey,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 8;

function chunk<T>(arr: ReadonlyArray<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size) as Array<T>);
  }
  return chunks;
}

type ArticleRow = {
  _id: Id<"articles">;
  coverImageStorageId: Id<"_storage">;
};

type ProcessResult = { status: "ok" | "skipped" | "error" };

async function processArticle(a: ArticleRow): Promise<ProcessResult> {
  try {
    const url = await client.query(
      internal.articles.queries.getCoverUrl as unknown as FunctionReference<
        "query",
        "public",
        { storageId: Id<"_storage"> },
        string | null
      >,
      { storageId: a.coverImageStorageId },
    );

    if (url === null) {
      console.warn(`  [skip] ${a._id} — storage URL resolved to null`);
      return { status: "skipped" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} fetching cover for ${a._id}: ${url}`,
      );
    }
    const buf = Buffer.from(await response.arrayBuffer());

    const { data, info } = await sharp(buf)
      .resize({ width: 100, height: 100, fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hashBytes = rgbaToThumbHash(info.width, info.height, data);
    const thumbhash = Buffer.from(hashBytes).toString("base64");

    await client.mutation(
      internal.articles.mutations
        .setCoverImageThumbhash as unknown as FunctionReference<
        "mutation",
        "public",
        {
          id: Id<"articles">;
          expectedStorageId: Id<"_storage">;
          thumbhash: string;
        },
        null
      >,
      {
        id: a._id,
        // The mutation refuses the patch if the article's current storageId
        // no longer matches — guards the race where the user replaces the
        // cover between our URL fetch + encode and this mutation.
        expectedStorageId: a.coverImageStorageId,
        thumbhash,
      },
    );

    console.log(`  [ok]   ${a._id}`);
    return { status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Stale-hash guard hit — the user replaced the cover mid-backfill. The
    // safe outcome is "no hash written for the new image yet"; the next
    // backfill run will pick it up. Log as `[skip]` rather than `[err]` so
    // the exit code stays clean.
    if (/Cover image changed during backfill/.test(msg)) {
      console.warn(`  [skip] ${a._id} — ${msg}`);
      return { status: "skipped" };
    }
    console.error(`  [err]  ${a._id} — ${msg}`);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Page size for the paginated `listMissingThumbhash` cursor loop. 200 keeps
// each query well under Convex's per-query document read limit while
// minimizing round-trip overhead.
const PAGE_SIZE = 200;

type ListMissingThumbhashRef = FunctionReference<
  "query",
  "public",
  { cursor: string | null; numItems: number },
  {
    page: Array<{ _id: Id<"articles">; coverImageStorageId: Id<"_storage"> }>;
    isDone: boolean;
    continueCursor: string;
  }
>;

async function main(): Promise<void> {
  console.log(
    `Backfill cover thumbhashes${dryRun ? " (DRY RUN — no mutations)" : ""}`,
  );
  console.log(`  Convex URL: ${convexUrl}\n`);

  let backfilled = 0;
  let skipped = 0;
  let errored = 0;
  let totalSeen = 0;
  let pageNumber = 0;

  let cursor: string | null = null;
  let isDone = false;

  // Cursor loop: each `listMissingThumbhash` call paginates the `articles`
  // table by `_creationTime`, then JS-filters to rows that have a cover
  // storageId but no thumbhash. A page can come back empty even when more
  // rows remain — keep paginating until `isDone` is true.
  while (!isDone) {
    pageNumber += 1;
    const result: {
      page: Array<{ _id: Id<"articles">; coverImageStorageId: Id<"_storage"> }>;
      isDone: boolean;
      continueCursor: string;
    } = await client.query(
      internal.articles.queries
        .listMissingThumbhash as unknown as ListMissingThumbhashRef,
      { cursor, numItems: PAGE_SIZE },
    );

    cursor = result.continueCursor;
    isDone = result.isDone;

    const articles = result.page as Array<ArticleRow>;
    totalSeen += articles.length;

    if (articles.length === 0) {
      continue;
    }

    console.log(
      `\nPage ${pageNumber} — ${articles.length} article(s) needing thumbhash`,
    );

    if (dryRun) {
      for (const a of articles) {
        console.log(`  ${a._id}`);
      }
      continue;
    }

    // Process each page in chunks of CHUNK_SIZE for bounded concurrency.
    const chunks = chunk(articles, CHUNK_SIZE);
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i]!;
      console.log(
        `  Chunk ${i + 1}/${chunks.length} (${currentChunk.length} articles)`,
      );
      const results = await Promise.all(
        currentChunk.map((a) => processArticle(a)),
      );
      for (const r of results) {
        if (r.status === "ok") backfilled++;
        else if (r.status === "skipped") skipped++;
        else errored++;
      }
    }
  }

  if (totalSeen === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\nDry run complete — no mutations executed.");
    return;
  }

  console.log(
    `\nDone. Backfilled ${backfilled} / Skipped ${skipped} / Errored ${errored}`,
  );
  if (errored > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
