# Graph Report - refactor-post-files  (2026-05-06)

## Corpus Check
- 892 files · ~409,775 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1885 nodes · 1769 edges · 539 communities (494 shown, 45 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 129 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b437ec2e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Generated API Surface|Generated API Surface]]
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
- [[_COMMUNITY_Bio Embedding Source Tests|Bio Embedding Source Tests]]
- [[_COMMUNITY_System Prompt Helper Tests|System Prompt Helper Tests]]
- [[_COMMUNITY_Bio Embedding Serializer|Bio Embedding Serializer]]
- [[_COMMUNITY_Slug Backfill Tests|Slug Backfill Tests]]
- [[_COMMUNITY_Convex App Registry|Convex App Registry]]
- [[_COMMUNITY_Waitlist Tests|Waitlist Tests]]
- [[_COMMUNITY_OTP Send Tests|OTP Send Tests]]
- [[_COMMUNITY_Allowlist Tests|Allowlist Tests]]
- [[_COMMUNITY_Auth Trigger Tests|Auth Trigger Tests]]
- [[_COMMUNITY_Email Templates|Email Templates]]
- [[_COMMUNITY_Waitlist Mutations|Waitlist Mutations]]
- [[_COMMUNITY_Tool Query Href Resolver|Tool Query Href Resolver]]
- [[_COMMUNITY_Email Send Actions (templates)|Email Send Actions (templates)]]
- [[_COMMUNITY_Inline Image URL Helpers|Inline Image URL Helpers]]
- [[_COMMUNITY_Env Validation|Env Validation]]
- [[_COMMUNITY_Email Send Actions (transport)|Email Send Actions (transport)]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 124|Community 124]]
- [[_COMMUNITY_Community 125|Community 125]]
- [[_COMMUNITY_Community 126|Community 126]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]

## God Nodes (most connected - your core abstractions)
1. `useChatSearchParams()` - 19 edges
2. `PageSection()` - 18 edges
3. `PageSectionHeader()` - 18 edges
4. `Divider()` - 18 edges
5. `useProfileRouteData()` - 15 edges
6. `extractInlineImageStorageIds()` - 11 edges
7. `createInlineImageExtension()` - 10 edges
8. `getSafeRedirectUrl()` - 9 edges
9. `WorkspaceToolbar()` - 9 edges
10. `safeFetchImage()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `NavHeader()` --calls--> `useSidebar()`  [INFERRED]
  apps/ui-factory/components/nav-header.tsx → packages/ui/src/primitives/sidebar.tsx
- `Input()` --calls--> `InputVariants()`  [INFERRED]
  packages/ui/src/primitives/input.tsx → apps/ui-factory/app/components/input/_components/input-variants.tsx
- `WorkspaceShell()` --calls--> `useIsMobile()`  [INFERRED]
  apps/mirror/app/[username]/_components/workspace-shell.tsx → packages/ui/src/hooks/use-mobile.tsx
- `SignInPage()` --calls--> `getSafeRedirectUrl()`  [INFERRED]
  apps/mirror/app/(auth)/sign-in/page.tsx → packages/features/auth/utils/validate-redirect.ts
- `markdownToJsonContent()` --calls--> `createMarkdownExtensions()`  [INFERRED]
  apps/mirror/features/posts/lib/parsers/markdown-to-json-content.ts → packages/features/editor/lib/extensions.ts

## Communities (539 total, 45 thin omitted)

### Community 0 - "Chat Streaming + Better Auth (fused)"
Cohesion: 0.05
Nodes (17): useMediaQuery(), useIsMobile(), FormControl(), FormDescription(), FormMessage(), useFormField(), Input(), Label() (+9 more)

### Community 1 - "Cross-Module Helpers & Validators"
Cohesion: 0.05
Nodes (19): BioAddEntryButton(), BioEntryForm(), BioEntryFormDialog(), getDefaultValues(), CloneSettingsToolbar(), ContentPanel(), ToolbarSlotProvider(), ToolbarSlotTarget() (+11 more)

### Community 2 - "Inline Image Policy & Constants"
Cohesion: 0.07
Nodes (14): createArticleEditorExtensions(), createArticleExtensions(), createMarkdownExtensions(), createInlineImageExtension(), createInlineImageUploadExtension(), hasPendingUploads(), isSafeUrl(), isStorageIdShape() (+6 more)

### Community 3 - "Body Walk & Ownership Registry"
Cohesion: 0.06
Nodes (3): buildContentHref(), chunkText(), extractPlainText()

### Community 4 - "Beta Allowlist Machinery"
Cohesion: 0.07
Nodes (20): ChatConversationListSheet(), ChatActiveThread(), ChatThread(), ConversationList(), getContentRouteState(), isContentKind(), useChatContext(), isNavigateOutput() (+12 more)

### Community 5 - "Bio Entries CRUD"
Cohesion: 0.07
Nodes (14): ProfileMedia(), ArticleWorkspaceProvider(), PostWorkspaceProvider(), useIsProfileOwner(), PublishToggleConnector(), PublishToggle(), useArticleFilter(), useArticlePagination() (+6 more)

### Community 6 - "Better Auth Triggers & Plugins"
Cohesion: 0.08
Nodes (14): ContentEditor(), ContentEditorToolbar(), ContentToolbarShell(), ArticleEditor(), NewArticleEditor(), PostEditor(), useArticleCoverImageUpload(), useArticleInlineImageUpload() (+6 more)

### Community 7 - "Clone Tool Definitions & Tests"
Cohesion: 0.07
Nodes (3): ensureTestArticleFixtures(), waitForAuthReady(), requireEnv()

### Community 8 - "Articles CRUD"
Cohesion: 0.08
Nodes (14): getAuthErrorMessage(), SignUpView(), MagicLinkLoginForm(), MagicLinkSignUpForm(), OTPLoginForm(), OTPSignUpForm(), useMagicLinkRequest(), useOTPAuth() (+6 more)

### Community 9 - "SafeFetch SSRF Defenses"
Cohesion: 0.09
Nodes (7): buildRagContext(), buildCloneTools(), insertConversation(), insertOwner(), makeT(), seedStreamResponseContext(), normalizeConvexGlob()

### Community 10 - "Generated API Surface"
Cohesion: 0.14
Nodes (17): EmptyMessage(), useArticleList(), usePostList(), useScrollRoot(), useContentPanelController(), usePendingNavigationLatch(), ScrollableArticleList(), ScrollablePostList() (+9 more)

### Community 11 - "Slug Backfill & Href Builder"
Cohesion: 0.13
Nodes (10): usePostToolbar(), useCoverImageState(), useCreatePostFromFile(), useMarkdownFileParser(), usePostCoverImageUpload(), MarkdownUploadDialogConnector(), PostListToolbarConnector(), markdownToJsonContent() (+2 more)

### Community 12 - "Inline Image E2E Tests"
Cohesion: 0.11
Nodes (9): RootLayout(), AppSidebar(), NavHeader(), SidebarLayout(), UiFactoryLogo(), getConvexClient(), ConvexAuthProbe(), ConvexProvider() (+1 more)

### Community 13 - "Article Markdown Import"
Cohesion: 0.18
Nodes (12): assertHostnameNotBlocked(), assertHttps(), isBlockedAddress(), isBlockedIPv4(), isBlockedIPv6(), isRedirect(), isValidImageMagicBytes(), readWithLimit() (+4 more)

### Community 15 - "Query Test Suites"
Cohesion: 0.18
Nodes (10): resolveArticleCoverImageUrl(), mapInlineImages(), mapNode(), filterVisibleContent(), getUserAndContentAccess(), resolveStorageUrl(), resolvePostCategory(), resolvePostCoverImageUrl() (+2 more)

### Community 16 - "RAG Embedding Pipeline"
Cohesion: 0.21
Nodes (9): extractInlineImageStorageIds(), multisetDifference(), isOwnedByUser(), claimInlineImageOwnership(), filterCallerOwnedInlineIds(), filterUnreferencedStorageIds(), buildReferencedStorageSet(), collectReferencedFromCandidates() (+1 more)

### Community 17 - "Rick Rubin Seed Mutations"
Cohesion: 0.18
Nodes (8): ChatPanel(), ProfileLogo(), ProfilePanel(), useConversations(), parseConversationId(), ChatRouteController(), useChatRouteController(), useProfileRouteData()

### Community 18 - "System Prompt Composition"
Cohesion: 0.18
Nodes (6): ContentBackLink(), InteractionPanel(), useChatSearchParams(), AnimatedArticleRow(), CloneActionsProvider(), useCloneActions()

### Community 19 - "Mutation Test Suites"
Cohesion: 0.19
Nodes (8): CollapsedProfileAvatarButton(), ContentPanelToggle(), DesktopWorkspace(), useInteractionPanelController(), useResizeHandleExpand(), useOptionalWorkspaceChrome(), useWorkspaceChrome(), WorkspaceChromeProvider()

### Community 20 - "Rick Rubin Seed Helpers"
Cohesion: 0.17
Nodes (8): POST(), POST(), createConversation(), endConversation(), TavusApiError, applyMarks(), serializeArticlesToContext(), serializeNode()

### Community 21 - "Orphan Sweep Tests"
Cohesion: 0.24
Nodes (8): blobExists(), bodyWithImages(), imageNode(), insertAppUserAndSignIn(), makeT(), normalizeConvexGlob(), SafeFetchError, storeBlob()

### Community 22 - "Bio Embedding Source Tests"
Cohesion: 0.22
Nodes (5): MobileWorkspace(), WorkspaceShell(), useProfileWorkspaceRouteData(), getProfileTabHref(), isProfileTabKind()

### Community 23 - "System Prompt Helper Tests"
Cohesion: 0.21
Nodes (5): onSelectionUpdate(), shouldShowTextMenu(), getActiveTextStyle(), TextStylePicker(), ToolbarSeparator()

### Community 24 - "Bio Embedding Serializer"
Cohesion: 0.26
Nodes (6): createAuth(), getPlaywrightTestSecret(), isPlaywrightTestEmail(), isPlaywrightTestMode(), authorizeTestRequest(), secretsMatch()

### Community 25 - "Slug Backfill Tests"
Cohesion: 0.2
Nodes (5): VideoCallContent(), Conversation(), CVIProvider(), useCallState(), useVideoCall()

### Community 26 - "Convex App Registry"
Cohesion: 0.22
Nodes (4): SlashCommandSuggestions(), buildSlashCommandItems(), filterSlashCommandItems(), createSuggestionRenderer()

### Community 27 - "Waitlist Tests"
Cohesion: 0.24
Nodes (4): AppDockContent(), useDockConfig(), useDockVisibility(), useDock()

### Community 28 - "OTP Send Tests"
Cohesion: 0.29
Nodes (4): makeT(), normalizeConvexGlob(), setupOwnerAndSignIn(), storeBlob()

### Community 29 - "Allowlist Tests"
Cohesion: 0.42
Nodes (6): backfillSlugs(), findFreeSlug(), validateContentStringLength(), assertValidSlug(), generateSlug(), isValidSlug()

### Community 30 - "Auth Trigger Tests"
Cohesion: 0.2
Nodes (4): ButtonGroupWrapper(), ButtonVariants(), ButtonsView(), ShinyButton()

### Community 31 - "Email Templates"
Cohesion: 0.24
Nodes (3): Divider(), PageSection(), PeekingBottomDrawer()

### Community 32 - "Waitlist Mutations"
Cohesion: 0.24
Nodes (4): formatDateRange(), formatMonthYear(), isSameMonthYear(), safeHttpUrl()

### Community 35 - "Tool Query Href Resolver"
Cohesion: 0.31
Nodes (3): insertAppUserAndSignIn(), makeT(), normalizeConvexGlob()

### Community 36 - "Email Send Actions (templates)"
Cohesion: 0.33
Nodes (5): ArticlesContentLayout(), BioContentLayout(), hasBetterAuthSession(), preloadAuthOptionalQuery(), PostsContentLayout()

### Community 37 - "Inline Image URL Helpers"
Cohesion: 0.22
Nodes (4): ArticleFilterDropdown(), ArticleSearchInput(), ArticleSortDropdown(), DeleteArticlesDialog()

### Community 38 - "Env Validation"
Cohesion: 0.33
Nodes (4): useUsernameAvailability(), isReservedUsername(), generateMetadata(), ProfileLayout()

### Community 39 - "Email Send Actions (transport)"
Cohesion: 0.28
Nodes (3): dragHandleBy(), dragHandlePath(), getHandlePosition()

### Community 40 - "Community 40"
Cohesion: 0.32
Nodes (5): collectExternalImageSrcs(), collectExternalImageSrcsRec(), collectInlineImageStorageIds(), isAbsoluteHttpsUrl(), importMarkdownInlineImagesCore()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (3): ImportResultStatus(), MarkdownFileInput(), ParsedMetadataPreview()

### Community 45 - "Community 45"
Cohesion: 0.32
Nodes (3): getDistanceFromBottom(), handleScroll(), isNearBottom()

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (3): ArticleDetail(), PostMetadata(), formatLongDate()

### Community 55 - "Community 55"
Cohesion: 0.43
Nodes (4): HomePage(), enforceOnboardingGate(), hasFinishedOnboarding(), ProtectedLayout()

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (3): ContentCategoryFilterContent(), ContentCategoryFilterList(), ContentCategoryFilterSearch()

### Community 57 - "Community 57"
Cohesion: 0.6
Nodes (5): createClientSentryOptions(), createEdgeSentryOptions(), createServerSentryOptions(), createSharedSentryOptions(), parseTracesSampleRate()

### Community 58 - "Community 58"
Cohesion: 0.47
Nodes (3): ToastAction(), ToastClose(), useToastContext()

### Community 62 - "Community 62"
Cohesion: 0.6
Nodes (4): buildContentInventorySentence(), composeSystemPrompt(), SAFETY_PREFIX(), truncateToBudget()

## Knowledge Gaps
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkspaceToolbar()` connect `Cross-Module Helpers & Validators` to `Better Auth Triggers & Plugins`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `ContentPanel()` connect `Cross-Module Helpers & Validators` to `Bio Embedding Source Tests`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `useChatSearchParams()` (e.g. with `MobileWorkspace()` and `ProfilePanel()`) actually correct?**
  _`useChatSearchParams()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `useProfileRouteData()` (e.g. with `ProfileLogo()` and `CollapsedProfileAvatarButton()`) actually correct?**
  _`useProfileRouteData()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Chat Streaming + Better Auth (fused)` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Cross-Module Helpers & Validators` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Inline Image Policy & Constants` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._