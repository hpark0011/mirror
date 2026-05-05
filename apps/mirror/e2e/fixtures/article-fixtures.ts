import { requireEnv } from "../lib/env";

const TEST_EMAIL = "playwright-test@mirror.test";

export interface ArticleFixtures {
  draftSlug: string;
  publishedSlug: string;
}

export interface EnsureTestArticleFixturesOptions {
  /**
   * Per-spec key used to scope the draft slug. Required for any spec that
   * SAVES into the draft (paste, drop, replace, cascade-delete) so parallel
   * Playwright workers running sibling inline-image specs cannot pollute
   * each other's body assertions.
   *
   * Read-only specs (mime-limit, size-limit) also pass a key for uniformity:
   * the next reader of these files should not have to wonder why two specs
   * share when the others don't.
   *
   * The key must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` so the resulting slug
   * (`inline-<key>-fixture-draft`) passes the canonical slug pattern at
   * `packages/convex/convex/content/slug.ts`.
   *
   * When omitted, the legacy shared draft (`test-article-fixture-draft`) is
   * returned — preserved for any non-inline-image consumer of this helper.
   */
  key?: string;
}

/**
 * Single source of truth for the inline-image E2E specs' fixture draft.
 *
 * Calls the test-only `/test/ensure-article-fixtures` HTTP endpoint
 * (gated by `PLAYWRIGHT_TEST_SECRET`) which idempotently upserts a draft
 * (and a shared published) article owned by the test user, then returns
 * the slugs.
 *
 * Fixture-pollution context: see workspace ticket FG_154. Inlining this
 * helper into each spec (the previous shape) drifted between specs and
 * meant a single shared draft slug, which under default-parallel
 * Playwright execution let sibling specs overwrite each other's saved
 * bodies. Centralizing the helper here keeps the per-spec uniqueness
 * rule from drifting again.
 */
export async function ensureTestArticleFixtures(
  opts: EnsureTestArticleFixturesOptions = {},
): Promise<ArticleFixtures> {
  const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
  const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

  const body: { email: string; key?: string } = { email: TEST_EMAIL };
  if (opts.key !== undefined) body.key = opts.key;

  const res = await fetch(`${convexSiteUrl}/test/ensure-article-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `ensure-article-fixtures failed with status ${res.status}: ${await res.text()}`,
    );
  }
  return res.json() as Promise<ArticleFixtures>;
}
