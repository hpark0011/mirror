---
id: PLAN_005
slug: profile-tabs-dispatcher-parity
title: "Profile Tabs Dispatcher Parity"
date: 2026-05-06
type: refactor
status: completed
branch: fix-bio-pairity
worktree: null
scope: "Generalize openBio into openProfileSection covering bio, articles, posts; route ProfileTabs through the useCloneActions dispatcher."
apps: [mirror]
packages: [convex]
verification_tier: 5
---

## 1. Summary

Generalize `useCloneActions().openBio` into a single tab-navigation verb
(`navigateToProfileSection({ section, href? })`) and wire **every** ProfileTab
(Bio, Articles, Posts, and owner-only Clone Settings) through it. Replace the
agent-side `openBio` tool with a single `openProfileSection({ section })` tool
that covers visitor-reachable sections (`bio | articles | posts`) so the
agent's verb space stays compact while gaining list-level navigation it does
not have today.

Result: ProfileTabs becomes the user-UI half of the same "two routes, one
dispatcher" pattern that already governs `navigateToContent` for list items.
The "uncalled user-UI branch" anomaly currently documented at
`clone-actions-context.tsx:50-52` disappears at the root, not just for Bio.

## 2. Background — current state

- `useCloneActions` exposes two verbs at
  `apps/mirror/app/[username]/_providers/clone-actions-context.tsx`:
  - `navigateToContent({ kind, slug, href? })` — used by both `post-list-item.tsx`
    / `article-list-item.tsx` (user-UI) and `useAgentIntentWatcher` (agent).
  - `openBio({ href })` — used **only** by the watcher today. The user-UI Bio
    tab in `apps/mirror/features/profile-tabs/components/profile-tabs.tsx`
    uses a bare `<Link>` consistent with the other 3 ProfileTabs.
- `PROFILE_TAB_KINDS` = `["posts", "articles", "bio", "clone-settings"]`
  (`apps/mirror/features/profile-tabs/types.ts`). `clone-settings` only renders
  for the owner (`isOwner` filter at `profile-tabs.tsx:26-28`).
- The agent already has `getLatestPublished`, `navigateToContent`, and `openBio`
  registered in `packages/convex/convex/chat/tools.ts`. The system prompt's
  `TOOLS_VOCABULARY` block in `packages/convex/convex/chat/helpers.ts:79-80`
  names all three. `inputSchema invariants` at
  `packages/convex/convex/chat/__tests__/tools.test.ts:528-` pins that none
  expose a user identifier.
- Server-side href builders live at `packages/convex/convex/content/href.ts`:
  `buildContentHref(username, kind, slug?)` covers articles/posts (with or
  without slug); `buildBioHref(username)` covers bio. The
  `getProfileTabHref(username, kind)` client helper at
  `apps/mirror/features/profile-tabs/types.ts:34-36` produces the same
  `/@<user>/<section>` shape — pinned for `bio` only by the existing
  `types.test.ts:76-88` href-parity assertion.

## 3. Compounding rationale

This plan picks the **single-general-tool** option ((A) in the brief) over
three sibling no-arg tools ((B)). Reasons:

- One tool registration, one `TOOLS_VOCABULARY` line, one `inputSchema`
  invariant — adding a future visitor-visible tab is a one-line enum bump.
- Symmetrical with `navigateToContent({ kind, slug })` — same shape, same
  watcher narrowing pattern. Engineers don't have to remember two different
  conventions for "navigate-to-X" tools.
- `clone-settings` is excluded from the agent's enum (owner-only screen) so
  the verb's surface area can't accidentally exfiltrate visitors into a
  page that throws on render.

## 4. Naming decisions

| Surface | Old | New |
|---|---|---|
| Dispatcher verb on `useCloneActions` | `openBio({ href })` | `navigateToProfileSection({ section, href? })` |
| Agent tool | `openBio` (no args) | `openProfileSection({ section })` |
| Watcher part type literal | `tool-openBio` | `tool-openProfileSection` |
| Watcher narrowing fn | `isOpenBioOutput` | `isOpenProfileSectionOutput` |
| Server-side href helper | (only `buildBioHref`) | add `buildProfileSectionHref(username, section)` next to it |

`section: "bio" | "articles" | "posts" | "clone-settings"` for the dispatcher
(the user-UI surface includes all 4). The agent enum is the visitor-visible
subset: `"bio" | "articles" | "posts"`.

## 5. Implementation steps (in order)

> Apply the `.claude/rules/agent-parity.md` § "Adding a new agent verb —
> four-step checklist" in the same commit (or PR) — dispatcher → tool →
> vocabulary → tool data resolution scopes to `profileOwnerId`.

### Step 1 — Server: add `buildProfileSectionHref`
File: `packages/convex/convex/content/href.ts`

- Add `export type ProfileSection = "bio" | "articles" | "posts" | "clone-settings";`
- Add `export function buildProfileSectionHref(username: string, section: ProfileSection): string` that returns `/@${username}/${section}`.
- For `bio`, this MUST equal `buildBioHref(username)` — collapse them or have
  one delegate to the other so there's no parallel impl.
- For `articles` / `posts`, this MUST equal `buildContentHref(username, section)`
  with `slug` omitted.
- Cross-ref comment: parallel of `getProfileTabHref` at
  `apps/mirror/features/profile-tabs/types.ts:34-36` — `types.test.ts` (Step 7c)
  pins parity.

### Step 2 — Add `openProfileSection` agent tool (replacing `openBio`)
File: `packages/convex/convex/chat/tools.ts`

- Remove `openBio` from `buildCloneTools(profileOwnerId)`.
- Add `openProfileSection`:
  - `description`: include the existing `openBio` guidance for the bio
    branch ("opens bio panel; if hasEntries is false, briefly acknowledge
    empty bio") AND the new articles/posts branches ("opens the visitor's
    list view of articles/posts"). Plain conversational prose to match
    STYLE_RULES.
  - `inputSchema: z.object({ section: z.enum(["bio", "articles", "posts"]) })`
  - `execute`: switch on `section`.
    - `bio`: keep the existing `queryBioPanel` call → `{ kind: "bio", href, hasEntries }`.
    - `articles` / `posts`: new internal query `queryProfileSectionList` (Step 2a) → `{ kind, href, hasEntries }`.
  - All `ctx.runQuery` calls pass `userId: profileOwnerId` (server-derived; never an arg). The cross-user invariant in `.claude/rules/agent-parity.md` § "Cross-user isolation invariant — extends from RAG to actions" still holds.

### Step 2a — Internal query for articles/posts list presence
File: `packages/convex/convex/chat/toolQueries.ts`

- Add `queryProfileSectionList({ userId, section })` where `section ∈ {"articles", "posts"}`.
- Use the existing `by_userId_and_status` index with a `take(1)` for a presence
  check (mirroring `loadStreamingContext`'s pattern at `helpers.ts:256-273`).
  Drafts are not retrieval-eligible; only published rows count for `hasEntries`.
- Return `{ kind: "articles" | "posts", username, href, hasEntries }` where
  `href = buildContentHref(username, section)` (no slug).

### Step 3 — Update `TOOLS_VOCABULARY`
File: `packages/convex/convex/chat/helpers.ts:79-80`

- Replace the existing `openBio` clause with one mention of
  `openProfileSection`. Cover the same triggers:
  - bio / work history / education / professional background → `openProfileSection({ section: "bio" })`
  - "show me your articles" / "your posts" (list-level, no specific item) →
    `openProfileSection({ section: "articles" | "posts" })`
- Plain conversational prose, no markdown, no lists.
- Keep total length close to the current line — `composeSystemPrompt` budget is
  6000 chars; the fixed-section block at `helpers.ts:179-183` includes
  TOOLS_VOCABULARY and is **never** proportionally shrunk, so length here is
  load-bearing under budget pressure.

### Step 4 — Generalize the dispatcher
File: `apps/mirror/app/[username]/_providers/clone-actions-context.tsx`

- Replace `openBio` in the `CloneActions` type with:
  ```ts
  navigateToProfileSection: (args: {
    section: ProfileTabKind;   // imported from features/profile-tabs/types
    href?: string;             // server-built when called from the watcher
  }) => void;
  ```
- Implementation:
  ```ts
  const navigateToProfileSection = useCallback<CloneActions["navigateToProfileSection"]>(
    ({ section, href }) => {
      const basePath = href ?? getProfileTabHref(profile.username, section);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref],
  );
  ```
- Update the doc comment block: explain that this is the **tab-level**
  parallel of `navigateToContent`, both routes funnel through the dispatcher,
  the user-UI caller is `profile-tabs.tsx`, and the agent caller is the watcher.
  Delete the old "the dispatcher does not have a user-UI caller today" line —
  it would now be a lie.
- Update `useMemo` value + return.

### Step 5 — Wire ProfileTabs through the dispatcher
File: `apps/mirror/features/profile-tabs/components/profile-tabs.tsx`

Mirror the `post-list-item.tsx:26-42` pattern:

```tsx
const { navigateToProfileSection } = useCloneActions();

const handleClick = useCallback(
  (event: MouseEvent<HTMLAnchorElement>, kind: ProfileTabKind) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigateToProfileSection({ section: kind });
  },
  [navigateToProfileSection],
);
```

- Pass `onClick={(e) => handleClick(e, kind)}` into the `<Link>`.
- KEEP the `<Link href={buildChatAwareHref(getProfileTabHref(...))}` populated
  for SEO + middle/cmd-click semantics.
- KEEP `prefetch={false}` and `scroll={false}`.
- Component size remains under 100 lines; no extraction needed.
- Cross-ref comment above `handleClick` pointing to `clone-actions-context.tsx`
  and noting "post-list-item.tsx is the analogue for list items."

### Step 6 — Update the agent intent watcher
File: `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`

- Rename: `OPEN_BIO_TYPE` → `OPEN_PROFILE_SECTION_TYPE = "tool-openProfileSection"`.
- Rename narrowing: `isOpenBioOutput` → `isOpenProfileSectionOutput`.
- Output shape:
  ```ts
  type OpenProfileSectionOutput = {
    kind: "bio" | "articles" | "posts";
    href: string;
    hasEntries: boolean;
  };
  ```
- Dispatch:
  ```ts
  navigateToProfileSection({
    section: toolPart.output.kind,
    href: toolPart.output.href,
  });
  ```
- Keep the per-`toolCallId` idempotency Set logic at `handledByConversation`
  unchanged — module-scope persistence and the `null`-conversation bucket
  semantics are orthogonal to the verb rename.
- Update the destructuring at line 121 from `{ navigateToContent, openBio }` to
  `{ navigateToContent, navigateToProfileSection }`. Update the effect's deps
  array accordingly.

### Step 7 — Tests

#### 7a. `clone-actions-context.test.tsx`
File: `apps/mirror/app/[username]/_providers/__tests__/clone-actions-context.test.tsx`

Replace the `describe("CloneActionsProvider — openBio", ...)` block (lines
230-281) with `describe("CloneActionsProvider — navigateToProfileSection", ...)`.
Cover, for each of `bio | articles | posts | clone-settings`:

1. **Agent path** — when `href` is supplied (server-built), `router.push` is
   called with the exact server-built path + chat-aware suffix.
2. **User-UI path** — when `href` is omitted, `router.push` is called with
   `getProfileTabHref(profile.username, section)` + chat-aware suffix.
3. **`scroll: false` invariant.**
4. **Chat-aware suffix preservation** — both branches preserve
   `?chat=1&conversation=...` when `isChatOpen` is true and elide it when false.

The `clone-settings` case exercises the dispatcher (user-UI path only —
agents never navigate to clone-settings), proving the section enum on the
dispatcher side is wider than the agent enum.

#### 7b. `use-agent-intent-watcher.test.ts`
File: `apps/mirror/features/chat/hooks/__tests__/use-agent-intent-watcher.test.ts`

- Rename `openBioMock` → `navigateToProfileSectionMock`.
- Update the `vi.mock(...)` for `useCloneActions` to expose
  `navigateToProfileSection` instead of `openBio`.
- Replace each `tool-openBio` part fixture with `tool-openProfileSection`,
  `output: { kind: "bio" | "articles" | "posts", href, hasEntries }`.
- Add coverage for `kind: "articles"` and `kind: "posts"` parts in addition
  to the existing `bio` case.
- Keep the existing dispatch-once-across-remount and malformed-output tests;
  they translate 1:1 to the new shape.

#### 7c. `tools.test.ts`
File: `packages/convex/convex/chat/__tests__/tools.test.ts`

In the `inputSchema invariants` describe block (line 528-):

- Remove the `openBio.inputSchema is empty` assertion (line 615-).
- Add `openProfileSection.inputSchema does not expose userId (or any user identifier)` — same predicate as the existing `navigateToContent` assertion at line 579.
- Add `openProfileSection.inputSchema exposes only \`section\`, bounded to ["bio", "articles", "posts"]` — assert the zod schema's keys are exactly `["section"]` and the enum values are exactly the visitor-visible subset.

Add behavioral tests for `openProfileSection.execute`:

- For each of `bio`, `articles`, `posts`:
  - Owner with content present → `hasEntries: true`, `href` matches the
    server-built canonical path.
  - Owner with no content → `hasEntries: false`, `href` still well-formed.
- Cross-user isolation regression: a `posts` row owned by *another* user must
  NOT make `openProfileSection({ section: "posts" })` return `hasEntries: true`
  for the current `profileOwnerId`.

#### 7d. `profile-tabs/__tests__/types.test.ts`
File: `apps/mirror/features/profile-tabs/__tests__/types.test.ts`

Extend the existing `getProfileTabHref` describe block (lines 66-89):

- Add an assertion that `getProfileTabHref(_, section)` equals
  `buildProfileSectionHref(_, section)` for **all four** kinds. Today only
  `bio` is pinned (line 76-88). The compounding fix is to extend the
  href-parity invariant to every section so a future template drift fails
  loudly across the board.

### Step 8 — Cleanup & cross-ref comments

- In `clone-actions-context.tsx`: above `navigateToProfileSection`, comment
  reads "User-UI caller: `profile-tabs.tsx`. Agent caller:
  `use-agent-intent-watcher.ts`. Mirror of `navigateToContent` for tab-level
  navigation."
- In `profile-tabs.tsx`: above the `handleClick` callback, comment reads
  "Funnels normal left-clicks through `useCloneActions().navigateToProfileSection`
  — the same dispatcher the agent uses. cmd/middle/shift-click preserved for
  open-in-new-tab. Mirrors `post-list-item.tsx`'s click handler."
- Remove the documentation lie at the old `openBio` JSDoc block.

## 6. Constraints & non-goals

**Hard constraints** (lifted from the brief; restated so reviewers can audit
against them):

- ❌ Do NOT extend `navigateToContent` to accept `kind: "bio"`. Keep the
  tab-level navigation as a separate verb.
- ❌ Do NOT add a `userId` field to any tool's `inputSchema`. The
  `inputSchema invariants` block in `tools.test.ts` is the trust boundary.
- ❌ Do NOT introduce a parallel agent-only navigation path. Tools cannot
  call `router.push`; navigation is the watcher → dispatcher's job.
- ❌ Do NOT change the URL shape for any tab. `getProfileTabHref` and
  `buildProfileSectionHref` BOTH stay at `/@<username>/<section>`.
- ❌ Do NOT regress the chat-aware href + `scroll: false` behavior for any
  tab. Both paths must funnel through `buildChatAwareHref` and pass
  `{ scroll: false }`.
- ❌ Do NOT include `clone-settings` in the agent's `section` enum. It's
  owner-gated server-side and irrelevant to a visitor's clone agent.

**Non-goals** (explicit scope cuts):

- No new agent tools beyond `openProfileSection`. If we later want
  `openLatestArticleList` etc., that's a separate planning lap.
- No refactor of `useAgentIntentWatcher`'s `handledByConversation`
  module-scope Map. Idempotency semantics are orthogonal.
- No change to `PROFILE_TAB_DISPLAY_ORDER`, `PROFILE_TAB_LABELS`, or the
  default-kind logic.
- No telemetry/analytics events on tab dispatch. (If they're wanted later,
  the dispatcher is the single attachment point — that's the compounding
  payoff.)
- No change to `clone-settings` owner-gating (the existing `isOwner` filter
  on `visibleKinds` stays).

## 7. Hard verification

### Tier 4 — build + lint + Playwright e2e (per `.claude/rules/verification.md`)

```bash
pnpm --filter=@feel-good/mirror build
pnpm --filter=@feel-good/mirror lint
pnpm --filter=@feel-good/convex build
pnpm --filter=@feel-good/mirror test:unit -- profile-tabs use-agent-intent-watcher clone-actions-context
pnpm --filter=@feel-good/convex test -- tools.test
pnpm --filter=@feel-good/mirror test:e2e profile-tabs-dispatcher
```

All must pass before the PR is mergeable.

### Hard verification — Playwright CLI spec

> Per `.claude/rules/verification.md`: Playwright CLI only. Chrome MCP is
> for visual debugging, not test assertions.

**File:** `apps/mirror/e2e/profile-tabs-dispatcher.spec.ts`

**Pre-conditions:** rick-rubin fixture user has at least 1 published article,
1 published post, and at least 1 bio entry (already true in the seed; lean on
the same fixture `chat-agent-navigates.authenticated.spec.ts` and the bio
specs use).

**Assertions** (one Playwright test per assertion or grouped into `test.describe`):

1. **`/@user/posts?chat=1&conversation=…` → click Bio tab → URL becomes `/@user/bio?chat=1&conversation=<same>`**
   - `await page.goto('/@rick-rubin/posts?chat=1');` then wait for the chat
     panel to mount and the `?conversation=` param to populate.
   - Capture the conversation id from the URL.
   - `await page.getByRole('tab', { name: 'Bio' }).click();`
   - `await expect(page).toHaveURL(/\/@rick-rubin\/bio(\?|$)/);`
   - `expect(page.url()).toMatch(/[?&]chat=1\b/);`
   - `expect(page.url()).toContain(\`conversation=${capturedConversationId}\`);`
   - `await expect(page.getByTestId('bio-panel')).toBeVisible();`

2. **Repeat for Articles → Posts → Clone Settings (owner only — gated test)**
   - For Articles and Posts, the matrix is identical: click via
     `getByRole('tab', { name: 'Articles' | 'Posts' })`, assert URL pivots
     to the section + chat suffix preserved.
   - For Clone Settings, run as an authenticated owner spec
     (`*.authenticated.spec.ts`); assert the URL pivots to
     `/@<owner>/clone-settings` and the chat suffix is preserved. (Confirms
     the dispatcher's wider `section` enum works for the owner path even
     though no agent tool covers it.)

3. **Cmd/meta-click on a tab opens a new tab — open-in-new-tab semantics preserved**
   - From `/@rick-rubin/posts?chat=1`, do
     `await page.getByRole('tab', { name: 'Bio' }).click({ modifiers: ['Meta'] });`
     and assert via `const [newPage] = await Promise.all([page.context().waitForEvent('page'), …]);`
     that a new tab opens at `/@rick-rubin/bio` (without the chat suffix is
     fine — the new tab inherits the `<Link href>`).
   - The original tab MUST still be at `/@rick-rubin/posts?chat=1`.
   - This proves the `if (event.metaKey ...) return;` early return in the
     click handler still surrenders to default `<Link>` behavior.

4. **Direct goto regression guard**
   - `await page.goto('/@rick-rubin/bio');` (no chat suffix) — assert
     `bio-panel` testid is visible. Confirms the dispatcher doesn't
     interfere with cold loads. Same for articles, posts.

5. **Cross-user negative path (parallel to `chat-agent-navigates.authenticated.spec.ts:112`)**
   - Open chat on rick-rubin's profile, send "show me Bob's bio". Assert
     the URL never pivots to `/@bob/bio` (the agent's `openProfileSection`
     resolution closes over `profileOwnerId = rick-rubin` and the tool
     either returns rick-rubin's own bio or throws — the watcher only
     dispatches for the owner-scoped result).

**Run command** (canonical, used in the verification block above):

```bash
pnpm --filter=@feel-good/mirror test:e2e profile-tabs-dispatcher
```

Each assertion above is independently necessary — collectively they prove:
- the user-UI half of the dispatcher fires (#1, #2),
- the chat-aware suffix invariant holds end-to-end (#1, #2),
- middle-click semantics are preserved (#3),
- cold loads still work (#4),
- the cross-user isolation invariant the agent verb relies on still holds (#5).

### Manual-only sanity check (Tier 4 supplement, not a substitute)

Use Chrome MCP to confirm the active-tab visual state still tracks
`currentKind` after dispatcher routing — Radix `Tabs` updates the visual
selection from the URL via the `value={currentKind}` prop on the parent
`<Tabs>`, which is unchanged. This is visual confirmation only; the
Playwright assertions above are the load-bearing proof.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| The agent's `openBio` system-prompt vocabulary is in active use; renaming the tool mid-stream could break in-flight conversations. | The system prompt is recomposed every request from `composeSystemPrompt`; there is no persisted prompt cache keyed on tool names. The next message after deploy uses the new vocabulary. |
| `ProfileTabs` is rendered both desktop and mobile; the `onClick` may not fire consistently on touch tap-then-release. | The `event.button !== 0` early return only triggers for pointer types where `button` is non-zero. Touch taps surface as `button === 0` like normal left-clicks. Add a Playwright mobile-viewport variant of assertion #1 to confirm. |
| Adding `articles`/`posts` to the agent enum could cause the LLM to call `openProfileSection` instead of `getLatestPublished`+`navigateToContent` for a "show me your latest article" prompt — degrading the existing flow. | Vocabulary phrasing in `TOOLS_VOCABULARY` (Step 3) MUST distinguish: "list view of articles/posts" → `openProfileSection`; "the latest article" / "the article about X" → `getLatestPublished` + `navigateToContent`. Add a regression e2e on the existing `chat-agent-navigates.authenticated.spec.ts` "positive path" so we'd see if the agent's verb pick drifts. |
| The href-parity assertion in `types.test.ts:76` only covers `bio` today; extending it to all 4 kinds (Step 7d) might surface a pre-existing drift between `getProfileTabHref` and `buildContentHref` for `articles`/`posts`. | Both helpers produce `/@<user>/<kind>` (no slug). Step 7d's failure mode would be a real bug — fix at root rather than narrow the assertion. |

## 9. PR shape

Single PR, `git push -u origin fix-bio-pairity`. Commit ordering:

1. Server: `buildProfileSectionHref` + `queryProfileSectionList`.
2. Server: `openProfileSection` tool + `TOOLS_VOCABULARY` rewrite.
3. Tools tests updated.
4. Client: `useCloneActions` verb rename.
5. Client: ProfileTabs `onClick` wiring.
6. Client: watcher rename.
7. Client tests + Playwright e2e.
8. Documentation comments cleanup (Step 8).

Each commit should `pnpm build` + `pnpm lint` clean. The PR description names
the agent-parity rule, links to the four-step checklist, and points reviewers
at the `inputSchema invariants` block as the trust boundary.
