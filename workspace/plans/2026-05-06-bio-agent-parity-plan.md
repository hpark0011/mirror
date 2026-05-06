# Plan — Bio agent-parity: clone agent can pull up the Bio tab

**Date:** 2026-05-06
**Branch:** `feature-bio-pull-up`
**Scope:** Close the agent-parity gap for the Bio tab. Add one dispatcher verb, one agent tool, one vocabulary line, one watcher branch, one inputSchema-invariant test, one rick-rubin seed extension, and one Playwright spec. No schema changes, no changes to the bio feature itself, no refactor of the existing posts/articles parity surface.

---

## Goal

When a visitor asks the profile owner's clone something like "can you show me your bio?", the clone agent should navigate the visitor's right-pane to `/@<owner>/bio` — just like asking for "your latest post" navigates to `/@<owner>/posts/<slug>`. Today the agent cannot do this and falls back to summarizing the bio inline (see screenshot in the originating thread: *"I'm not able to open a bio page directly, but here's the gist…"*).

Per `.claude/rules/agent-parity.md`, "every action a user can take through the UI, the clone agent must be able to take through a tool." The user has a Bio tab in `PROFILE_TAB_LABELS` (`apps/mirror/features/profile-tabs/types.ts:28`) that links to `/@<owner>/bio`. There is no matching agent tool. This plan adds it using the four-step checklist the rule prescribes.

---

## Current state (as of 2026-05-06)

**What works (posts / articles):**
- `useCloneActions().navigateToContent({kind, slug})` is the single dispatcher (`apps/mirror/app/[username]/_providers/clone-actions-context.tsx:35-47`). User-side: `PostListItem`/`ArticleListItem` call it on click. Agent-side: `useAgentIntentWatcher` reads `tool-navigateToContent` parts and calls it.
- `buildCloneTools(profileOwnerId)` registers `getLatestPublished` + `navigateToContent`, both keyed on `ContentKind = "articles" | "posts"` (`packages/convex/convex/chat/tools.ts:29-94`, `packages/convex/convex/content/href.ts:18`).
- `TOOLS_VOCABULARY` (`packages/convex/convex/chat/helpers.ts:79-80`) names those two verbs in the system prompt.
- The `inputSchema` invariants test (`packages/convex/convex/chat/__tests__/tools.test.ts:471-538`) pins that no `userId` leaks into the LLM-visible surface.
- The href contract is server-built once in `resolveBySlug` via `buildContentHref` (`packages/convex/convex/content/href.ts`); the watcher passes the server `href` straight through.

**What's missing for bio (the parity gap):**
1. No verb on `useCloneActions`. The dispatcher only knows `navigateToContent` for slug-bearing content kinds. Bio is a slug-less profile tab.
2. No tool in `buildCloneTools`. The LLM has no bio verb to call.
3. `TOOLS_VOCABULARY` doesn't mention bio. The system prompt teaches only article/post verbs.
4. `useAgentIntentWatcher` (`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts:40`) is hard-coded to listen for `tool-navigateToContent`.
5. `chat/__tests__/tools.test.ts` has no inputSchema-invariant assertion for the new tool.
6. `rick-rubin` (the e2e fixture user with a wired clone config) has no `bioEntries` seeded — so an e2e test today couldn't prove the positive path. The `bio-rag-context.authenticated.spec.ts` is fixme'd for the broader RAG-fixture problem; we side-step that by adding a one-shot bio seed for rick-rubin (no RAG embedding required for navigation).

The system prompt's inventory sentence (`packages/convex/convex/chat/helpers.ts:23-27`) already says "bio entries (work history, education)" when the owner has any — so the LLM **knows** bio exists, it just has no verb to act on it. That is exactly what the screenshot shows: the model summarizes inline because it has the data but no tool.

---

## Design decisions (decided up-front so reviewers can challenge before code)

1. **One dedicated verb (`navigateToBio` / tool name `openBio`)** rather than a generalized `navigateToProfileTab({tab})`. The existing `getLatestPublished` is purpose-named; we mirror that. If clone-settings or other tabs ever need agent navigation, generalize then. Don't pre-engineer.
2. **`openBio` does a server DB lookup to gate on "has at least one bio entry"** and **throws** when none exist. Throws (not null) because `openBio` is a navigation verb — it mirrors `navigateToContent`'s "couldn't resolve, error and let the LLM recover with text" shape, not `getLatestPublished`'s "data lookup, return null on empty." The system prompt's inventory sentence already gates the LLM from calling `openBio` when the owner has no bio entries, so the throw path is rare-but-defensive. **Note on parity scope:** the user-side Bio tab is visible regardless of whether bio entries exist (`profile-tabs.tsx:40` does not gate on count); gating the agent verb on `≥1 entry` is a deliberate UX trade — we'd rather refuse to navigate to an empty Bio tab than dump the visitor on a blank page. If we ever decide strict tab-parity is the right model, drop the gate and the test for it.
3. **`openBio.inputSchema` is `z.object({})`** — no args. The empty schema is easier to assert (no field can leak `userId`) and matches the verb's semantics ("open bio for this profile"). The closure-bound `profileOwnerId` is the only user-scope input.
4. **Server-build the href once.** The tool returns `{kind: "bio", href: "/@<username>/bio"}`. To avoid creating a new shared helper for a single template, the tool inlines the template once and a unit test pins it to the same string `getProfileTabHref(username, "bio")` produces (`apps/mirror/features/profile-tabs/types.ts:34-36`). If a future verb needs a profile-tab href on the server, factor a shared helper at that point.
5. **Add a second branch to `useAgentIntentWatcher` rather than generalize the watcher.** Two branches is below the abstraction-pays-off threshold. The existing idempotency-by-conversation Map already covers any future part type.
6. **Do NOT reroute the user-side Bio tab through the dispatcher.** The Posts and Articles tabs in `ProfileTabs` (`apps/mirror/features/profile-tabs/components/profile-tabs.tsx:41`) currently use `<Link>` directly, not the dispatcher — so this is consistent with the existing tab-level pattern. The dispatcher is for content-item navigation (slug-bearing). If we later decide tabs should also funnel through the dispatcher, that's a separate refactor across all tabs, not a bio-specific change.
7. **Seed `bioEntries` for rick-rubin** (4 entries: 2 work + 1 education + 1 description-rich) so the e2e positive path has data. Insert directly with `ctx.db.insert` — no embedding scheduling, since the navigation test does not exercise RAG.

---

## Implementation steps

### Step 1 — Add `navigateToBio` to `useCloneActions`

`apps/mirror/app/[username]/_providers/clone-actions-context.tsx`

Extend the `CloneActions` type:

```ts
type CloneActions = {
  navigateToContent: (args: { kind: ContentKind; slug: string; href?: string }) => void;
  /**
   * Open the profile owner's Bio tab. Used by both the agent intent
   * watcher (via the `openBio` tool result) and any future user-UI
   * caller that wants the dispatcher's chat-aware-href treatment.
   * `href` is optional — passed through verbatim when the agent
   * server-built it (parity with `navigateToContent`).
   */
  navigateToBio: (args?: { href?: string }) => void;
};
```

Implementation:

```ts
const navigateToBio = useCallback<CloneActions["navigateToBio"]>(
  (args) => {
    const basePath = args?.href ?? getProfileTabHref(profile.username, "bio");
    router.push(buildChatAwareHref(basePath), { scroll: false });
  },
  [router, profile.username, buildChatAwareHref],
);
```

Add `getProfileTabHref` to the imports:

```ts
import { getProfileTabHref } from "@/features/profile-tabs/types";
```

Add `navigateToBio` to the memoized `value` and dependency array.

**Why pass-through-`href`** mirrors `navigateToContent`'s shape — the server is the source of truth when the agent calls the dispatcher; the client builds the href only when the user-UI calls it directly with no `href`.

### Step 2 — Add `openBio` tool + `resolveBioForOwner` internal query

**2a.** `packages/convex/convex/chat/toolQueries.ts` — add a sibling internal query:

```ts
const resolveBioReturnValidator = v.union(
  v.null(),
  v.object({
    kind: v.literal("bio"),
    username: v.string(),
    href: v.string(),
  }),
);

/**
 * Resolve the Bio tab href for the given user. Returns `null` when:
 *  - the user has no `username` (cannot build a profile-tab href),
 *  - the user has zero bio entries (no point navigating to an empty tab;
 *    the LLM falls back to text recovery, mirroring `getLatestPublished`'s
 *    "nothing to show" null return).
 *
 * Cross-user isolation is enforced by the `userId` clause on
 * `bioEntries.by_userId`. `resolveBioForOwner({ userId: A })` cannot see
 * user B's rows.
 *
 * Href shape `/@<username>/bio` is asserted byte-for-byte against
 * `getProfileTabHref(username, "bio")` in the tool unit test, so a typo
 * surfaces in CI rather than as a silent 404.
 */
export const resolveBioForOwner = internalQuery({
  args: { userId: v.id("users") },
  returns: resolveBioReturnValidator,
  handler: async (ctx, { userId }) => {
    const owner = await ctx.db.get(userId);
    if (!owner || !owner.username) return null;

    const firstEntry = await ctx.db
      .query("bioEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!firstEntry) return null;

    return {
      kind: "bio" as const,
      username: owner.username,
      href: `/@${owner.username}/bio`,
    };
  },
});
```

**2b.** `packages/convex/convex/chat/tools.ts` — register the tool inside `buildCloneTools`:

```ts
openBio: createTool({
  description:
    "Open this profile's Bio tab in the visitor's right panel. Use when the visitor asks about the owner's work history, education, or background. Do not pass any user identifier — the profile owner is bound server-side. Returns the canonical href; the client uses it to navigate.",
  inputSchema: z.object({}),
  execute: async (ctx) => {
    const row: {
      kind: "bio";
      username: string;
      href: string;
    } | null = await ctx.runQuery(
      internal.chat.toolQueries.resolveBioForOwner,
      { userId: profileOwnerId },
    );
    if (!row) {
      throw new Error(
        "No bio entries available for this profile.",
      );
    }
    return { kind: row.kind, href: row.href };
  },
}),
```

The handler returns `{kind, href}` (no `username` — the watcher doesn't need it; the `href` is the contract).

### Step 3 — Update `TOOLS_VOCABULARY`

`packages/convex/convex/chat/helpers.ts:79-80`

Replace:

```ts
const TOOLS_VOCABULARY =
  "You can open content for the visitor by calling getLatestPublished to look up the latest article or post, then calling navigateToContent with that kind and slug.";
```

With (one extra clause, kept conversational per `STYLE_RULES`):

```ts
const TOOLS_VOCABULARY =
  "You can open content for the visitor by calling getLatestPublished to look up the latest article or post, then calling navigateToContent with that kind and slug. You can also open the profile's Bio tab by calling openBio when the visitor asks about work history, education, or background.";
```

The fixed-section budget treatment in `truncateToBudget` already protects this line — `TOOLS_VOCABULARY` lives in the `fixed` array (`helpers.ts:179-183`), so it cannot be proportionally shrunk away.

Update the `helpers.test.ts` assertion that pins `TOOLS_VOCABULARY` content if one exists; otherwise add one (`grep -n "TOOLS_VOCABULARY\|getLatestPublished\|navigateToContent" packages/convex/convex/chat/__tests__/helpers.test.ts` to confirm before editing).

### Step 4 — Extend `useAgentIntentWatcher` with an `openBio` branch

`apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`

Add a sibling constant + output validator + dispatch branch. The conversation-scoped idempotency Map (`handledByConversation`) is reused — toolCallIds across both tool types share the same set, which is fine because IDs are globally unique.

```ts
const NAVIGATE_TO_CONTENT_TYPE = "tool-navigateToContent";
const OPEN_BIO_TYPE = "tool-openBio";

type OpenBioOutput = { kind: "bio"; href: string };

function isOpenBioOutput(output: unknown): output is OpenBioOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    o.kind === "bio" &&
    typeof o.href === "string" &&
    o.href.length > 0
  );
}
```

Inside the part loop, after the existing `tool-navigateToContent` branch, add:

```ts
if (part.type === OPEN_BIO_TYPE) {
  const toolPart = part as {
    type: string;
    state: string;
    toolCallId: string;
    output?: unknown;
  };
  if (toolPart.state !== "output-available") continue;
  if (handled.has(toolPart.toolCallId)) continue;
  if (!isOpenBioOutput(toolPart.output)) continue;

  handled.add(toolPart.toolCallId);
  navigateToBio({ href: toolPart.output.href });
  continue;
}
```

Update the destructure: `const { navigateToContent, navigateToBio } = useCloneActions();` and add `navigateToBio` to the effect deps.

The watcher structure stays under the 100-line ceiling (`react-components.md`).

### Step 5 — `inputSchema invariants` test for `openBio`

`packages/convex/convex/chat/__tests__/tools.test.ts`

In the `chat/tools.buildCloneTools — inputSchema invariants` describe block, add:

```ts
it("openBio.inputSchema does not expose userId (or any user identifier)", () => {
  const tools = buildCloneTools(fakeOwner);
  const schema = tools.openBio.inputSchema as
    | { shape?: Record<string, unknown>; _def?: unknown }
    | undefined;

  expect(schema).toBeDefined();
  expect(schema!.shape).toBeDefined();
  expect("userId" in schema!.shape!).toBe(false);
  expect("user_id" in schema!.shape!).toBe(false);
  expect("ownerId" in schema!.shape!).toBe(false);

  const serialized = JSON.stringify(schema!._def);
  expect(serialized).not.toMatch(/userId/i);
  expect(serialized).not.toMatch(/profileOwnerId/i);
});

it("openBio.inputSchema is empty (the LLM has no args to pass)", () => {
  const tools = buildCloneTools(fakeOwner);
  const schema = tools.openBio.inputSchema as {
    shape: Record<string, unknown>;
  };
  expect(Object.keys(schema.shape)).toEqual([]);
});
```

Add a sibling describe block targeting `resolveBioForOwner` (mirrors the `resolveBySlug` block at `tools.test.ts:304-469`):

```ts
describe("chat/toolQueries.resolveBioForOwner", () => {
  it("returns the bio tab href when the owner has a username and at least one entry", async () => {
    const t = makeT();
    const owner = await insertOwner(t, "owner_with_bio");
    await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: owner,
        kind: "work",
        title: "Founder",
        startDate: Date.parse("2020-01-01"),
        endDate: null,
      }),
    );

    const result = await t.query(
      internal.chat.toolQueries.resolveBioForOwner,
      { userId: owner },
    );

    expect(result).not.toBeNull();
    expect(result!.kind).toBe("bio");
    expect(result!.username).toBe("owner_with_bio");
    expect(result!.href).toBe("/@owner_with_bio/bio");
  });

  it("returns null when the owner has zero bio entries (tool wrapper translates this to a thrown error)", async () => {
    // The internal query's contract is "null = no data." The `openBio` tool
    // wrapper around it (in `chat/tools.ts`) throws on the null case so the
    // LLM sees an error and recovers with text — same shape as
    // `navigateToContent`'s "couldn't resolve" path. The throw is asserted
    // from the tool side; this test pins the underlying query's contract.
    const t = makeT();
    const owner = await insertOwner(t, "owner_no_bio");
    const result = await t.query(
      internal.chat.toolQueries.resolveBioForOwner,
      { userId: owner },
    );
    expect(result).toBeNull();
  });

  it("SECURITY: cannot see another user's bio entries", async () => {
    const t = makeT();
    const userA = await insertOwner(t, "user_a_bio");
    const userB = await insertOwner(t, "user_b_bio");

    // User B has bio entries; user A has none. resolveBioForOwner({A})
    // must return null — A cannot piggyback on B's rows.
    await t.run(async (ctx) =>
      ctx.db.insert("bioEntries", {
        userId: userB,
        kind: "work",
        title: "B's Job",
        startDate: 1000,
        endDate: null,
      }),
    );

    const aResult = await t.query(
      internal.chat.toolQueries.resolveBioForOwner,
      { userId: userA },
    );
    expect(aResult).toBeNull();

    // Positive control — userB's own query succeeds.
    const bResult = await t.query(
      internal.chat.toolQueries.resolveBioForOwner,
      { userId: userB },
    );
    expect(bResult).not.toBeNull();
    expect(bResult!.username).toBe("user_b_bio");
  });
});
```

Add a parity-pin test that ties the server template to the client helper. The chat package ships separately from the Mirror app, so we **do not import** the client helper — we hard-code the contract here and add a cross-reference comment. If a future shared helper is introduced, replace this with a direct import.

```ts
it("openBio href shape matches the client-side getProfileTabHref builder", async () => {
  const t = makeT();
  const owner = await insertOwner(t, "owner_href_pin");
  await t.run(async (ctx) =>
    ctx.db.insert("bioEntries", {
      userId: owner,
      kind: "education",
      title: "BS CS",
      startDate: 1000,
      endDate: 2000,
    }),
  );
  const result = await t.query(
    internal.chat.toolQueries.resolveBioForOwner,
    { userId: owner },
  );
  // Cross-reference: must equal `getProfileTabHref("owner_href_pin", "bio")`
  // from `apps/mirror/features/profile-tabs/types.ts:34-36`. If that helper
  // ever changes the template, this test must be updated in the same commit.
  expect(result!.href).toBe("/@owner_href_pin/bio");
});
```

(Cross-package import is intentionally avoided; the comment is the contract.)

Verify the schema validators `bioEntries.by_userId` index exists (`grep -n "by_userId\|bioEntries" packages/convex/convex/schema.ts` should show it). If not present, the plan is wrong — stop and report.

### Step 6 — Seed bio entries for rick-rubin

`packages/convex/convex/seed.ts`

Add a sibling helper after `ensureRickRubinPosts`:

```ts
async function ensureRickRubinBioEntries(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("bioEntries")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (existing) return;

  // Four entries — two work, one education, one Columbia-era description —
  // so the bio panel renders a non-trivial list and the e2e spec can pin a
  // specific entry title to prove seed data actually rendered (not just an
  // empty panel mount).
  await ctx.db.insert("bioEntries", {
    userId,
    kind: "work",
    title: "Producer at Def Jam",
    startDate: Date.parse("1984-01-01"),
    endDate: Date.parse("1988-12-31"),
    description: "Co-founded the label; produced records that defined hip-hop's mainstream arrival.",
  });
  await ctx.db.insert("bioEntries", {
    userId,
    kind: "work",
    title: "Founder, American Recordings",
    startDate: Date.parse("1988-01-01"),
    endDate: null,
  });
  await ctx.db.insert("bioEntries", {
    userId,
    kind: "education",
    title: "NYU — Philosophy",
    startDate: Date.parse("1981-09-01"),
    endDate: Date.parse("1985-06-01"),
  });
  await ctx.db.insert("bioEntries", {
    userId,
    kind: "education",
    title: "Long Beach High School",
    startDate: Date.parse("1977-09-01"),
    endDate: Date.parse("1981-06-01"),
  });
}
```

Wire it into the existing exports:

```ts
export const seedRickRubinBio = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinBioEntries(ctx, userId);
  },
});
```

Add `await ensureRickRubinBioEntries(ctx, userId);` to `seedRickRubinDemo`'s body so a single demo seed call provisions everything. Keep the existing `seedRickRubinArticles` / `seedRickRubinPosts` exports unchanged to avoid breaking any external invocation sites.

Verify the bio entries do NOT appear in the chat agent's RAG retrieval for this test (no embeddings scheduled means no `contentEmbeddings` rows). That is acceptable for navigation testing; the `bio-rag-context.authenticated.spec.ts` file already documents that RAG-fixture work is a separate dependency.

### Step 7 — Playwright e2e spec

`apps/mirror/e2e/bio/bio-agent-pulls-up.authenticated.spec.ts`

Mirrors `apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts` shape — real LLM, no mocks.

```ts
import { expect, test, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "../helpers/chat";

/**
 * End-to-end proof that the clone agent can pull up the Bio tab through
 * the `openBio` tool — the parity counterpart to
 * `chat-agent-navigates.authenticated.spec.ts` for slug-less profile-tab
 * navigation.
 *
 * Pipeline under test:
 *   1. Visitor opens `/@rick-rubin?chat=1` and asks for the bio.
 *   2. Clone agent calls `openBio()` (no args) → Convex internal query
 *      `resolveBioForOwner({userId: rickRubin})` confirms ≥1 bio entry
 *      exists, returns `{kind: "bio", href: "/@rick-rubin/bio"}`.
 *   3. The streamed UIMessage carries a `tool-openBio` part with
 *      `state === "output-available"`.
 *   4. `useAgentIntentWatcher` dispatches through
 *      `useCloneActions().navigateToBio({href})`, which `router.push`'s
 *      `buildChatAwareHref(href)`.
 *   5. The Bio panel renders (`data-testid="bio-panel"` becomes visible).
 *
 * Cross-user negative path: asking about a *different* user's background
 * keeps the URL on rick-rubin's profile (the agent has no cross-user
 * verb). Mirrors the `'show me Bob's latest article'` case.
 *
 * Pre-flight: `pnpm --filter=@feel-good/convex seed:rick-rubin` must run
 * before this spec (it provisions rick-rubin's user row + posts + articles
 * + bio entries). Playwright's `webServer` only starts the Mirror dev
 * server (`playwright.config.ts:41-45`), not Convex seeding, so the
 * verification block below makes the seed an explicit pre-step.
 */

const username = "rick-rubin";
const positivePrompt = "can you show me your bio?";
const negativePrompt = "show me Bob's bio.";
const NAVIGATION_TIMEOUT = 60_000;

test.describe.configure({ mode: "serial", timeout: 150_000 });

async function captureInitialUrl(page: Page): Promise<string> {
  return page.url();
}

test.describe("Clone agent pulls up the Bio tab via the openBio tool", () => {
  test("positive path: 'can you show me your bio' navigates to /@<owner>/bio with seeded entries", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);
    await sendChatMessage(textarea, positivePrompt);
    await expect(page.getByText(positivePrompt)).toBeVisible();

    // URL transition is the load-bearing assertion — the user sees the
    // Bio panel because the URL changed, not because chat said so.
    await page.waitForURL(new RegExp(`/@${username}/bio(?:[?#]|$)`), {
      timeout: NAVIGATION_TIMEOUT,
    });

    // Bio panel mounts AND a seeded entry is rendered. The panel-mount
    // selector alone could pass on an empty panel; pinning a literal seeded
    // title proves the seed ran AND the entry list rendered through the
    // dispatcher's `router.push`. "Producer at Def Jam" comes from
    // `ensureRickRubinBioEntries` in `packages/convex/convex/seed.ts`.
    await expect(page.getByTestId("bio-panel")).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });
    await expect(
      page.getByTestId("bio-entry-card").filter({ hasText: "Producer at Def Jam" }),
    ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

    // Chat-aware-href preservation: both `?chat=1` and `?conversation=`
    // survive the agent-driven navigation (matches the article-side spec).
    expect(page.url()).toMatch(/[?&]chat=1\b/);
    expect(page.url()).toMatch(/[?&]conversation=[^&]+/);
  });

  test("negative path: cross-user bio request does not pivot the URL", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);
    const startingUrl = await captureInitialUrl(page);

    await sendChatMessage(textarea, negativePrompt);
    await expect(page.getByText(negativePrompt)).toBeVisible();
    await expect(textarea).toBeEnabled({ timeout: NAVIGATION_TIMEOUT });
    await expect(page.locator(RECEIVED_BUBBLE_SELECTOR).last()).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });

    const finalUrl = page.url();
    // Always still under rick-rubin's profile.
    expect(finalUrl).toMatch(new RegExp(`/@${username}(?:/|\\?|$)`));
    // Never pivoted to any OTHER `/@username/...` path.
    expect(finalUrl).not.toMatch(/\/@(?!rick-rubin\b)[^/?#]+/);

    // Path component must not have moved into the Bio panel either —
    // the agent has no `openBio({user: B})` verb (and shouldn't).
    const stripQuery = (u: string) => u.split("?")[0];
    expect(stripQuery(finalUrl)).toBe(stripQuery(startingUrl));
  });
});
```

Pre-flight: confirm `bio-panel` is the bio panel's `data-testid` (verified in research — `apps/mirror/features/bio/components/bio-panel.tsx:42`).

---

## Hard verification

### E2E — Playwright CLI (per `.claude/rules/verification.md` § E2E Tests)

**Pre-step (mandatory): seed rick-rubin's bio entries against the active Convex deployment.** Playwright's `webServer` does not run any Convex command (verified at `apps/mirror/playwright.config.ts:41-45`), so the seed is run manually before the spec. The seed mutation is idempotent (`ensureRickRubinBioEntries` short-circuits when entries already exist), so re-running between runs is safe.

```bash
# 1. Seed rick-rubin (user row + posts + articles + the new bio entries).
#    Required because Playwright does not seed Convex.
pnpm --filter=@feel-good/convex seed:rick-rubin

# 2. Run the new spec.
pnpm --filter=@feel-good/mirror test:e2e bio/bio-agent-pulls-up.authenticated.spec.ts
```

**Pass criteria:** both tests green. Each assertion is hard:

- Positive path: `page.waitForURL(/\/bio(?:[?#]|$)/)` proves the URL transitioned via `router.push`, which only the dispatcher fires; combined with `getByTestId("bio-panel")` visible AND `bio-entry-card` containing "Producer at Def Jam", this proves the full agent → tool → watcher → dispatcher → Next.js render chain AND that seeded data actually rendered (rules out the "panel mounted but empty" false-pass).
- Positive path: `?chat=1` AND `?conversation=` regex match → `buildChatAwareHref` preserved both query params on the agent-driven navigation.
- Negative path: URL path component unchanged + a received-bubble appearing → the agent **replied** but did **not** navigate, ruling out "URL didn't change because the model also didn't reply" false-pass.

Single positive prompt (down from two in the previous draft) keeps the real-LLM flake surface small. The watcher unit test and the convex tools-test cover phrasing-independent invariants; a second LLM-driven prompt assertion would add cost without proportional coverage.

### Convex unit tests

```bash
pnpm --filter=@feel-good/convex test
```

Must include the new `resolveBioForOwner` describe block and the `openBio.inputSchema` invariant assertions. All 5 newly-added cases must pass plus the existing tools-test cases must continue to pass (regression coverage on the article/post side).

### Watcher unit test

`apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts` already pins idempotency on `tool-navigateToContent`. Add a parallel describe block for `tool-openBio` covering at minimum:

- `output-available` with valid `{kind: "bio", href}` → dispatches `navigateToBio({href})` once.
- Same toolCallId re-rendered → dispatches once total (Map-scoped idempotency).
- `output-error` state → never dispatches.

**Update the existing `useCloneActions` mock in the same file** (`use-agent-intent-watcher.test.ts:24-26`) to return BOTH methods, not just `navigateToContent`:

```ts
const navigateToContentMock = vi.fn();
const navigateToBioMock = vi.fn();

vi.mock("@/app/[username]/_providers/clone-actions-context", () => ({
  useCloneActions: () => ({
    navigateToContent: navigateToContentMock,
    navigateToBio: navigateToBioMock,
  }),
}));
```

If only one method is returned, TypeScript will accept it (the mock is loosely typed) but the new branch's destructure of `navigateToBio` will resolve to `undefined` at runtime and the tests will throw — the bug surfaces as `TypeError: navigateToBio is not a function`, not a clean assertion failure. Update both mocks in the same edit and reset both in `beforeEach`.

Run: `pnpm --filter=@feel-good/mirror test:unit -- use-agent-intent-watcher`.

### Build + lint (per `.claude/rules/verification.md` Tier 4 — navigation/event handler change)

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
pnpm build --filter=@feel-good/convex
```

All three must exit 0 before running e2e. The Convex build is required because we touched server code in `packages/convex/convex/chat/`.

### Manual smoke (optional — only if e2e is green and you want a pixel eyeball)

The e2e spec above already covers the agent → URL → bio-panel render path; manual confirmation is for catching pixel/animation issues the assertions can't see (`.claude/rules/verification.md` Tier 4 — Chrome MCP is allowed for visual debugging, never for assertions).

1. `pnpm --filter=@feel-good/convex seed:rick-rubin`.
2. `pnpm dev --filter=@feel-good/mirror`, open `http://localhost:3001/@rick-rubin?chat=1`.
3. Send "can you show me your bio?" — confirm the right pane swaps to the Bio panel without a perceptible flash of the Posts panel; URL becomes `/@rick-rubin/bio?chat=1&conversation=...`.
4. Send "what about your latest post?" — confirm the agent still pulls up a post (regression check on the article/post side).

---

## Constraints & non-goals

**In scope:**
- One new tool (`openBio`), one new dispatcher verb (`navigateToBio`), one new watcher branch, one TOOLS_VOCABULARY clause, three new tools.test.ts cases, three new resolveBioForOwner cases, one new use-agent-intent-watcher unit-test describe block, one new e2e spec, one rick-rubin bio seed extension.
- All five steps land in the same commit per `.claude/rules/agent-parity.md`'s "Adding a new agent verb — four-step checklist." Skipping any one breaks the parity loop.

**Explicitly out of scope:**
- No generalized `navigateToProfileTab` dispatcher or tool. Single-purpose verb only. If clone-settings or list-view-without-slug ever needs an agent verb, factor at that point.
- No refactor of the existing user-side Bio tab (`ProfileTabs` `<Link>` in `apps/mirror/features/profile-tabs/components/profile-tabs.tsx:41`) to call the dispatcher. The Posts and Articles tabs use the same `<Link>` pattern; tab-level dispatcher routing is a separate concern.
- No shared `buildProfileTabHref` helper at `packages/convex/convex/profile-tabs/href.ts`. The template appears in two places (server tool, client `getProfileTabHref`); the unit test pins them. Factor a shared helper when the second server-side caller appears.
- No RAG / embedding work for bio entries beyond what the rick-rubin seed inserts. The `bio-rag-context.authenticated.spec.ts` file documents that the RAG-fixture story is gated on a deterministic embedding pipeline and remains fixme'd.
- No changes to `bioEntries` schema, indexes, or mutations. The existing `by_userId` index on `bioEntries` is sufficient for `resolveBioForOwner`'s `.first()` presence check (verified in research).
- No changes to the system prompt's truncation / inventory logic in `composeSystemPrompt`. The new TOOLS_VOCABULARY clause is one sentence and `truncateToBudget` already protects the fixed section.
- No optimistic update wiring. The dispatcher fires `router.push`, not a Convex mutation — `optimistic-updates.md` does not apply.
- No changes to the agent's safety prefix or style rules.

**Risks accepted:**
- The LLM may rephrase the user's "bio" intent in unexpected ways (e.g. "tell me about yourself"). The two positive-path prompts cover the common phrasings; if the LLM regresses on one, the other still pins the parity loop. The TOOLS_VOCABULARY clause names the trigger conditions explicitly ("when the visitor asks about work history, education, or background") so the model has a clear cue.
- Cross-package validation: the server-side template `/@${username}/bio` and client `getProfileTabHref` (`apps/mirror/features/profile-tabs/types.ts:34-36`) live in separate packages. Drift between them silently 404s the agent. Mitigation: explicit cross-reference comment in `resolveBioForOwner` AND in the unit test, plus a pre-merge grep of the test for the literal `/@<username>/bio` shape.
- The unit test for `resolveBioForOwner`'s href must pass the same string the client builder would emit; if the client helper template ever changes, both this test and `apps/mirror/features/profile-tabs/__tests__/types.test.ts` must update in the same commit. Future improvement: factor a shared `packages/convex/convex/profile-tabs/href.ts` helper (mirrors `content/href.ts`).
- `bio-rag-context.authenticated.spec.ts` remains fixme'd. We do not fix RAG retrieval as part of this branch — only navigation.
