---
id: PLAN_007
slug: unify-workspace-back-button
title: "Unify the workspace toolbar back button"
date: 2026-05-06
type: refactor
status: completed
branch: feature-edit-article-button
worktree: null
scope: "Replace the two diverging Back implementations across workspace toolbars with a single WorkspaceBackButton component matching the article-editor visual spec."
apps: [mirror]
verification_tier: 5
---

## Goal

Three workspace toolbars render a "Back" affordance today, and they look different:

| Surface | Current implementation | Icon | Size | Wrapping element |
|---|---|---|---|---|
| `post-detail-toolbar.tsx` | `<ContentBackLink>` | `ArrowLeftCircleFillIcon` (circle) | `size-5.5` | bare `<Link>` |
| `article-detail-toolbar.tsx` | `<ContentBackLink>` | `ArrowLeftCircleFillIcon` (circle) | `size-5.5` | bare `<Link>` |
| `article-editor-toolbar.tsx` | inline `<Button variant="wrapper" size="wrapper-xs">` | `ArrowshapeLeftFillIcon` (arrowshape) | `size-4.5` | `<button>` with `aria-label="Cancel"` |

The user's directive: collapse to **one** component using the editor's exact button spec —

```tsx
<Button
  type="button"
  variant="wrapper"
  size="wrapper-xs"
  onClick={onCancel}
  disabled={isSaving}
  aria-label="Cancel"
  className="gap-1.5 relative left-[-1px]"
>
  <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
  Back
</Button>
```

The new component, `WorkspaceBackButton`, is polymorphic: it renders as a **link** (anchor, role="link") when given an `href` and as a **button** (role="button") when given an `onClick`. Both modes share the exact visual spec above. This preserves the existing e2e selectors (`getByRole("link", { name: "Back" })`) while unifying the visual layer.

---

## Current state (as of 2026-05-06)

### Callsites

- **Detail toolbars (link mode targets):**
  - `apps/mirror/features/articles/components/detail/article-detail-toolbar.tsx:5,20` — imports `ContentBackLink`, calls `<ContentBackLink username={username} kind="articles" />`.
  - `apps/mirror/features/posts/components/post-detail-toolbar.tsx:3,15` — imports `ContentBackLink`, calls `<ContentBackLink username={username} kind="posts" />`.
- **Editor toolbar (action mode target):**
  - `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:29-42` — inline `<Button variant="wrapper" size="wrapper-xs">` block with `ArrowshapeLeftFillIcon`.

### Component to remove

- `apps/mirror/features/content/components/back-link.tsx` (29 lines, only `ContentBackLink` export).
- Re-export at `apps/mirror/features/content/index.ts:17`.

### Existing e2e coverage that depends on the back affordance

- `apps/mirror/e2e/article-navigation.spec.ts:162` — `getByRole("link", { name: "Back" }).click()` from article detail back to list.
- `apps/mirror/e2e/article-navigation.spec.ts:357` — same selector for post detail back to list.

Both depend on the back affordance being a **link with accessible name "Back"**. The new component preserves both invariants in link mode via `Button asChild` + `<Link>` (Slot pattern → child element wins, so DOM is `<a>`).

### Verified out-of-scope

- `apps/mirror/features/content/components/content-editor-toolbar.tsx` — has a "Cancel" link (variant="outline" size="xs") on the right side of the post editor toolbar. Different visual idea (no back-arrow, action-side, not workspace-back semantics). Not part of this unification.
- `apps/mirror/features/posts/components/post-editor.tsx` — uses `ContentEditor` → `ContentEditorToolbar` (above). No back-arrow button to unify.
- `packages/features/editor/components/editor-toolbar.tsx:60` — Tiptap **format** toolbar (bold/italic), uses `ArrowshapeLeftFillIcon` for a different navigation context. Not a workspace toolbar.
- `apps/mirror/features/waitlist/components/waitlist-form.tsx:101` — uses `ArrowLeftCircleFillIcon` in a form-step navigation. Not a workspace toolbar.

`grep -rn "ContentBackLink"` confirms exactly **two** consumers in `apps/mirror`, plus the export. No usage in `packages/`.

---

## Implementation steps

### Step 1 — Create `WorkspaceBackButton`

Path: `apps/mirror/features/content/components/workspace-back-button.tsx`

```tsx
"use client";

import Link from "next/link";
import { ArrowshapeLeftFillIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";

type WorkspaceBackButtonProps =
  | { href: string }
  | { onClick: () => void; disabled?: boolean; ariaLabel?: string };

export function WorkspaceBackButton(props: WorkspaceBackButtonProps) {
  if ("href" in props) {
    return (
      <Button
        asChild
        variant="wrapper"
        size="wrapper-xs"
        className="gap-1.5 relative left-[-1px]"
        data-testid="workspace-back-button"
      >
        <Link href={props.href} scroll={false}>
          <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
          Back
        </Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="wrapper"
      size="wrapper-xs"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      className="gap-1.5 relative left-[-1px]"
      data-testid="workspace-back-button"
    >
      <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
      Back
    </Button>
  );
}
```

Notes:
- Discriminated-union props — TS rejects passing both `href` and `onClick` simultaneously.
- `data-testid="workspace-back-button"` is the unification proof — same testid renders on all three surfaces.
- The Button primitive's `wrapper`/`wrapper-xs` variants already exist (`packages/ui/src/primitives/button.tsx:43,62`).
- 33 lines total — under the 100-line ceiling from `.claude/rules/react-components.md`.
- `scroll={false}` matches what `ContentBackLink` does today; preserves shell scroll position across parallel-route swap.

### Step 2 — Re-wire the export

Edit `apps/mirror/features/content/index.ts:17`:
- Replace `export { ContentBackLink } from "./components/back-link";`
  with `export { WorkspaceBackButton } from "./components/workspace-back-button";`

### Step 3 — Delete the old component

Remove `apps/mirror/features/content/components/back-link.tsx`. No other callers remain after Steps 4–6.

### Step 4 — Update `article-detail-toolbar.tsx`

The toolbar already calls `useChatSearchParams()` (added for the Edit button). Reuse `buildChatAwareHref` and add `getContentHref` to the `@/features/content` import; replace `ContentBackLink` with `WorkspaceBackButton`.

```tsx
"use client";

import Link from "next/link";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
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
      <WorkspaceBackButton
        href={buildChatAwareHref(getContentHref(username, "articles"))}
      />
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

### Step 5 — Update `post-detail-toolbar.tsx`

Symmetric to Step 4. The component becomes a client component **already is** (`"use client"` at top); the new hook call is fine.

```tsx
"use client";

import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { PublishToggleConnector } from "./publish-toggle-connector";
import type { PostSummary } from "../types";

type PostDetailToolbarProps = {
  username: string;
  post: PostSummary;
};

export function PostDetailToolbar({ username, post }: PostDetailToolbarProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  return (
    <ContentToolbarShell variant="detail">
      <WorkspaceBackButton
        href={buildChatAwareHref(getContentHref(username, "posts"))}
      />
      <PublishToggleConnector post={post} />
    </ContentToolbarShell>
  );
}
```

### Step 6 — Update `article-editor-toolbar.tsx`

Replace lines 29–42 (the inline Button block) with `<WorkspaceBackButton onClick={onCancel} disabled={isSaving} ariaLabel="Cancel" />`. Drop the now-unused `ArrowshapeLeftFillIcon` import — `grep "ArrowshapeLeftFillIcon"` in the file should return zero matches afterward. Keep the `Button` import (right-side Save button still uses it).

```tsx
"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { WorkspaceBackButton } from "@/features/content";
import { ArticlePublishToggle } from "./article-publish-toggle";
import type { ArticleStatus } from "../../lib/schemas/article-metadata.schema";

export interface ArticleEditorToolbarProps {
  status: ArticleStatus;
  isSaving: boolean;
  hasPendingUploads: boolean;
  onSave: () => void | Promise<void>;
  onPublishToggle: () => Promise<void>;
  onCancel?: () => void;
}

export function ArticleEditorToolbar({
  status,
  isSaving,
  hasPendingUploads,
  onSave,
  onPublishToggle,
  onCancel,
}: ArticleEditorToolbarProps) {
  return (
    <WorkspaceToolbar>
      <div className="flex h-9 w-full items-center justify-between gap-2 border-b border-border-subtle px-3.5 pb-1.5 relative">
        {onCancel && (
          <WorkspaceBackButton
            onClick={onCancel}
            disabled={isSaving}
            ariaLabel="Cancel"
          />
        )}
        <div className="flex items-center gap-1.5">
          <ArticlePublishToggle
            status={status}
            isPending={isSaving}
            disabled={isSaving || hasPendingUploads}
            onConfirm={onPublishToggle}
          />
          <Button
            type="button"
            variant="primary"
            size="xs"
            data-testid="save-article-btn"
            className="w-12"
            onClick={() => void onSave()}
            disabled={isSaving || hasPendingUploads}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </WorkspaceToolbar>
  );
}
```

---

## Hard verification

### E2E — Playwright CLI (per `.claude/rules/verification.md` § E2E Tests)

#### 1. Existing-coverage regression gate

```bash
pnpm --filter=@feel-good/mirror test:e2e article-navigation.spec.ts
```

The two `getByRole("link", { name: "Back" }).click()` assertions at `article-navigation.spec.ts:162,357` must still pass. They prove:
- The detail-back is rendered as a **link** (Slot pattern → DOM is `<a>`).
- Accessible name is exactly **"Back"** (text content unchanged).
- Clicking it returns to the list URL (no behavior change).

This is the strongest contract guard — it was already passing on `main` and must continue passing after the refactor.

#### 2. New unification spec

Path: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts`

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

test.describe("Workspace back button — unified component", () => {
  test("article detail toolbar renders link mode with name 'Back'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { publishedSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${publishedSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/articles(?:\\?|$)`),
    );
  });

  test("post detail toolbar renders link mode with href to /posts", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await waitForAuthReady(page);

    // Click the first post in the list to enter detail.
    const firstPostLink = page
      .locator("article a[href*='/posts/']")
      .first();
    await firstPostLink.click();
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("link");
    await expect(back).toHaveAccessibleName("Back");
    await expect(back).toHaveAttribute(
      "href",
      new RegExp(`/@${username}/posts(?:\\?|$)`),
    );
  });

  test("article editor toolbar renders action mode with aria-label 'Cancel'", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const { draftSlug } = await ensureTestArticleFixtures();

    await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitForAuthReady(page);

    const back = page.getByTestId("workspace-back-button");
    await expect(back).toBeVisible({ timeout: 10_000 });
    await expect(back).toHaveRole("button");
    await expect(back).toHaveAccessibleName("Cancel");
    // Action mode does not render an href attribute.
    await expect(back).not.toHaveAttribute("href", /.+/);
  });
});
```

```bash
pnpm --filter=@feel-good/mirror test:e2e workspace-back-button.authenticated.spec.ts
```

**Pass criteria:** all three tests green. Each is a hard assertion:
- Same `data-testid="workspace-back-button"` selector resolves on all three surfaces → unification proof.
- Detail toolbars: `toHaveRole("link")` + `toHaveAccessibleName("Back")` + correct list-page `href` → link mode preserves existing role-based selectors.
- Editor toolbar: `toHaveRole("button")` + `toHaveAccessibleName("Cancel")` + no `href` attribute → action mode renders, `aria-label` overrides text for accessibility.

#### 3. New edit-button spec must still pass

```bash
pnpm --filter=@feel-good/mirror test:e2e article-edit-button.authenticated.spec.ts
```

The two tests added in this branch's earlier commit assert on `getByTestId("edit-article-btn")` and `getByTestId("save-article-btn")`. Neither testid changes here, so this should remain green.

### Build + lint (Tier 4 per `.claude/rules/verification.md` — UI structural change touching event handlers)

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

Both must exit 0. Lint catches unused-import drift (specifically: the `ArrowshapeLeftFillIcon` import in `article-editor-toolbar.tsx` is removed in Step 6 — if the agent forgets, lint flags it).

### Manual visual confirmation (Chrome MCP — visual sanity, not for assertions)

1. Article detail (signed in as owner): Back button uses arrowshape icon, sits flush with the left edge (`left-[-1px]`), `size-4.5` icon.
2. Post detail: matches article detail pixel-for-pixel.
3. Article editor: Back button is visually identical to the detail-back; clicking still triggers the editor's cancel flow.

---

## Constraints & non-goals

**In scope:**
- One new component (`WorkspaceBackButton`) at `apps/mirror/features/content/components/workspace-back-button.tsx`.
- Three callsite migrations (article detail, post detail, article editor).
- One file deletion (`back-link.tsx`).
- One new e2e spec (3 tests).

**Explicitly out of scope:**
- `ContentEditorToolbar`'s right-side "Cancel" link (`features/content/components/content-editor-toolbar.tsx:32-34`) — different visual idea (no back arrow, paired with Save), serves a different role. Not part of the back-button unification.
- `post-editor.tsx` and the Tiptap format toolbar — neither has a workspace-style back-arrow button. No change.
- The waitlist form's step-back arrow — not a workspace toolbar surface.
- Visual tweaks beyond what's in the user's quoted spec. The exact classes (`gap-1.5 relative left-[-1px]`, icon `size-4.5 transition-all duration-100`, `variant="wrapper" size="wrapper-xs"`) are the contract.
- Renaming `ContentBackLink` to a deprecated alias for backwards-compat. Two callsites — just delete + replace.

**Risks I'm accepting:**
- `getByRole("link", { name: "Back" })` at `article-navigation.spec.ts:162,357` is the existing-behavior contract. The new component preserves both role and accessible name in link mode (Slot pattern → DOM `<a>`; text content "Back" unchanged). If a future change converts a detail-back to action mode, those tests break loudly — appropriate failure mode.
- The editor's `aria-label="Cancel"` is intentional: clicking that button can dispatch `form.cancel()` with a dirty-form warning, so announcing it as "Cancel" is correct UX. The accessible-name divergence (detail="Back", editor="Cancel") is preserved by `WorkspaceBackButton`'s optional `ariaLabel` prop.
- Three callsites is on the borderline of where a shared component is justified (`AGENTS.md` Core Principles: don't over-abstract). The compounding payoff: every future detail/editor toolbar inherits the unified style for free instead of someone copying one of the two divergent legacy patterns. Given the user's explicit ask, this is the right call.
