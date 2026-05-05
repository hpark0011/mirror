# Graph Report - packages/convex  (2026-05-05)

## Corpus Check
- 113 files · ~69,691 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 594 nodes · 791 edges · 87 communities (58 shown, 29 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.86)
- Token cost: 71,568 input · 17,892 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat Streaming + Better Auth (fused)|Chat Streaming + Better Auth (fused)]]
- [[_COMMUNITY_Cross-Module Helpers & Validators|Cross-Module Helpers & Validators]]
- [[_COMMUNITY_Inline Image Policy & Constants|Inline Image Policy & Constants]]
- [[_COMMUNITY_Body Walk & Ownership Registry|Body Walk & Ownership Registry]]
- [[_COMMUNITY_Beta Allowlist Machinery|Beta Allowlist Machinery]]
- [[_COMMUNITY_Bio Entries CRUD|Bio Entries CRUD]]
- [[_COMMUNITY_Better Auth Triggers & Plugins|Better Auth Triggers & Plugins]]
- [[_COMMUNITY_Clone Tool Definitions & Tests|Clone Tool Definitions & Tests]]
- [[_COMMUNITY_Articles CRUD|Articles CRUD]]
- [[_COMMUNITY_SafeFetch SSRF Defenses|SafeFetch SSRF Defenses]]
- [[_COMMUNITY_Slug Backfill & Href Builder|Slug Backfill & Href Builder]]
- [[_COMMUNITY_Inline Image E2E Tests|Inline Image E2E Tests]]
- [[_COMMUNITY_Article Markdown Import|Article Markdown Import]]
- [[_COMMUNITY_Playwright Test-Mode Gates|Playwright Test-Mode Gates]]
- [[_COMMUNITY_Query Test Suites|Query Test Suites]]
- [[_COMMUNITY_RAG Embedding Pipeline|RAG Embedding Pipeline]]
- [[_COMMUNITY_Rick Rubin Seed Mutations|Rick Rubin Seed Mutations]]
- [[_COMMUNITY_System Prompt Composition|System Prompt Composition]]
- [[_COMMUNITY_Mutation Test Suites|Mutation Test Suites]]
- [[_COMMUNITY_Rick Rubin Seed Helpers|Rick Rubin Seed Helpers]]
- [[_COMMUNITY_Orphan Sweep Tests|Orphan Sweep Tests]]
- [[_COMMUNITY_System Prompt Helper Tests|System Prompt Helper Tests]]
- [[_COMMUNITY_Bio Embedding Serializer|Bio Embedding Serializer]]
- [[_COMMUNITY_Convex App Registry|Convex App Registry]]
- [[_COMMUNITY_Referenced Storage Set|Referenced Storage Set]]
- [[_COMMUNITY_Markdown Import Core|Markdown Import Core]]
- [[_COMMUNITY_Tool Query Href Resolver|Tool Query Href Resolver]]
- [[_COMMUNITY_Email Send Actions (templates)|Email Send Actions (templates)]]
- [[_COMMUNITY_Inline Image URL Helpers|Inline Image URL Helpers]]
- [[_COMMUNITY_Env Validation|Env Validation]]
- [[_COMMUNITY_Email Send Actions (transport)|Email Send Actions (transport)]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `streamResponse` - 16 edges
2. `users table` - 15 edges
3. `resolveBySlug` - 12 edges
4. `generateEmbedding (internalAction, node runtime)` - 12 edges
5. `conversations table` - 12 edges
6. `extractInlineImageStorageIds()` - 11 edges
7. `sendMessage` - 11 edges
8. `convex schema root` - 11 edges
9. `composeSystemPrompt` - 10 edges
10. `loadStreamingContext` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ensureRickRubinPosts()` --calls--> `getPostCategoryForSlug()`  [INFERRED]
  convex/seed.ts → convex/posts/categories.ts
- `importMarkdownInlineImagesCore()` --calls--> `collectExternalImageSrcs()`  [INFERRED]
  convex/content/markdownImport.ts → convex/content/bodyWalk.ts
- `TONE_PRESETS` --shares_data_with--> `composeSystemPrompt`  [INFERRED]
  convex/chat/tonePresets.ts → convex/chat/helpers.ts
- `composeSystemPrompt` --references--> `tonePresetValidator`  [INFERRED]
  convex/chat/helpers.ts → convex/chat/tonePresets.ts
- `clearStreamingLock` --references--> `clearStreamingLock runs in finally; lock CAS on streamingStartedAt prevents stomping a re-issued stream`  [INFERRED]
  convex/chat/mutations.ts → convex/chat/actions.ts

## Hyperedges (group relationships)
- **RAG retrieval pipeline (embed → vectorSearch → fetchChunks → buildRagContext)** — actions_streamresponse, schema_table_contentembeddings, embeddings_schema_by_embedding_index, embeddings_queries_fetchchunksbyids, actions_buildragcontext [EXTRACTED 1.00]
- **Cross-user isolation invariant — server-derived profileOwnerId pinned at every read boundary** — actions_streamresponse, tools_buildclonetools, toolqueries_querylatestpublished, toolqueries_resolvebyslug, embeddings_schema_by_embedding_index, rationale_userid_filter_isolation, rationale_factory_closes_over_profileownerid [INFERRED 0.95]
- **Streaming-lock lifecycle (sendMessage/retryMessage acquire → streamResponse uses → clearStreamingLock CAS-releases in finally)** — mutations_sendmessage, mutations_retrymessage, actions_streamresponse, mutations_clearstreaminglock, schema_table_conversations [EXTRACTED 1.00]

## Communities (87 total, 29 thin omitted)

### Community 0 - "Chat Streaming + Better Auth (fused)"
Cohesion: 0.05
Nodes (73): buildRagContext, streamResponse, cloneAgent, getLanguageModel, Anonymous daily token bucket keyed by profileOwnerId, authComponent (Better Auth client), clearStaleStreamingLocks internalMutation, rationale: referenced-set computed once on first page, threaded through scheduler.runAfter for consistency (+65 more)

### Community 1 - "Cross-Module Helpers & Validators"
Cohesion: 0.07
Nodes (30): resolveArticleCoverImageUrl(), backfillSlugs(), findFreeSlug(), collectExternalImageSrcs(), collectExternalImageSrcsRec(), collectInlineImageStorageIds(), extractInlineImageStorageIds(), isAbsoluteHttpsUrl() (+22 more)

### Community 2 - "Inline Image Policy & Constants"
Cohesion: 0.08
Nodes (29): ALLOWED_INLINE_IMAGE_TYPES (png/jpeg/webp), MAX_FETCH_REDIRECTS (3), MAX_INLINE_IMAGE_BYTES (5 MiB), FG_117 rename safe-fetch.ts -> safeFetch.ts: Convex 1.32.0 deploy server rejects hyphenated module paths, safeFetch is NOT DNS-rebinding resistant; accepted personal-blog risk (NFR-01), Submit is idempotent — duplicate email returns {alreadyOnList:true} without inserting, NFR-02: rate-limit error shape is identical for listed vs unlisted emails to avoid leaking enrollment, Per-email check runs before global; rejection does NOT consume a token, so per-email reject leaves global untouched (+21 more)

### Community 3 - "Body Walk & Ownership Registry"
Cohesion: 0.08
Nodes (28): collectExternalImageSrcs (https-only, idempotent skip-imported), extractInlineImageStorageIds (multiset, document order), isAbsoluteHttpsUrl predicate, JSONContent shape (Tiptap-mirror), mapInlineImages (immutable rewrite), multisetDifference (a-b counting duplicates), buildReferencedStorageSet (cron full scan), claimInlineImageOwnership (first-commit-wins) (+20 more)

### Community 4 - "Beta Allowlist Machinery"
Cohesion: 0.08
Nodes (26): addAllowlistEntry internalMutation idempotent, rationale: never trust caller-supplied case; normalize at mutation boundary, isEmailAllowed internalQuery (lowercases email), removeAllowlistEntry internalMutation, betaAllowlistTable defineTable email/note/addedAt, allowlist.test.ts (idempotency, normalization), send-otp.test.ts (BETA_CLOSED gate), trigger.test.ts (user.onCreate gate) (+18 more)

### Community 5 - "Bio Entries CRUD"
Cohesion: 0.11
Nodes (26): bio.mutations.create (authMutation), args validator MUST NOT accept userId (FR-11), bio.mutations.remove (authMutation), MAX_BIO_ENTRIES_PER_USER 50 (NFR-05 soft-cap), bio mutations test suite (auth, soft-cap, embedding round-trip), bio.mutations.update (authMutation), serializeBioEntryForEmbedding (subject-neutral prose), subject-neutral voice for either system-prompt voicing (+18 more)

### Community 6 - "Better Auth Triggers & Plugins"
Cohesion: 0.08
Nodes (26): authComponent (Better Auth client), createAuth (betterAuth factory), emailOTP plugin (sendVerificationOTP callback), magicLink plugin, runSendVerificationOtpGate (Tier 2 beta gate), two-tier beta gate (component trigger + send-otp UX), user.onCreate trigger (Tier 1 allowlist + users insert), user.onDelete trigger (avatar + users row cleanup) (+18 more)

### Community 7 - "Clone Tool Definitions & Tests"
Cohesion: 0.1
Nodes (6): buildCloneTools(), insertConversation(), insertOwner(), makeT(), seedStreamResponseContext(), normalizeConvexGlob()

### Community 8 - "Articles CRUD"
Cohesion: 0.14
Nodes (22): resolveArticleCoverImageUrl, articleSummaryReturnValidator, articles.create, articles.update, articles.getBySlug, articles.getByUsername, articlesTable, clearCoverImage explicit-removal sentinel (+14 more)

### Community 9 - "SafeFetch SSRF Defenses"
Cohesion: 0.18
Nodes (12): assertHostnameNotBlocked(), assertHttps(), isBlockedAddress(), isBlockedIPv4(), isBlockedIPv6(), isRedirect(), isValidImageMagicBytes(), readWithLimit() (+4 more)

### Community 11 - "Slug Backfill & Href Builder"
Cohesion: 0.15
Nodes (17): backfillArticleSlugs (internalMutation), findFreeSlug (collision suffix -2/-3, cap 100), backfillPostSlugs (internalMutation, one-shot cleanup), backfillSlugs shared helper, buildContentHref (canonical /@user/<kind>/<slug>), validateContentStringLength, Backfill original slugs only live in mutation return; capture stdout to a log file is mandatory, Href builder must stay aligned with apps/mirror dynamic route — single source of truth (+9 more)

### Community 12 - "Inline Image E2E Tests"
Cohesion: 0.24
Nodes (8): blobExists(), bodyWithImages(), imageNode(), insertAppUserAndSignIn(), makeT(), normalizeConvexGlob(), SafeFetchError, storeBlob()

### Community 13 - "Article Markdown Import"
Cohesion: 0.29
Nodes (13): articles.actions.importMarkdownInlineImages (internalAction), _getArticleOwnership, importArticleMarkdownInlineImages (public action), _patchInlineImageBody (articles), _readArticleBody, defense-in-depth ownerId re-check (FG_104), merge-style body patch over wholesale replace (FG_096), V8/Node split for inline-image action helpers (+5 more)

### Community 14 - "Playwright Test-Mode Gates"
Cohesion: 0.26
Nodes (6): createAuth(), getPlaywrightTestSecret(), isPlaywrightTestEmail(), isPlaywrightTestMode(), authorizeTestRequest(), secretsMatch()

### Community 15 - "Query Test Suites"
Cohesion: 0.29
Nodes (4): makeT(), normalizeConvexGlob(), setupOwnerAndSignIn(), storeBlob()

### Community 16 - "RAG Embedding Pipeline"
Cohesion: 0.2
Nodes (5): buildRagContext(), chunkText(), EMBEDDING_MODEL gemini-embedding-001 / 768 dims, ingest and retrieval must share model and dims, extractPlainText()

### Community 17 - "Rick Rubin Seed Mutations"
Cohesion: 0.29
Nodes (10): ensureRickRubinArticles helper, ensureRickRubinConversations helper (uses createThread/saveMessage), ensureRickRubinPosts helper, ensureRickRubinUser helper, seedRickRubin internalMutation, seedRickRubinArticles internalMutation, seedRickRubinConversations internalMutation, seedRickRubinDemo internalMutation (full demo) (+2 more)

### Community 18 - "System Prompt Composition"
Cohesion: 0.24
Nodes (10): buildContentInventorySentence, composeSystemPrompt, SAFETY_PREFIX, STYLE_RULES, TOOLS_VOCABULARY, truncateToBudget, TOOLS_VOCABULARY is a fixed (non-truncatable) prompt section so the LLM always sees the verb names, System prompt 6000-char budget with proportional truncation (+2 more)

### Community 19 - "Mutation Test Suites"
Cohesion: 0.31
Nodes (3): insertAppUserAndSignIn(), makeT(), normalizeConvexGlob()

### Community 23 - "System Prompt Helper Tests"
Cohesion: 0.6
Nodes (4): buildContentInventorySentence(), composeSystemPrompt(), SAFETY_PREFIX(), truncateToBudget()

### Community 26 - "Convex App Registry"
Cohesion: 0.4
Nodes (5): auth.config.ts AuthConfig default export, defineApp registry: agent + better-auth + rate-limiter + resend, authComponent.registerRoutes mounting Better Auth at /api/auth/*, rationale: test routes only registered when isPlaywrightTestMode and re-checked per request for defense-in-depth, Convex httpRouter

### Community 36 - "Email Send Actions (templates)"
Cohesion: 1.0
Nodes (3): createEmailTemplate, sendMagicLink, sendVerificationEmail

### Community 37 - "Inline Image URL Helpers"
Cohesion: 1.0
Nodes (3): getArticleInlineImageUrl, inline-image URL trust boundary (no per-call ownership check), getPostInlineImageUrl

### Community 38 - "Env Validation"
Cohesion: 0.67
Nodes (3): rationale: fail-fast at startup with clear errors instead of cryptic runtime, envSchema (zod) for SITE_URL, GOOGLE_CLIENT_ID/SECRET, validateEnv() executed at module-load

### Community 39 - "Email Send Actions (transport)"
Cohesion: 0.67
Nodes (3): sendMagicLink, sendOTP, sendVerificationEmail

## Knowledge Gaps
- **134 isolated node(s):** `buildContentHref (re-export)`, `buildContentInventorySentence`, `getLastUserMessage`, `SAFETY_PREFIX`, `STYLE_RULES` (+129 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `resolveBySlug` connect `Chat Streaming + Better Auth (fused)` to `Tool Query Href Resolver`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `buildContentHref()` connect `Tool Query Href Resolver` to `Chat Streaming + Better Auth (fused)`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `users table` connect `Chat Streaming + Better Auth (fused)` to `Rick Rubin Seed Mutations`, `Beta Allowlist Machinery`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `streamResponse` (e.g. with `userId filter on by_embedding (sole cross-user isolation boundary)` and `clearStreamingLock runs in finally; lock CAS on streamingStartedAt prevents stomping a re-issued stream`) actually correct?**
  _`streamResponse` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `users table` (e.g. with `sweepOrphanedStorage internalMutation (paginated)` and `POST /test/ensure-user`) actually correct?**
  _`users table` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `resolveBySlug` (e.g. with `queryLatestPublished` and `Tool queries pin status==='published' so a draft URL never reaches the navigator`) actually correct?**
  _`resolveBySlug` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `buildContentHref (re-export)`, `buildContentInventorySentence`, `getLastUserMessage` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._