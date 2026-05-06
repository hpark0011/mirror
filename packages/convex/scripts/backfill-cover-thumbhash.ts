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
 */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import { rgbaToThumbHash } from "thumbhash";
import sharp from "sharp";
import { type FunctionReference, type DefaultFunctionArgs } from "convex/server";
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
// "internal", so we also cast them through FunctionReference<"query" | "mutation">
// with the correct visibility erased. The runtime behaviour is correct because
// setAdminAuth lifts the visibility restriction server-side.
// ---------------------------------------------------------------------------

const client = new ConvexHttpClient(convexUrl);
(client as unknown as { setAdminAuth: (token: string) => void }).setAdminAuth(
  deployKey,
);

// Helper to cast internal function refs to the public visibility that
// ConvexHttpClient.query / .mutation expect at compile time.
function asPublicQuery<Args extends DefaultFunctionArgs, Returns>(
  ref: FunctionReference<"query", "internal", Args, Returns>,
): FunctionReference<"query", "public", Args, Returns> {
  return ref as unknown as FunctionReference<"query", "public", Args, Returns>;
}

function asPublicMutation<Args extends DefaultFunctionArgs, Returns>(
  ref: FunctionReference<"mutation", "internal", Args, Returns>,
): FunctionReference<"mutation", "public", Args, Returns> {
  return ref as unknown as FunctionReference<
    "mutation",
    "public",
    Args,
    Returns
  >;
}

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
      asPublicQuery(internal.articles.queries.getCoverUrl),
      { storageId: a.coverImageStorageId },
    );

    if (url === null) {
      console.warn(`  [skip] ${a._id} — storage URL resolved to null`);
      return { status: "skipped" };
    }

    // Fetch the image bytes
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} fetching cover for ${a._id}: ${url}`,
      );
    }
    const buf = Buffer.from(await response.arrayBuffer());

    // Downscale to at most 100px on the longest side, get raw RGBA pixels
    const { data, info } = await sharp(buf)
      .resize({ width: 100, height: 100, fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Encode thumbhash and convert to base64
    const hashBytes = rgbaToThumbHash(info.width, info.height, data);
    const thumbhash = Buffer.from(hashBytes).toString("base64");

    // Persist via the internal mutation
    await client.mutation(
      asPublicMutation(internal.articles.mutations.setCoverImageThumbhash),
      { id: a._id, thumbhash },
    );

    console.log(`  [ok]   ${a._id}`);
    return { status: "ok" };
  } catch (err) {
    console.error(
      `  [err]  ${a._id} — ${err instanceof Error ? err.message : String(err)}`,
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `Backfill cover thumbhashes${dryRun ? " (DRY RUN — no mutations)" : ""}`,
  );
  console.log(`  Convex URL: ${convexUrl}\n`);

  const articles = await client.query(
    asPublicQuery(internal.articles.queries.listMissingThumbhash),
    {},
  );

  console.log(`Found ${articles.length} article(s) needing thumbhash`);

  if (articles.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\nArticle IDs that would be backfilled:");
    for (const a of articles) {
      console.log(`  ${a._id}`);
    }
    console.log("\nDry run complete — no mutations executed.");
    return;
  }

  // Process in chunks of CHUNK_SIZE for bounded concurrency
  let backfilled = 0;
  let skipped = 0;
  let errored = 0;

  const chunks = chunk(articles as Array<ArticleRow>, CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i]!;
    console.log(
      `\nChunk ${i + 1}/${chunks.length} (${currentChunk.length} articles)`,
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
