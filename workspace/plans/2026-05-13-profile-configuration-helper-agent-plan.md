---
id: PLAN_012
slug: profile-configuration-helper-agent
title: "Profile configuration helper agent"
date: 2026-05-13
type: feature
status: implemented
branch: codex/profile-configuration-helper-agent
worktree: null
scope: "Add an owner-only chat mode that lets profile owners populate and maintain Bio entries and Contact/social links through agent tools instead of manual profile UI work."
apps: [mirror]
packages: [convex]
verification_tier: 5
predecessor: PLAN_005
---
## 1. Summary

Add a second chat mode for profile owners: the existing chat remains the public digital-clone experience, while `configuration` mode is an owner-only helper that updates the owner's profile data. The owner opens it from a new button next to `EditProfileButton`, chats with a configuration helper, and the helper can read current profile configuration, create/update/delete structured Bio entries, and create/update/delete Contact/social links.

This is an agent-parity feature, but not a visitor-navigation feature. The profile owner can already manage Bio and Contact through UI forms; the agent path must reuse the same storage rules, validation, embedding scheduling, and content-panel dispatcher after writes. The configuration agent must never accept a user id in its tool schemas. It derives the owner from the conversation and only enables write tools when `viewerId === profileOwnerId`.

LinkedIn and other public URLs are supported in two ways:

- Social/contact links are parsed directly from chat text and saved as Contact entries.
- Public profile URLs can be fetched best-effort as profile-source text for Bio extraction, but the implementation must explicitly handle LinkedIn blocking or private/auth-required pages by asking the owner to paste resume/LinkedIn text. No authenticated LinkedIn scraping is in scope.

## 2. Current State

- `ProfilePanel` renders the mobile owner `EditProfileButton` at `apps/mirror/app/[username]/_components/profile-panel.tsx`. Desktop renders the matching owner edit button in `apps/mirror/app/[username]/_components/workspace-panels.tsx`.
- `useChatSearchParams` only understands `chat=1` and `conversation=...`. There is no route-level agent mode.
- `ChatRouteController` auto-selects conversations from `api.chat.queries.getConversations({ profileOwnerId })` and has no mode filtering.
- `conversations` currently store `profileOwnerId`, optional `viewerId`, `threadId`, title, status, and streaming lock fields. There is no prompt/tool mode on the row, so every conversation streams through the clone prompt.
- `streamResponse` always composes the digital-clone system prompt via `loadStreamingContext`, runs RAG against the owner's content, and attaches `buildCloneTools(profileOwnerId, { viewerId })`.
- Bio UI writes call `api.bio.mutations.create/update/remove`, which validate and schedule embedding generation/deletion for `bioEntries`.
- Contact UI writes call `api.contacts.mutations.create/update/remove`, which validate one entry per platform, require HTTPS URLs for socials, and schedule embedding generation/deletion for `contactEntries`.
- Existing owner-write chat tools for posts/articles live in `packages/convex/convex/chat/tools.ts`; they already establish the right security shape: factory closes over `profileOwnerId`, write tools assert `viewerId === profileOwnerId`, tool schemas expose no user identifier, and client navigation still goes through `useAgentIntentWatcher` → `useCloneActions`.

## 3. Design

Introduce `ChatMode = "clone" | "configuration"` and persist it on `conversations`. Existing rows become `"clone"` through a widen/backfill/narrow migration. New clone conversations continue to behave exactly as they do today; new configuration conversations are only creatable and readable by the profile owner.

Load-bearing invariant: conversation mode is immutable. Each conversation row has exactly one `threadId`, created at insert time, and that thread must never mix clone and configuration system prompts/tools. `mode` is set only when the conversation is created. Every later `sendMessage` and `retryMessage` call must compare the incoming/requested mode with the existing conversation row and reject mismatches, for example a clone `conversationId` sent with `mode: "configuration"`.

Owner boundary invariant: configuration conversations are owner-only at the send boundary, not only at tool execution. Creating a configuration conversation requires an authenticated app user whose `_id` equals `profileOwnerId`; the inserted row must have `viewerId: profileOwnerId`. Anonymous callers and non-owner authenticated viewers are rejected before thread/conversation creation. Existing configuration conversations are readable, listable, sendable, and retryable only by that owner.

The URL mode is `chatMode=configuration`; omitted means clone. The new configure button calls `openChat({ mode: "configuration" })`, deletes any stale `conversation` param, and opens the same interaction panel. `buildChatAwareHref` must preserve `chatMode` along with `chat=1` and `conversation=...`; otherwise a configuration write that navigates to Bio/Contact would silently drop the user back into clone mode. The chat header and input copy should make the active mode clear: "Profile helper" instead of the profile owner's clone name, and a configuration-specific placeholder.

The backend chooses prompt and tools by conversation mode:

- `clone`: current prompt, RAG, and `buildCloneTools`.
- `configuration`: new configuration prompt, no published-content RAG, no persona/tagline/tone/topics-to-avoid injection, and `buildConfigurationTools`.

The configuration prompt must be a fresh composer, not a flag on `composeSystemPrompt`. It should say the helper configures the owner's profile, does not speak as the owner, asks a clarification before ambiguous destructive or bulk replacement work, and uses tools to make concrete changes. Keep it short and plain-text, matching the current chat style rules. The prompt module owns the configuration tools vocabulary; per the agent-parity checklist, every configuration tool registered in `buildConfigurationTools` must be named in that vocabulary.

The configuration tool surface should be deliberately small:

- `getProfileConfiguration()` returns current Bio entries and Contact entries.
- `fetchProfileSource({ url })` best-effort fetches public HTTPS profile/resume text with SSRF guards and size limits. It also returns detected social kind for known social URLs.
- `applyBioEntryPatch({ operations })` applies a batch of create/update/delete operations to `bioEntries`.
- `applyContactEntryPatch({ operations })` applies a batch of set/delete operations to `contactEntries`, using contact kind as the natural key.

Batch tools avoid a long multi-step tool chain when the owner pastes a resume. Patch tools must execute as one internal mutation per tool call, so Convex transaction semantics make each patch all-or-nothing. If operation 3 fails validation, operations 1 and 2 must not remain applied. Dates in tool schemas should be structured `{ year, month? }`, not epoch milliseconds; `endDate` must also accept `null` or an explicit `present: true` shape for ongoing roles. Server helpers convert dated values to the first day of the month in UTC before calling the shared Bio validation/write logic.

After a successful Bio or Contact patch, the tool result shape is fixed:

- `applyBioEntryPatch` returns `{ section: "bio", href, applied: { created, updated, deleted } }`.
- `applyContactEntryPatch` returns `{ section: "contact", href, applied: { upserted, deleted } }`.

The `href` is server-built with `buildBioHref` or `buildContactHref`. The client watcher handles only these write-tool outputs by calling the existing `navigateToProfileSection({ section, href })`, so the updated panel opens through the same dispatcher used by human UI navigation. No new `useCloneActions` verb is needed. Data-only tools such as `getProfileConfiguration` and `fetchProfileSource` must not be added to the watcher's navigation-trigger constants.

## 4. Implementation Steps

### Step 1 - Add chat mode types and URL parsing

Files:

- `apps/mirror/features/chat/types.ts`
- `apps/mirror/features/chat/lib/chat-mode.ts` (new)
- `apps/mirror/hooks/use-chat-search-params.ts`

Add `ChatMode`, a parser for `chatMode`, and `openChat({ mode?: ChatMode })`. Omit the param for clone mode; set `chatMode=configuration` for configuration mode. `setConversation` and `buildChatAwareHref` must preserve the current mode when replacing the conversation id or navigating the content panel. Closing chat clears `chat`, `conversation`, and `chatMode`.

### Step 2 - Add the owner-only configure button

Files:

- `apps/mirror/features/profile/components/configure-profile-button.tsx` (new)
- `apps/mirror/features/profile/index.ts`
- `apps/mirror/app/[username]/_components/profile-panel.tsx`
- `apps/mirror/app/[username]/_components/workspace-panels.tsx`

Create an icon+tooltip button matching `EditProfileButton`. Render it only for `isOwner` and only when the edit form action buttons are not visible. Wire it next to the edit button on both mobile (`ProfilePanel`) and desktop (`WorkspaceInteractionPanel`) because desktop owns that floating control today.

### Step 3 - Widen conversations for mode

Files:

- `packages/convex/convex/chat/schema.ts`
- `packages/convex/convex/chat/mode.ts` (new)
- `packages/convex/convex/chat/queries.ts`
- `packages/convex/convex/chat/mutations.ts`

Deploy 1 shape:

- Add `mode: v.optional(chatModeValidator)` to `conversations`.
- Add an index such as `by_profileOwnerId_and_viewerId_and_mode`.
- New conversations always write `mode`.
- Mode is immutable: `sendMessage` accepts optional `mode`, defaults to clone for existing callers, writes mode only on insert, and rejects an existing `conversationId` when `conversation.mode ?? "clone"` differs from the incoming mode.
- Configuration conversation creation requires an authenticated owner. The app user must exist, `appUser._id` must equal `profileOwnerId`, and the inserted row must have `viewerId: profileOwnerId`. Anonymous callers and non-owner callers are rejected before `createThread`.
- Existing configuration conversations can only receive sends/retries from the profile owner. Clone conversation behavior stays unchanged.
- Reads treat missing mode as `"clone"` during the migration window. This fallback applies everywhere a conversation row is read or mode-branched: `getConversations`, `getConversation`, `listThreadMessages`, `internalGetConversation`, `loadStreamingContext`, `retryMessage`, `sendMessage`, and `clearStreamingLock`.
- `getConversations` accepts `mode`, returns only matching-mode rows, and returns `[]` for configuration mode unless the viewer is the profile owner.
- `getConversation`/`listThreadMessages` include mode in the returned shape and enforce the same owner-only rule for configuration rows.
- Rate limiting is mode-aware. Clone mode keeps the existing buckets. Configuration mode adds separate owner-only buckets:
  - `createConfigurationConversation`: fixed window, 2/minute, keyed by owner id.
  - `sendConfigurationMessage`: fixed window, 4/minute, keyed by owner id.
  - `retryConfigurationMessage`: fixed window, 3/minute, keyed by owner id.
  - `sendConfigurationDailyOwner`: token bucket, keyed by owner id, charged by an input-token estimate such as `Math.ceil(content.length / 4)` with a documented tool-call reserve. Starting point: 60,000/day with 15,000 burst capacity. Do not reuse the current 500/day auth clone bucket for resume ingestion.

### Step 4 - Backfill and narrow conversation mode

Files:

- `packages/convex/convex/migrations/chat.ts` (new)
- follow-up edit to `packages/convex/convex/chat/schema.ts`

Use the project migration pattern: widen, run a dry-run backfill, run the real backfill, verify, then narrow. For this small row update, a batched internal mutation is acceptable if the current conversation count is known to be small; otherwise use `@convex-dev/migrations`.

Backfill every conversation with missing `mode` to `"clone"`. Verify no rows remain with missing mode and no in-flight streams are misrouted. After verification, make `mode` required and remove legacy read fallbacks in every read path listed in Step 3.

### Step 5 - Split clone vs configuration streaming

Files:

- `packages/convex/convex/chat/helpers.ts`
- `packages/convex/convex/chat/actions.ts`
- `packages/convex/convex/chat/configurationPrompt.ts` (new)
- `packages/convex/convex/chat/configurationTools.ts` (new)

Return conversation mode from `loadStreamingContext`. In `streamResponse`, branch by mode:

- clone mode keeps current RAG and `buildCloneTools`.
- configuration mode skips published-content RAG, skips persona/tagline/tone/topics-to-avoid injection, uses `composeConfigurationPrompt`, sets a slightly higher tool-step budget for source-fetch plus patch flows, and attaches `buildConfigurationTools`.
- `composeConfigurationPrompt` includes a short tools-vocabulary section naming `getProfileConfiguration`, `fetchProfileSource`, `applyBioEntryPatch`, and `applyContactEntryPatch`.
- The helper must summarize parsed resume/profile data and ask for confirmation before writing more than three Bio entries in one patch or before bulk replacement/deletion. It should not invent missing months when only a year appears in the source.

Keep the same `cloneAgent` singleton; the per-turn system prompt and tool set are what make the runtime agent different.

### Step 6 - Extract shared Bio and Contact write helpers

Files:

- `packages/convex/convex/bio/mutations.ts`
- `packages/convex/convex/bio/writeHelpers.ts` (new)
- `packages/convex/convex/contacts/mutations.ts`
- `packages/convex/convex/contacts/writeHelpers.ts` (new)
- `packages/convex/convex/chat/toolMutations.ts`

Move validation and database writes into user-scoped helpers that accept a server-derived `userId`. Public auth mutations call the helpers with `getAppUser(ctx, ctx.user._id)`. Configuration internal mutations call the same helpers with the closure-bound `profileOwnerId` after checking `viewerId === profileOwnerId`.

For contacts, add an internal upsert-by-kind helper so chat can naturally say "set my LinkedIn to ...". Keep the UI's create/update/remove flows unchanged.

### Step 7 - Implement configuration tools

Files:

- `packages/convex/convex/chat/configurationTools.ts`
- `packages/convex/convex/chat/toolQueries.ts`
- `packages/convex/convex/chat/toolMutations.ts`
- `packages/convex/convex/contacts/detectContactKind.ts` (new)

Tool rules:

- No tool input schema may include `userId`, `viewerId`, `ownerId`, `username`, or similar identifiers.
- `getProfileConfiguration` returns only the current profile owner's Bio and Contact rows.
- `fetchProfileSource` accepts only HTTPS URLs and uses a dedicated guarded fetcher, not the image-only helper. Required guard list:
  - DNS-resolve the hostname before each request and reject private, loopback, link-local, multicast, and metadata-service IPs, including IPv4 and IPv6 ranges such as `169.254.169.254`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`, and `fe80::/10`.
  - Re-resolve on every redirect hop and cap redirects at 3.
  - Cap response body bytes at 1 MB, extracted text length at a documented prompt-safe maximum, and total wall-clock time at 5 seconds.
  - Accept only `text/html`, `text/plain`, and `application/json` content types.
  - Send no cookies or auth headers; use a fixed product user agent.
  - Return `{ status: "unavailable", reason }` for blocked/private/auth-required pages rather than throwing into the model's text recovery.
  - Enforce a per-conversation tool-call limiter, starting at 3 fetches/minute keyed by `conversationId`, plus a daily owner cap such as 25 fetches/day.
- `applyBioEntryPatch` validates titles, descriptions, links, dates, ownership, limits, and embedding side effects through shared helpers.
- `applyContactEntryPatch` validates kind/value through existing contact rules, upserts socials by kind, deletes by kind, and schedules embedding side effects through shared helpers.
- `applyBioEntryPatch` and `applyContactEntryPatch` each call exactly one internal mutation per patch tool call. That internal mutation applies the full operation batch inside one Convex transaction, so the patch is all-or-nothing.
- Patch result shapes are pinned:
  - Bio: `{ section: "bio", href, applied: { created: number, updated: number, deleted: number } }`.
  - Contact: `{ section: "contact", href, applied: { upserted: number, deleted: number } }`.
- `contacts/detectContactKind.ts` must emit only the existing schema tuple: `email | linkedin | instagram | x | tiktok | youtube`. Map `twitter.com` and `x.com` to `x`; do not emit unsupported kinds such as `twitter`, `bluesky`, or `github`.

Prompt guidance should require a list/read step before editing or deleting existing Bio entries unless the patch target is already unambiguous from the current tool result.

### Step 8 - Teach the client watcher about configuration write results

File:

- `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`

Add output guards for `tool-applyBioEntryPatch` and `tool-applyContactEntryPatch`. On successful output, dispatch `navigateToProfileSection({ section: "bio" | "contact", href })` through the existing `useCloneActions` dispatcher. Keep idempotency keyed by `toolCallId` exactly as it is now.

Do not add a new dispatcher verb and do not change `clone-actions-context.tsx` for this feature unless a test reveals `buildChatAwareHref` needs the mode-preservation update from Step 1. Also do not add read-only tool parts (`tool-getProfileConfiguration`, `tool-fetchProfileSource`) to the watcher constants, because they are data-only and must not trigger navigation.

### Step 9 - Pass mode through chat UI state

Files:

- `apps/mirror/app/[username]/_providers/chat-route-controller.tsx`
- `apps/mirror/app/[username]/_components/chat-panel.tsx`
- `apps/mirror/features/chat/context/chat-context.tsx`
- `apps/mirror/features/chat/hooks/use-chat.ts`
- `apps/mirror/features/chat/hooks/use-chat-send.ts`
- `apps/mirror/features/chat/components/chat-thread.tsx`
- `apps/mirror/features/chat/components/chat-header.tsx`
- `apps/mirror/features/chat/components/chat-input.tsx`
- `apps/mirror/features/chat/components/chat-conversation-list-sheet.tsx`

Thread mode through providers, sends, retries, list filtering, header copy, and input placeholder. Configuration mode should not show visitor clone wording such as "Message {profileName}" or "Conversations may be visible to {profileName}". Use a neutral helper label and keep conversation lists mode-scoped.

The conversation sheet is mode-scoped: in configuration mode, it shows only configuration conversations; in clone mode, it shows only clone conversations. First-time owners should see an empty configuration list when they open the helper, even if they have existing clone conversations.

For resume paste support, raise the message length only for owner-only configuration mode, for example `CONFIG_MESSAGE_MAX_LENGTH = 12000`, while leaving public clone chat at the current `3000` character cap.

## 5. Tests

Convex unit tests:

- `packages/convex/convex/chat/__tests__/mode.test.ts`
  - existing conversations default/backfill to clone during the widen window.
  - configuration conversations require authenticated owner access.
  - creating a configuration conversation rejects anonymous callers.
  - creating a configuration conversation rejects authenticated non-owners.
  - inserted configuration rows pin `viewerId === profileOwnerId`.
  - mode is immutable: clone conversation id plus `mode: "configuration"` rejects, and configuration conversation id plus clone mode rejects.
  - `retryMessage` on a configuration conversation uses the configuration prompt/tool path.
  - clone and configuration conversation lists do not bleed into each other.
  - all widen-window read paths treat missing mode as clone, including `loadStreamingContext` and streaming lock cleanup.
- `packages/convex/convex/chat/__tests__/configurationTools.test.ts`
  - every configuration tool schema excludes user identifiers.
  - non-owner viewers cannot execute write tools.
  - Bio create/update/delete scopes to `profileOwnerId`, rejects cross-user ids, validates date ranges, and schedules embedding changes.
  - Bio ongoing roles accept `endDate: null` or the chosen `present` shape and do not hallucinate months in parser-facing examples.
  - Contact set/delete scopes to `profileOwnerId`, rejects invalid/http URLs, detects known social URL kinds, and schedules embedding changes.
  - `fetchProfileSource` rejects non-HTTPS URLs, private/loopback/link-local/metadata IPs, too many redirects, oversize bodies, slow responses, and unsupported content types.
  - `fetchProfileSource` sends no cookies/auth headers, uses a fixed user agent, is rate-limited per conversation, and returns `unavailable` rather than throwing for blocked pages.
  - patch tools are all-or-nothing: a failing operation rolls back earlier operations in the same batch.
  - patch tool result shapes exactly match the watcher contract.
- `packages/convex/convex/chat/__tests__/rateLimits.test.ts`
  - configuration sends use configuration buckets, not clone buckets.
  - configuration daily limits are charged by estimated input token count.
  - `fetchProfileSource` is limited per conversation and by owner daily cap.
- Existing `bio` and `contacts` mutation tests still pass after helper extraction.

React/unit tests:

- `chat-route-controller.test.tsx` covers mode-aware auto-selection and new conversation intent.
- `use-agent-intent-watcher.test.ts` covers config tool outputs dispatching to Bio/Contact exactly once.
- `use-agent-intent-watcher.test.ts` also proves data-only tools do not dispatch navigation.
- `use-chat-search-params` coverage proves `buildChatAwareHref` preserves `chatMode=configuration`.
- Add profile-panel/workspace-panel tests proving owners see the configure button next to edit, visitors do not, and edit action mode hides the configure shortcut.

Playwright CLI e2e:

- New file: `apps/mirror/e2e/profile-configuration-agent.authenticated.spec.ts`.
- Assertions:
  - signed-in profile owner sees "Configure profile" next to "Edit Profile".
  - clicking it opens chat with `chatMode=configuration` and configuration helper copy.
  - sending a social-link message such as "Set my LinkedIn to https://www.linkedin.com/in/test-owner and my X to https://x.com/testowner" creates or updates Contact entries, opens `/@<username>/contact`, preserves `chat=1`, and shows both links.
  - sending a short pasted resume excerpt creates a Bio work entry, opens `/@<username>/bio`, preserves `chat=1`, and shows the expected title/date.
  - content-panel navigation after a configuration write preserves `chatMode=configuration` and the active `conversation`.
  - a visitor cannot see the configure button and cannot create a configuration conversation by direct URL or mutation path.

## 6. Hard Verification

Run targeted Convex tests:

```bash
pnpm --filter=@feel-good/convex test -- chat/__tests__/mode.test.ts chat/__tests__/configurationTools.test.ts chat/__tests__/rateLimits.test.ts bio/__tests__/mutations.test.ts contacts/__tests__/mutations.test.ts
```

Run Mirror build and lint:

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

Run targeted Playwright CLI e2e:

```bash
pnpm --filter=@feel-good/mirror test:e2e apps/mirror/e2e/profile-configuration-agent.authenticated.spec.ts
```

Hard e2e assertions:

- Owner-only configure button is visible beside edit controls.
- Configuration chat opens with `chatMode=configuration`.
- Contact/social links can be set from a chat message and appear in the Contact panel.
- Bio entries can be created from pasted resume text and appear in the Bio panel.
- Updated panel URLs preserve `chat=1`, `chatMode=configuration`, and the active `conversation`.
- Non-owners cannot access the configuration agent or tools.

## 7. Constraints And Non-Goals

- Do not expose user identifiers in any agent-visible tool schema.
- Do not let visitors or anonymous users create or use configuration conversations.
- Do not allow a conversation to change modes after creation. A single thread must never mix clone and configuration prompts/tools.
- Do not merge the configuration helper into the public digital-clone prompt; the modes must have separate prompts and tool surfaces.
- Do not navigate directly from server tools. Tool results return canonical hrefs; the client watcher dispatches through `useCloneActions`.
- Do not add a new `useCloneActions` dispatcher verb for Bio/Contact writes; reuse `navigateToProfileSection`.
- Do not let data-only configuration tools trigger client navigation.
- Do not rewrite Bio/Contact UI forms. Extract shared write helpers, but keep existing UI behavior and optimistic updates intact.
- Do not add authenticated scraping for LinkedIn or other social networks. Public URL fetch is best-effort only; blocked/private pages should lead the helper to ask for pasted text.
- Do not tackle clone persona settings, avatar upload, default profile section, articles, or posts in this plan. The mode and helper structure should make those straightforward future tools.

## 8. Risks

- LLM resume extraction can duplicate existing Bio rows if the current profile is already populated. It can also hallucinate months or over-extract from sparse text. Mitigate by making `getProfileConfiguration` part of the recommended workflow and asking before replace/delete operations, before writing more than three entries, and whenever dates are partial or ambiguous.
- LinkedIn often blocks unauthenticated fetches. The product must treat URL ingestion as best-effort and keep the pasted-resume path first-class.
- Raising message length for configuration mode increases model cost. Keep the larger cap owner-only, avoid published-content RAG in configuration mode, and use the separate configuration daily bucket rather than silently draining the public clone bucket.
- `fetchProfileSource` could become a scanning primitive if under-guarded. Keep SSRF checks, content-type checks, redirect limits, timeouts, and per-conversation rate limits in the tool layer before exposing it to the model.
- The conversation mode migration touches chat routing and auth. Ship with widen/backfill/narrow discipline and keep legacy clone reads working during the migration window.

## 9. Done Criteria

- Profile owners can open a configuration helper from the profile panel without entering edit mode.
- The helper can create, update, and delete structured Bio entries through chat.
- The helper can create, update, and delete social/contact links through chat.
- Resume text and public/social URLs are usable inputs, with clear fallback when a public URL cannot be fetched.
- Configuration conversations are isolated from clone conversations.
- Conversation mode is immutable and owner-only configuration creation is enforced at `sendMessage`.
- Owner-only authorization, cross-user isolation, no-user-id tool schemas, tool result shapes, all-or-nothing patch semantics, rate limits, and SSRF guards are covered by tests.
- Build, lint, targeted Convex tests, and targeted Playwright CLI e2e pass.