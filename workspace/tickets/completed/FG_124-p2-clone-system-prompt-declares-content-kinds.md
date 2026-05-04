---
id: FG_124
title: "Clone system prompt declares structured content kinds the user has authored"
date: 2026-05-04
type: improvement
status: completed
priority: p2
description: "composeSystemPrompt currently lists only the short bio string, persona prompt, tone clause, and topics-to-avoid. It does not enumerate that the user has structured content (bio entries — work history, education; published articles; published posts) the clone can speak from. Bio chunks are correctly ingested into contentEmbeddings and surface via vectorSearch, but the agent has no proactive vocabulary for the noun, so it only mentions bio details when the visitor's message lexically triggers retrieval. Extend composeSystemPrompt with a content-inventory section that names the kinds present, generalizing for future structured sources."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "composeSystemPrompt in packages/convex/convex/chat/helpers.ts accepts a contentInventory arg describing which source kinds the profile owner has populated (verifiable: grep -n 'contentInventory' packages/convex/convex/chat/helpers.ts returns at least one match in the function signature)"
  - "loadStreamingContext queries presence of each embeddingSourceTableValidator literal (articles, posts, bioEntries) for the profile owner and passes the result to composeSystemPrompt (verifiable: grep -n 'bioEntries\\|articles\\|posts' packages/convex/convex/chat/helpers.ts shows the query inside loadStreamingContext)"
  - "When the profile owner has at least one bioEntries row, composeSystemPrompt output contains the phrase 'bio entries' (or a synonym matched by the unit test) — when none exist, it does not"
  - "packages/convex/convex/chat/__tests__/helpers.test.ts adds at least two new test cases: one asserting the bio-entries phrase appears when contentInventory.bioEntries is true, one asserting it is absent when false"
  - "The new content-inventory section is placed within the truncatable region of composeSystemPrompt so SYSTEM_PROMPT_MAX_CHARS is still enforced (verifiable: existing 'truncates to budget' test in helpers.test.ts still passes with a contentInventory passed in)"
  - "pnpm --filter=@feel-good/convex test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "chat-backend-developer"
---

# Clone system prompt declares structured content kinds the user has authored

## Context

Discovered during agent-parity architecture review (2026-05-04). The repo has a clean RAG-ingestion pipeline — every user-writable content type (articles, posts, bioEntries) flows into `contentEmbeddings` and is retrievable via `vectorSearch` filtered by `userId`. But the system-prompt composition side of parity is incomplete.

`packages/convex/convex/chat/helpers.ts:86-131` (`composeSystemPrompt`) currently injects:

- `SAFETY_PREFIX(name)` — fixed
- `STYLE_RULES` — fixed
- Tone clause if `tonePreset` set — fixed
- `Bio: ${opts.bio}` if the short bio string field is populated — truncatable
- `personaPrompt` or `DEFAULT_PERSONA` — truncatable
- `Avoid discussing: ${topicsToAvoid}` — truncatable

Nothing tells the agent "this user has structured bio entries (work history, education) you can speak from." `bioEntries` rows are embedded and reachable via `chat/actions.ts:streamResponse` `vectorSearch` (line 110-118), but the agent has no proactive vocabulary for the noun. Result: the clone will mention work/education only when the visitor's message lexically triggers retrieval — it will not volunteer "I worked at X" when asked an open-ended "tell me about yourself" question, even though the chunks would land in retrieval if the question were phrased on-topic.

`.claude/agents/code-review/agent-native.md` § 6 (Noun Test) names this exact gap: a noun the diff added (bioEntries, in the bio-dialog wave) reaches RAG but the system prompt was not updated to mention it. Severity is `p2` per the reviewer's rubric — bio is not the primary content noun, but is a structured kind the agent should know about. Same gap will recur for any future structured source (events, projects, etc.).

## Goal

After this ticket, the clone's system prompt names the structured content kinds the profile owner has populated, so the agent has proactive vocabulary for those nouns and will surface them in open-ended questions, not only when the visitor's message lexically matches retrieval. The mechanism generalizes to future content kinds added to `embeddingSourceTableValidator`.

## Scope

- Add a `contentInventory` arg to `composeSystemPrompt` describing which `embeddingSourceTableValidator` literals are populated for the profile owner (booleans or counts — booleans suffice).
- Extend `loadStreamingContext` to compute that inventory by querying `bioEntries`, `articles` (published), and `posts` (published) for the profile owner.
- Insert a sentence in the truncatable region of the prompt that names the populated kinds. Phrasing should be Mirror-voice (e.g., "You can speak from this person's bio entries (work history, education) and published posts when relevant.")
- Add unit test cases to `packages/convex/convex/chat/__tests__/helpers.test.ts` covering the bio-entries-present and bio-entries-absent cases, and confirming the truncation budget still holds.

## Out of Scope

- Changing how `vectorSearch` retrieves chunks — the `userId` filter and threshold logic stay as-is (`chat/actions.ts:110-123`).
- Adding agent tools or write-back — the clone remains read-only for this release per the agent-native reviewer's "primitives over workflows" stance.
- Generalizing the inventory to a fully data-driven structure that auto-updates when a new literal is added to `embeddingSourceTableValidator`. A typed `contentInventory: { articles: boolean; posts: boolean; bioEntries: boolean }` shape that fails type-check when the validator gains a literal is sufficient — full reflection is over-engineering.
- Adding the inventory section to `truncatableParts` ahead of bio/persona/topics in priority — order stays: bio → persona → topics → inventory (insert at the end so existing prompts are not destabilized).

## Approach

1. Define `contentInventory` as a typed object keyed by each `embeddingSourceTableValidator` literal, with boolean values.
2. In `loadStreamingContext`, after reading the `profileOwner` doc, run three small `withIndex("by_userId", ...)` queries — `take(1)` for each table — to detect presence cheaply. (Articles and posts must filter to `status === "published"`; bio entries have no status.)
3. Pass the resulting inventory to `composeSystemPrompt`.
4. In `composeSystemPrompt`, build a single sentence enumerating the populated kinds in human-readable form, and push it into the `truncatable` array. If no kinds are populated, push nothing — keeps backward compat for users with no content.
5. Update test cases in `helpers.test.ts` to cover the new arg.

- **Effort:** Small
- **Risk:** Low — additive; existing prompts unchanged when `contentInventory` is omitted or all-false; truncation logic untouched.

## Implementation Steps

1. In `packages/convex/convex/chat/helpers.ts`, add a `ContentInventory` type aliased over `embeddingSourceTableValidator` literals (manual mirror is acceptable; a comment pointing to `embeddings/schema.ts` keeps the contract visible).
2. Extend `composeSystemPrompt` opts with `contentInventory?: ContentInventory`. Build a sentence like `"You can speak from this person's bio entries (work history, education), published posts, and published articles when relevant."` listing only the kinds whose flag is true. Push the sentence into `truncatable` after `topicsToAvoid`.
3. Extend `loadStreamingContext` to compute `contentInventory` via three `ctx.db.query(...).withIndex("by_userId", q => q.eq("userId", profileOwnerId)).take(1)` calls (filter `status === "published"` for articles/posts via `.filter(...)` or by re-using existing helper queries if cheaper).
4. Pass `contentInventory` to `composeSystemPrompt` in `loadStreamingContext`.
5. Add unit tests to `packages/convex/convex/chat/__tests__/helpers.test.ts`: bio-only inventory, full inventory, empty inventory, truncation-budget test with full inventory.
6. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/mirror build`.

## Constraints

- The new section must live in the truncatable region — never the fixed region — so `SYSTEM_PROMPT_MAX_CHARS` (6000) cannot be blown by a user with all kinds populated.
- The phrasing must respect `STYLE_RULES` ("plain conversational prose, no markdown") since the agent will copy the register from the prompt.
- Do not duplicate the bio short-string field's content — the inventory sentence is about *structured* kinds, not the free-form bio text.
- Contract with `embeddingSourceTableValidator`: when a new literal is added there in the future, TypeScript should force a corresponding update here. Use the same literal union (or a derived `keyof` type) so the compiler enforces parity.

## Resources

- `packages/convex/convex/chat/helpers.ts:86-131` — `composeSystemPrompt`
- `packages/convex/convex/chat/helpers.ts:133-167` — `loadStreamingContext`
- `packages/convex/convex/embeddings/schema.ts:21-25` — `embeddingSourceTableValidator` (source of truth for kinds)
- `packages/convex/convex/chat/actions.ts:76-146` — `streamResponse` and the `vectorSearch` filter the inventory should align with
- `.claude/agents/code-review/agent-native.md` § 6 — Noun Test severity rubric
- `.claude/rules/embeddings.md` — ingestion-side parity contract this ticket extends to the prompt side
