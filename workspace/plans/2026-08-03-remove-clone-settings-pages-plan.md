---
id: PLAN_015
slug: remove-clone-settings-pages
title: "Remove clone customization and profile settings"
date: 2026-08-03
type: migration
status: active
branch: hpark0011/remove-clone-settings-pages
worktree: null
scope: "Remove the Clone and Settings pages, alternate owner configuration paths, their persisted preferences, and every dedicated code, test, documentation, agent, skill, and harness artifact."
apps: [mirror]
packages: [convex]
verification_tier: 5
---

## Goal

Mirror is pivoting toward a uniform, minimalist portfolio for builders. An author should express a brand through published work, not through a configurable clone persona or profile behavior.

This removal establishes four product invariants:

1. The profile tab row never exposes `Clone` or `Settings`.
2. `/@username/clone-settings` and `/@username/settings` no longer exist and return the normal application 404 for every viewer, including the owner.
3. Every profile opens the same canonical default section, Posts; there is no stored or callable default-section preference.
4. There is no alternate owner-only configuration chat, persona prompt, tone preset, avoided-topic preference, or chat-auth preference left behind after the migration is complete.

## Scope Decision

In this session, “Clone page” means the current owner-only `/clone-settings` customization surface and any alternate path that can perform the same configuration work. That includes the owner-only `configuration` chat mode and its profile/content authoring tools because leaving it in place would preserve a hidden settings system after the visible page is gone.

The ordinary public clone chat remains in this session. It becomes non-configurable and derives its voice only from the author’s name, tagline, and published content. Removing public chat, video calls, Tavus/Daily, and the remaining conversation feature is a separate pivot step. This boundary avoids mixing a page/settings deletion with a full interaction-shell rewrite.

## Current State

### Two visible settings pages

- `apps/mirror/app/[username]/@content/clone-settings/page.tsx` owner-gates and renders `CloneSettingsPanel`; the sibling canonical route file exists only to satisfy the parallel route.
- `apps/mirror/features/clone-settings/**` owns the persona form, tone selector, character counters, clear dialog, toolbar, hook, schemas, unit tests, and five Playwright specs.
- `apps/mirror/app/[username]/@content/settings/page.tsx` owner-gates and renders `SettingsPanel`; its sibling route is another parallel-route stub.
- `apps/mirror/features/settings/**` owns the default-content form, selector, toolbar, hook, schema, and unit test.
- `apps/mirror/features/profile-tabs/types.ts` labels the two route kinds `Clone` and `Settings`; `ProfileTabs` exposes them only to owners.
- `apps/mirror/next.config.ts` explicitly rewrites both public `@username` URL shapes.

### A hidden settings path

- `ConfigureProfileButton` appears beside Edit on desktop and mobile and opens chat with `chatMode=configuration`.
- The chat client, controller, components, search-param hook, and intent watcher all branch on `clone | configuration`.
- `packages/convex/convex/chat/configurationPrompt.ts` and `configurationTools.ts` implement an owner-only configuration agent.
- Configuration-only primitives in `chat/toolQueries.ts` and `chat/toolMutations.ts` can update Bio, Contact, Projects, Posts, and Articles.
- Configuration-only support includes `content/agentBody.ts`, `contacts/detectContactKind.ts`, `undici`, dedicated tests, and two profile-configuration E2E specs.

### Persisted customization

The `users` table can store five fields that conflict with the new product constraints:

- `personaPrompt`
- `tonePreset`
- `topicsToAvoid`
- `chatAuthRequired`
- `defaultProfileSection`

The first three change clone voice, `chatAuthRequired` changes visitor access behavior, and `defaultProfileSection` changes profile navigation. Public/current profile validators expose these values, auth/profile creation writes the default, and the chat prompt reads the persona values.

The `conversations` table also stores optional `mode: "clone" | "configuration"`. Configuration conversations may contain private resume or profile-source material, so simply making them unreachable is not sufficient cleanup.

### Repository artifacts

- Live rules and docs in `apps/mirror/AGENTS.md`, `.claude/**`, `.agents/**`, `.codex/**`, and `workspace/**` describe the removed routes, fields, and configuration agent.
- Plans `PLAN_012` and `PLAN_013` are dedicated to the configuration helper and its content-authoring extension.
- Several completed tickets are dedicated only to Clone Settings or configuration-mode behavior; mixed tickets, tests, and comments also cite those surfaces.
- `.agents/worktrees/eager-wiles/` is an ignored but still tracked 1,167-file embedded worktree snapshot. It contains a second stale Mirror implementation, duplicate clone/video plans, skills, packages, and test harnesses. Nothing outside that directory references it. Leaving it tracked would preserve obsolete product code and make repository-wide absence checks meaningless.
- No current top-level skill outside that embedded snapshot directly implements Clone Settings, profile settings, or configuration chat. The live chat-backend agent definitions do contain persona/configuration instructions and need narrowing rather than wholesale deletion while public chat remains.

## Target Architecture

### Profile navigation

- `PROFILE_TAB_KINDS` and display order exclude `clone-settings` and `settings`.
- `ProfileTabs` no longer needs owner-aware filtering or test IDs for removed tabs.
- The base profile route always resolves to Posts through one canonical route-default constant; no profile response carries a preference.
- `ProfileSection`, content route-state tests, navbar fallback, back navigation, home, and onboarding use the fixed route default instead of `profile.defaultProfileSection`.
- Removed URLs are true 404s. Do not add redirects, aliases, compatibility routes, or tombstone components.

### Non-configurable public chat

- Chat has one mode and therefore needs no mode URL parameter, mode parser, configuration controller branch, configuration copy, or mode-specific tool handling.
- The public system prompt accepts author/content inputs only. It does not accept stored persona, tone, avoided-topic, or access-gate inputs.
- Clone tools that still serve public content discovery/navigation or existing owner post/article actions remain. Configuration-only read/write tools and their shared adapters are deleted.
- Existing configuration conversations are rejected/hidden during the migration window and then securely deleted along with their agent component threads.

### Fixed author data contract

- Public/current profile return validators contain author identity/profile data only; they do not expose customization fields.
- New users are no longer seeded with a default-section value.
- The default profile destination is a routing rule (`posts`), not user data.
- After cleanup, the user and conversation schemas no longer accept the deleted fields.

## Deployment Strategy

Convex validates deployed schemas against data at rest. Removing fields from `users` or `conversations` before clearing existing documents will fail deployment, so this ships as two releases with a required data-cleanup gate between them.

### Release A — remove behavior, keep a migration envelope

Release A removes all UI, routes, public APIs, alternate configuration behavior, positive feature tests, and dedicated docs. The five user fields and conversation `mode` remain optional in the schema only long enough to accept existing data.

During this window:

- No new code writes any of the five user fields.
- New public-chat conversations omit `mode` and are interpreted as the only supported chat behavior.
- Legacy configuration conversations are excluded from lists, direct reads, sends, retries, and streaming.
- A temporary `conversations.by_mode` index supports bounded, resumable cleanup without scanning the table on each step.
- Migration-only comments must explicitly identify the Release B removal gate; there must be no general-purpose compatibility abstraction.

Use `@convex-dev/migrations` for the users-table field cleanup. Install the component in `convex.config.ts`, create a generic migrations runner, and define a resumable migration that patches all five fields to `undefined`. Keep the generic component available for the remaining progressive pivot migrations, but delete this feature-specific migration definition after it completes.

Configuration conversations need component-thread cleanup as well as local row cleanup. Add a temporary internal cleanup action that:

1. Reads one `mode === "configuration"` conversation through the temporary index.
2. Calls `cloneAgent.deleteThreadSync` for that row’s `threadId` so messages and streams are gone before the local reference disappears.
3. Deletes the local conversation row only after component cleanup succeeds.
4. Schedules or is rerun for the next row; failure leaves the row intact and retryable.

Use a second resumable migration to unset `mode` on surviving clone conversations after all configuration rows are gone. Dry-run migrations first, run them only with explicit release authorization, monitor completion, and verify no indexed `clone` or `configuration` rows remain before Release B.

### Release B — narrow the schema and delete migration residue

After migration status and configuration-thread cleanup are proven complete:

- Delete the five fields from `users/schema.ts`.
- Delete `mode` and the temporary `by_mode` index from `chat/schema.ts`.
- Delete `users/defaultProfileSection.ts`, `chat/tonePresets.ts`, the transitional mode classifier, feature-specific migrations, cleanup action, verification helpers, and their generated API entries.
- Regenerate Convex types and deploy the narrowed schema.

Release B must not be prepared as a deployable schema change until Release A has run against every target deployment. Production migration/deploy execution is an explicit release operation, not an automatic consequence of implementing this plan.

## Implementation Steps

### Execution checklist

- [x] Release A: remove visible Clone and Settings routes/features
- [x] Release A: make Posts the fixed profile route default
- [x] Release A: remove persona settings and configuration chat behavior
- [x] Release A: add legacy-data quarantine and resumable cleanup migrations
- [x] Release A: prune dedicated repository artifacts and regenerate metadata
- [x] Release A: pass Tier 5 verification
- [ ] Release gate: run and verify cleanup on every target deployment (explicit authorization required)
- [ ] Release B: narrow schemas and delete feature-specific migration residue
- [ ] Release B: pass final absence audit and Tier 5 verification

### 1. Delete the two routes and visible feature modules

Delete:

- `apps/mirror/app/[username]/clone-settings/`
- `apps/mirror/app/[username]/@content/clone-settings/`
- `apps/mirror/app/[username]/settings/`
- `apps/mirror/app/[username]/@content/settings/`
- `apps/mirror/features/clone-settings/`
- `apps/mirror/features/settings/`
- `apps/mirror/e2e/clone-settings/`
- `apps/mirror/e2e/settings-default-content-type.authenticated.spec.ts`

Remove both rewrites from `apps/mirror/next.config.ts`, remove the obsolete clone-settings Vitest exclusions/alias residue, and delete settings translation keys from `apps/mirror/lib/i18n.ts`.

Update `profile-tabs/types.ts`, `profile-tabs.tsx`, and their tests to remove both kinds, labels, hrefs, owner filtering, and test IDs. Drop the now-unused `isOwner` prop from `ProfileTabs` and its navbar caller.

Update `features/content/types.ts`, its tests, and `packages/convex/convex/content/href.ts` to remove the two section literals and obsolete comments while retaining content/profile href helpers used by surviving tabs and chat navigation.

### 2. Replace the stored default with one route invariant

Delete the settings mutation, selector enum, validator, profile response fields, profile type field, and optimistic form logic rather than moving the preference elsewhere.

Update:

- `packages/convex/convex/users/{mutations,queries,helpers,schema}.ts`
- `packages/convex/convex/auth/client.ts`
- `apps/mirror/features/profile/{types.ts,hooks/use-profile-data.ts}`
- `apps/mirror/app/[username]/{layout.tsx,@content/page.tsx}`
- `apps/mirror/app/[username]/_hooks/use-profile-workspace-route-data.ts`
- `apps/mirror/components/workspace-navbar.tsx`
- `apps/mirror/app/{page.tsx,onboarding/page.tsx}`

All base-route, navbar, mobile-back, home, and onboarding behavior must resolve to Posts via a single fixed routing constant. Remove `DEFAULT_PROFILE_SECTION_VALUES` and the `DefaultProfileSection` preference type; keep or rename only the literal routing default that surviving navigation genuinely needs.

Delete/update the focused users tests so they assert the field and `updateProfileSettings` API are absent, then let regenerated Convex types catch any remaining client references.

### 3. Remove clone persona customization

Delete:

- `updatePersonaSettings`
- `PersonaSettingsArgs` and `buildPersonaPatch`
- `tonePresets.ts`, its test, package export, and type-version entry
- persona fields from current-profile validators/queries and users schema after migration
- `updatePersonaSettings.test.ts` and persona-specific cases in profile/chat prompt tests

Simplify `composeSystemPrompt` so its public input no longer includes `personaPrompt`, `tonePreset`, or `topicsToAvoid`. Preserve fixed safety/style/tool vocabulary and author-derived name, tagline, content inventory, and published-content retrieval. Rewrite surviving prompt tests around this uniform contract.

Remove `chatAuthRequired` from public profile data and the send mutation’s access gate. Keep existing rate limiting and authorization boundaries; removing author customization must not weaken abuse controls or ownership checks.

### 4. Remove the alternate configuration chat from the client

Delete `ConfigureProfileButton`, its export, and both desktop/mobile call sites. Remove `openConfigurationChat` callbacks and any layout spacing/branches that existed only for that button.

Collapse chat to one mode across:

- `hooks/use-chat-search-params.ts` and its tests
- `features/chat/types.ts` and `lib/chat-mode.ts`
- chat context/hooks/components
- `app/[username]/_providers/chat-route-controller.tsx` and tests
- `app/[username]/_components/chat-panel.tsx`
- `features/chat/hooks/use-agent-intent-watcher.ts` and tests
- chat i18n strings

`openChat()` no longer accepts a mode, `chatMode` is never serialized, and `closeChat` removes a stale `chatMode` parameter if one arrives on an old link. Remove configuration greetings, disclaimer/placeholder copy, loading exceptions, auto-select exceptions, and configuration tool-result handlers.

Delete both profile-configuration Playwright specs. Retain and update ordinary chat tests to prove the surviving single-mode chat still opens, sends, lists conversations, preserves `chat=1` during content navigation, and rate-limits correctly.

### 5. Remove configuration-agent backend code and exclusive support

Delete:

- `chat/configurationPrompt.ts`
- `chat/configurationTools.ts`
- `chat/__tests__/fetchProfileSource.test.ts`
- configuration-only sections of `chat/__tests__/{rateLimits,tools}.test.ts`
- configuration branches in `chat/{actions,mutations,queries,helpers}.ts`
- configuration-only result types/branches in the client intent watcher
- `content/agentBody.ts`, its tests, and its package export
- `contacts/detectContactKind.ts` and its test (retain the shared hostname allowlist used by contact validation)
- configuration-only query/mutation primitives and validators from `chat/toolQueries.ts` and `chat/toolMutations.ts`: profile configuration/library/edit reads and Bio/Contact/Project/full-content patch writers
- `undici` from `packages/convex/package.json` once no imports remain

Retain shared write helpers used by normal UI mutations, public clone navigation/RAG queries, and clone tools that still have live callers. Update comments in surviving Article/Post/Contact/Content helpers so they describe their real UI/backend ownership rather than a deleted configuration agent.

During Release A only, keep the smallest legacy-mode classifier and rejection/filtering needed to quarantine stored configuration rows until cleanup. Release B deletes that transitional code and the `./convex/chat/mode` package export.

### 6. Migrate stored settings and configuration conversations

Add the generic Convex migrations component/runner and focused Release A migration definitions.

User migration patch:

```ts
{
  personaPrompt: undefined,
  tonePreset: undefined,
  topicsToAvoid: undefined,
  chatAuthRequired: undefined,
  defaultProfileSection: undefined,
}
```

Conversation cleanup must distinguish data handling:

- `mode === "configuration"`: synchronously delete the agent thread/messages/streams, then delete the local conversation.
- `mode === "clone"`: unset `mode` after configuration cleanup completes.
- missing `mode`: leave the surviving public-chat row unchanged.

Add unit/integration coverage for idempotency, failed thread deletion retaining the local row, clone-row preservation, and user-field clearing. Run the user migration in dry-run mode first. Record exact status/output in the release checklist without copying secrets or production document values into the repository.

After all target deployments are clean, perform Release B schema narrowing and delete every feature-specific migration/cleanup function. Keep only generic migration infrastructure if it has no old feature terminology and will be used by the announced progressive removals.

### 7. Remove dedicated docs, agents, skills, comments, and harnesses

Delete documents whose entire subject is the removed system, including:

- `workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md`
- `workspace/plans/2026-05-14-config-agent-content-authoring-plan.md`
- completed tickets dedicated solely to Clone Settings or configuration-mode behavior, including FG_070, FG_079, FG_120, FG_123, FG_262, and FG_264

Review mixed plans/tickets/research and remove stale requirements, test references, and comments while preserving still-correct history about surviving profile tabs, content navigation, and public chat. At minimum this includes PLAN_005, the content-panel navigation plan, `workspace/lessons.md`, `workspace/research/convex-nextjs-client-feature-org.md`, and comments in unrelated E2E specs that cite Clone Settings fixtures.

Update both maintained rule/doc copies where present:

- `apps/mirror/AGENTS.md`
- `.claude/rules/{agent-parity.md,apps/mirror/routing.md}`
- `.agents/rules/{agent-parity.md,apps/mirror/routing.md}`
- `.claude/agents/chat-backend-developer.md`
- `.agents/agents/chat-backend-developer.md`
- `.codex/agents/chat-backend-developer.toml`
- both chat-backend agent memory directories

Narrow the chat-backend agent to the surviving public-chat contract. Remove persona, tone, configuration-mode, and settings knowledge from live instructions/memory; do not delete the entire agent while public chat remains.

No live top-level skill currently targets these settings surfaces. Delete any direct skill copies discovered during the final scan rather than retaining a dead skill. Do not remove the live Tavus skills because video calling is explicitly outside this session.

Delete `.agents/worktrees/eager-wiles/` in full. It is already ignored, has no external references, and is a tracked embedded checkout rather than a source-of-truth workspace. Do not selectively maintain its duplicated Mirror, docs, skills, packages, lockfile, or binaries.

### 8. Regenerate and prune repository metadata

After Release A and again after Release B:

- Run `pnpm install` so dependency and lockfile changes reflect removal of `undici` and addition of the generic migrations component.
- Run Convex codegen verification so deleted modules/functions disappear from `_generated/api.d.ts` and the data model matches the active migration phase.
- Remove empty directories and stale test-runner exclusions.
- Check `git diff origin/main...` for generated or schema changes unrelated to the planned deletion; do not accept incidental drift.

## Artifact Disposition

| Area             | Delete                                                                            | Simplify/retain                                                 |
| ---------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Routes           | Clone/Settings canonical and parallel-route pages; rewrites                       | Existing Posts and other progressive-pivot routes               |
| Client features  | `features/clone-settings`, `features/settings`, configuration button/mode/copy    | Single-mode public chat; author name/tagline/profile editing    |
| Convex users     | settings/persona mutations, validators, response fields, stored values            | Identity, username, name, tagline, avatar, onboarding           |
| Convex chat      | configuration prompt/tools, config-only primitives/adapters, config conversations | Public chat, RAG, rate limits, surviving navigation/write tools |
| Tests            | Positive Clone/Settings/configuration specs and unit suites                       | Updated public chat/profile tests plus a negative removal E2E   |
| Docs/agents      | Dedicated plans/tickets and obsolete live instructions/memory                     | Current public-chat and routing guidance                        |
| Skills/harnesses | Direct obsolete skill copies; tracked `eager-wiles` snapshot                      | Unrelated live skills; generic migration runner                 |

## Hard Verification

Add `apps/mirror/e2e/removed-settings-surfaces.authenticated.spec.ts` using the existing authenticated fixture and a known seeded profile.

Assertions:

1. An owner visiting `/@test-user/posts` sees neither a `Clone` tab nor a `Settings` tab and has no `Configure profile` button.
2. An unauthenticated visitor sees the same reduced tab set.
3. Direct navigation to `/@test-user/clone-settings` and `/@test-user/settings` returns HTTP 404 for both owner and visitor; no blank parallel-route panel or redirect shim is accepted.
4. `/@test-user` resolves to `/@test-user/posts` regardless of the removed legacy preference.
5. Opening ordinary chat creates no `chatMode` query parameter, renders the normal public-chat greeting/input, and can send one message successfully.
6. Navigating between surviving content tabs with `?chat=1` preserves the open public chat.

Run the targeted Playwright test through the CLI:

```bash
pnpm --filter=@feel-good/mirror test:e2e removed-settings-surfaces.authenticated.spec.ts
```

Run focused unit suites after pruning old cases:

```bash
pnpm --filter=@feel-good/mirror test:unit
pnpm --filter=@feel-good/convex test
pnpm --filter=@feel-good/convex check-types
```

Run mandatory Convex and Mirror verification from the repository root after each release-stage diff:

```bash
pnpm --filter=@feel-good/convex run verify:codegen
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

For Tier 5 visual/interaction confirmation, use the browser at desktop and mobile widths to confirm the shorter profile tab row has no empty gap, the owner edit control remains aligned after removing Configure Profile, old URLs display the standard 404, and normal public chat still opens and sends.

Before Release B, run and capture pass/fail status for:

- users migration dry run
- users migration completion status
- configuration-conversation cleanup runner reporting no remaining indexed rows
- clone-mode cleanup reporting no remaining indexed `mode` rows

Finally run a tracked-file absence audit. The only expected occurrences of removed terminology are this removal plan and the negative E2E regression test; Release A migration files are a temporary additional allowlist and must disappear in Release B.

```bash
git grep -n -i -E 'clone[-_ ]settings|defaultProfileSection|updateProfileSettings|updatePersonaSettings|personaPrompt|tonePreset|topicsToAvoid|chatAuthRequired|configurationPrompt|configurationTools|chatMode=configuration' -- .
git ls-files .agents/worktrees/eager-wiles
```

The second command must print nothing. Review every first-command hit rather than relying only on a count.

## Constraints And Non-Goals

- Do not rename or remove Articles, Bio, Contact, or Projects in this change. Their later reconciliation with Author/Posts/Products needs its own migration plan.
- Do not introduce Products in this change.
- Do not remove ordinary public chat, the interaction panel, conversations generally, video calls, Tavus/Daily, or their live skills/dependencies.
- Do not replace settings with another owner preference store, environment flag, hidden route, dialog, chat tool, or dashboard control.
- Do not redirect deleted URLs. A compatibility shim would keep the removed concepts alive and obscure dead links.
- Do not drop schema fields until every target deployment’s cleanup is verified. Conversely, do not declare the removal complete while migration-only schema fields or feature-specific migration code remain.
- Do not delete configuration conversation rows before their agent component threads have been deleted successfully.
- Do not rewrite unrelated historical records merely because they contain the generic word “settings”; remove documents dedicated to the deleted product surfaces and surgically correct mixed live guidance.
- Do not touch untracked user worktrees. The only worktree harness in scope is the already tracked, ignored `.agents/worktrees/eager-wiles/` snapshot identified above.
