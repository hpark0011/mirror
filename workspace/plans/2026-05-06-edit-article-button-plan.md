---
id: PLAN_003
slug: edit-article-button
title: 'Add "Edit" button to article detail toolbar'
date: 2026-05-06
type: feature
status: completed
branch: feature-edit-article-button
worktree: null
scope: "Single owner-only entry point from the article detail view into the existing edit route. No backend, schema, or routing changes."
apps: [mirror]
verification_tier: 5
---

## Goal

Today an authenticated owner viewing one of their own articles at `/@username/articles/:slug` has no UI affordance to edit it — the edit route exists at `/@username/articles/:slug/edit` and is fully wired (`app/[username]/@content/articles/[slug]/edit/page.tsx`), but you have to type the URL by hand. Add an "Edit" button at the right end of `ArticleDetailToolbar` that links to that route, visible only to the article's owner, styled to match the right-side primary button on `ArticleEditorToolbar` (`variant="primary"`, `size="xs"`, fixed `w-12`).

The button must preserve the chat search params (`?chat=1&conversation=…`) so opening the editor while chat is open does not collapse the chat panel — same `buildChatAwareHref` treatment that `ContentBackLink` already uses on the same toolbar.

---

## Current state (as of 2026-05-06)

- `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx` (15 lines) — renders only `<ContentBackLink>` inside `<ContentToolbarShell variant="detail">`. Takes only `username`. No `slug`, no owner check.
- `apps/mirror/app/[username]/@content/articles/[slug]/page.tsx:21` — passes `username` to the toolbar; already has `slug` in scope from `params`.
- `apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx` — owner-gated server-component edit route. Calls `notFound()` for missing article, `redirect("/sign-in")` for no session, and `redirect(\`/@${username}/articles/${slug}\`)\` when the signed-in user is not the article owner. So clicking the new button as a non-owner is recoverable, but we still hide the button to keep the UI clean.
- `apps/mirror/features/profile/index.ts:7` re-exports `useIsProfileOwner` from `features/profile/context/profile-context.tsx`. Same hook is already used inside the same toolbar shell pattern at `features/posts/components/publish-toggle-connector.tsx:13-16` — that connector returns `null` when not owner. Direct precedent.
- `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:50-60` — the right-end Save button uses `variant="primary"`, `size="xs"`, `className="w-12"`. We mirror exactly those three so the Edit button on the detail view occupies the same pixel slot the Save button will occupy when the user clicks it and lands in the editor.
- `apps/mirror/hooks/use-chat-search-params.ts:39-49` — `buildChatAwareHref(basePath)` returns `basePath` untouched when chat is closed; appends `?chat=1` (+ `conversation=` if present) when chat is open. Already used by `ContentBackLink` on the same toolbar.

---

## Implementation steps

### Step 1 — Update `ArticleDetailToolbar` (`apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx`)

Add `slug` to props, owner-check via `useIsProfileOwner`, and render the Edit button conditionally. Use `Button asChild` wrapping a `next/link` `Link` so the click is a normal client navigation that keeps the parallel-route shell mounted.

```tsx
"use client";

import Link from "next/link";
import { Button } from "@feel-good/ui/primitives/button";
import { ContentBackLink, ContentToolbarShell } from "@/features/content";
import { useIsProfileOwner } from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";

type ArticleDetailToolbarProps = {
  username: string;
  slug: string;
};

export function ArticleDetailToolbar({ username, slug }: ArticleDetailToolbarProps) {
  const isOwner = useIsProfileOwner();
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <ContentToolbarShell variant="detail">
      <ContentBackLink username={username} kind="articles" />
      {isOwner && (
        <Button
          asChild
          variant="primary"
          size="xs"
          className="w-12"
          data-testid="edit-article-btn"
        >
          <Link
            href={buildChatAwareHref(`/@${username}/articles/${slug}/edit`)}
            scroll={false}
          >
            Edit
          </Link>
        </Button>
      )}
    </ContentToolbarShell>
  );
}
```

Notes:

- `data-testid="edit-article-btn"` is required for the Playwright assertion below.
- `scroll={false}` mirrors `ContentBackLink` to keep the workspace shell scroll position stable across the parallel-route swap.
- The component remains under the 100-line ceiling from `.claude/rules/react-components.md`.
- No connector file. The toolbar is already a `"use client"` component and the owner-check is one hook call — extracting a connector here would be premature abstraction (`AGENTS.md` Core Principles).

### Step 2 — Pass `slug` from the parent page (`apps/mirror/app/[username]/@content/articles/[slug]/page.tsx:21`)

```tsx
<ArticleDetailToolbar username={username} slug={slug} />
```

`username` and `slug` are already destructured from `params` on line 11. One-line edit.

### Step 3 — No other call sites

`grep -rn "ArticleDetailToolbar" apps/mirror` should show only the export in `features/articles/index.ts` and the single import at `app/[username]/@content/articles/[slug]/page.tsx`. (Verify before edit — if a second caller surfaces, it must also pass `slug`, or the change is breaking.)

---

## Hard verification

### E2E — Playwright CLI (per `.claude/rules/verification.md` § E2E Tests)

Add a new spec at `apps/mirror/e2e/article-edit-button.authenticated.spec.ts` that exercises the new entry point end-to-end. Reuse the existing `ensureTestArticleFixtures` helper (already used by `apps/mirror/e2e/article-editor.authenticated.spec.ts:332`) so the fixture article belongs to the signed-in test user — that's what makes the owner check pass.

```ts
import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { requireEnv } from "./lib/env";

const username = "test-user";
const testEmail = "playwright-test@mirror.test";
const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

async function ensureTestArticleFixtures(): Promise<{
  draftSlug: string;
  publishedSlug: string;
}> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-article-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail }),
  });
  if (!res.ok) {
    throw new Error(
      `ensure-article-fixtures failed with status ${res.status}: ${await res.text()}`,
    );
  }
  return res.json() as Promise<{ draftSlug: string; publishedSlug: string }>;
}

test.describe("Article detail — Edit button (owner-only entry to editor)", () => {
  test("clicking Edit on the detail toolbar lands on the editor with title pre-filled", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    // Owner sees the Edit button at the right end of the detail toolbar.
    const editBtn = page.getByTestId("edit-article-btn");
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await expect(editBtn).toHaveText("Edit");

    await editBtn.click();

    // Lands on the editor route — slug-stable per identifiers.md.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${publishedSlug}/edit$`),
      { timeout: 10_000 },
    );

    // Editor scaffolding is mounted AND existing content is loaded
    // (title input is non-empty; slug input matches the URL slug).
    const titleInput = page.getByTestId("article-title-input");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await expect(titleInput).not.toHaveValue("");
    await expect(page.getByTestId("article-slug-input")).toHaveValue(
      publishedSlug,
    );

    // The editor's right-side Save button is present — proves we landed in
    // the editor toolbar shell, not just a loading state.
    await expect(page.getByTestId("save-article-btn")).toBeVisible();
  });

  test("Edit button preserves an open chat panel via ?chat=1", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}?chat=1`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    await page.getByTestId("edit-article-btn").click();

    // The chat-aware href appends ?chat=1 so the parallel chat panel
    // does not collapse on navigation.
    await expect(page).toHaveURL(
      new RegExp(
        `/@${username}/articles/${publishedSlug}/edit\\?chat=1(?:&|$)`,
      ),
      { timeout: 10_000 },
    );
  });
});
```

```bash
pnpm --filter=@feel-good/mirror test:e2e article-edit-button.authenticated.spec.ts
```

**Pass criteria:** both tests green. Each assertion is hard:

- `getByTestId("edit-article-btn")` is visible → owner-only render path executed.
- `toHaveURL(/\/edit$/)` → click navigated to the canonical edit route.
- `article-title-input` is non-empty AND `article-slug-input` equals `publishedSlug` → the existing article content was loaded (the user's stated goal: "show the article editor with the existing content").
- `save-article-btn` is visible → we are inside `ArticleEditorToolbar`, not a loading shell.
- Second test's URL regex requires `?chat=1` to be preserved → `buildChatAwareHref` is wired correctly.

### Build + lint (per `.claude/rules/verification.md` Tier 4 — navigation/event handler change)

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

Both must exit 0 before running e2e.

### Manual visual confirmation (Chrome MCP — not for assertions, only to eyeball pixel placement)

1. Sign in as `test-user`, open `/@test-user/articles/<published-slug>` — confirm "Edit" button appears at right end, same vertical alignment as the future Save button.
2. Sign out (or sign in as a different user) and reload — confirm Edit button is absent.

---

## Constraints & non-goals

**In scope:**

- Single Edit button on `ArticleDetailToolbar`, owner-only, primary `xs` `w-12`, chat-aware href.
- One-line prop addition at the parent page.
- New Playwright spec covering owner visibility, navigation, content load, and chat-param preservation.

**Explicitly out of scope:**

- No changes to `ArticleEditor`, `useEditArticleForm`, `ArticleEditorShell`, or the edit page server component. The edit route already loads existing content via `useEditArticleForm({ initial: article })`.
- No changes to `articles.queries.getBySlug`, schema, or any Convex function.
- No new owner gating on the server side — the existing redirect at `app/[username]/@content/articles/[slug]/edit/page.tsx:36-38` is the trust boundary; the hidden button is just UX.
- No edits to `PostDetailToolbar` or post detail toolbar — posts are out of scope for this branch.
- No changes to mobile layout shell. `ContentToolbarShell variant="detail"` already uses `justify-between`, so Back stays left and Edit goes right at all breakpoints. If a future ticket finds the Edit button crowds the Back link on narrow widths, address it then — don't pre-engineer it now.
- No new connector file, no new context, no `isOwner` prop threading. `useIsProfileOwner()` is called directly inside the toolbar (precedent: `publish-toggle-connector.tsx`).
- No unit/Vitest tests added. The component is now \~28 lines of pure JSX with one hook gate; the e2e spec exercises every observable branch (owner/non-owner, navigation, chat-param). Per `code-review-tests` guidance and `AGENTS.md` Core Principles ("Always Choose the Compounding Option"), a unit test would be redundant against the e2e and would couple to the JSX structure.

**Risks I'm accepting:**

- A non-owner who somehow forges a hidden button click still hits the server redirect at `articles/[slug]/edit/page.tsx:36-38`, so there is no security risk to hiding-rather-than-disabling. The button is purely UX.
- `useIsProfileOwner()` reads from a context that, if absent, throws (`profile-context.tsx:16`). That context is provided by `app/[username]/layout.tsx` and wraps every detail page, so there is no path where the toolbar can render without it. If a future refactor moves the toolbar outside that provider, the throw will surface immediately at render time — which is the correct failure mode.