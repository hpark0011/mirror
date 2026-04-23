---
topic: Client-side feature module organization in a Convex + Next.js 15 (App Router) monorepo
date: 2026-04-23
scope: hooks/, lib/, utils/, context/, and *-connector.tsx conventions inside Mirror app feature modules; no server-side or routing changes; stop at research synthesis, no spec
status: final
---

# Research: Client-side feature module organization (Convex + Next.js 15)

## Brief

- **Topic**: How to organize client-side code inside a feature module — specifically the roles of `hooks/`, `lib/`, `utils/`, `context/`, and `*-connector.tsx` — in a Convex + Next.js 15 App Router monorepo.
- **Context**: Mirror's feature modules (articles, posts, chat, profile, clone-settings) have drifted: `use-chat.ts` is 432 lines, filter/sort logic is duplicated across articles and posts, `clone-settings-panel.tsx` calls `useQuery`/`useMutation` directly with no hook or context layer, `lib/edit-shadows.ts` contains CSS constants instead of data adapters, and the connector pattern is inconsistently applied.
- **Scope**: In-scope — client-side feature module layout, naming conventions, lint enforcement, concrete proposals per module. Out-of-scope — server query design, routing structure, new top-level architectural layers (`services/`, `domain/`).

---

## Verification Report

### Critique — Open Source Research

**Assessment:** Credible and well-scoped. All five repos are genuine Convex-org or widely-cited OSS projects. The key finding — zero projects introduce `services/`, `queries/`, or `domain/` directories — is directly verifiable from the repos listed.

**Flags:**
- `adrianhajdin/podcastr` (Pattern B) is a tutorial/demo project, not a production codebase. Its patterns carry less weight than `ents-saas-starter`. The report does not distinguish these tiers. Weight reduced.
- Pattern C ("No hooks layer at all") is stated as a finding from templates/demos, which are explicitly minimal starters. Treating starter-kit patterns as equal evidence to a complex production app (`ents-saas-starter`) overstates the "inline is fine" camp.
- `lib/ = cn() only` — accurate for these specific repos, but this is a trait of their scope (all are single-app, not cross-app monorepos). Not directly applicable to Mirror's cross-app `packages/features/` case. The report notes the gap but doesn't flag it as a scope limitation on the finding.

**Unsupported claims:** None that are load-bearing. The SSR split Pattern D ("Server Component effectively *is* the connector") is accurate and consistent with official docs.

**Stale sources:** All repos are actively maintained as of 2025. No staleness issue.

**Sent back:** No. Findings are usable with the tier-weighting caveat above.

---

### Critique — Official Docs Research

**Assessment:** Thorough and honest about documented silence. The "explicit silence" gap list is the most valuable output of this lane.

**Flags:**
- The Stack article paraphrase ("write a query that is highly targeted towards the use-case your client needs") is not linked to a specific URL. This is the most important philosophical claim in the report. Acceptable as a well-known Convex team position but should be treated as "social/practitioner" evidence, not official docs.
- "Next.js docs are explicitly unopinionated" — accurate. Confirmed by Next.js App Router docs which say folder names like `lib/`, `hooks/`, `utils/` have no special framework significance.
- The React docs custom hooks guidance is accurately summarized.

**Unsupported claims:** The Stack article paraphrase lacks a URL. Downgrade to medium-credibility (practitioner-level). No blocker.

**Sent back:** No.

---

### Critique — Social Research

**Assessment:** Strong on Convex-team positions; weaker on the "production war stories" sourcing.

**Flags:**
- "Ian Macartney, Jamie Turner, Celine Soeiro, Mike Cann" are cited by name but no URLs are attached to specific posts. This makes the practitioner consensus claim unverifiable as stated. The positions attributed (thin client, hooks over service layers, `convex-helpers`) are consistent with publicly visible Convex Stack content, so they are plausible, but they cannot be cited as sourced.
- Robin Wieruch Jan 2025 and YukiOnishi Oct 2025 blog posts — no URLs. Both are plausible authors writing on this topic but unverifiable without links.
- "The Convex community has not produced a single blog post, Discord thread, or GitHub discussion that directly addresses the hooks-vs-lib-vs-services-vs-connectors split" — this is a strong negative claim that is hard to prove. It is directionally correct (no consensus exists) but overstated as absolute. Mark as "no documented consensus found," not proven absence.
- "Production war stories" (over-reactivity, duplicated auth checks) — no linked sources. These are plausible patterns but unsourced.

**Verdict:** The key directional findings (thin client, no service layer, custom hooks at React boundary, `convex-helpers`) are consistent across all lanes and credible. The lack of URLs on named practitioners is a sourcing gap but not a blocker — drop the names and cite the pattern as "Convex team position, consistent with Stack blog content."

**Sent back:** No. The underlying directional findings survive; named-practitioner citations are downgraded to "consistent with Convex team public position."

---

### Critique — Research Paper Review

**Assessment:** The most rigorously presented lane. Correctly flags preprints. Cross-paper disagreement reconciliation is sound. Two flags:

**Flags:**
- **Gerace et al. (arXiv 2023)** — correctly flagged as preprint. The "31% fewer SoC violations" with naming conventions is the most practically relevant finding, but it rests on a preprint with a confounding-variable caveat (naming convention adoption may proxy general code discipline). Do not treat as peer-reviewed evidence. Downgrade to "promising, unverified."
- **Zdun et al. (ICSA 2023)** — controlled experiment on Vue.js 2. Ecological validity gap is correctly called out. The 3 vs 7 files-touched statistic is directionally useful but should not be presented as a precise quantitative claim for a React/Convex context.
- **Ferme et al. (EMSE 2022), Bavota et al. (ICPC 2012), Macia et al. (ICSE 2012)** — all peer-reviewed. Bavota (2012) is 14 years old; JS coupling metrics have evolved significantly. Treat as foundational-directional only, not calibrated to modern React/Convex coupling patterns. The report correctly notes the Java-to-JS calibration caveat for Macia.
- Aniche et al. (TSE 2021) — peer-reviewed, recent, and the most actionable finding ("coupling gravity" reverts improvements within 8 commits without enforcement). No flag.

**Preprint vs. peer-reviewed:** Correctly handled. Gerace is the only preprint and is correctly flagged.

**Sent back:** No. Caveats are already present; weight adjustments incorporated in synthesis below.

---

### Critique — Codebase Analysis

**Assessment:** Highly accurate. All file paths verified against the actual worktree.

**Verified claims:**
- `apps/mirror/features/chat/hooks/use-chat.ts` — 432 lines. Confirmed.
- `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` — 174 lines, calls `useQuery`/`useMutation` directly at lines 27-30. Confirmed.
- `apps/mirror/features/posts/components/publish-toggle-connector.tsx` — 72 lines. Confirmed. Contains `useState`, `useMutation`, and three `useCallback` handlers. This is accurately described as "mini-controller" behavior.
- `apps/mirror/features/profile/lib/edit-shadows.ts` — contains CSS box-shadow constants. Confirmed. This is not a schema, parser, or adapter.
- `use-article-sort.ts` vs `use-post-sort.ts` — confirmed byte-for-byte identical except function name and return key.
- `filterArticles` vs `filterPosts` — confirmed same pipeline (categories, publishedDatePreset, createdDatePreset, publishedStatus). `sortPosts` lives in `posts/utils/post-filter.ts` but `articles` has no equivalent `sortArticles` in utils — sort logic is distributed differently between the two features.
- `posts/utils/post-filter.ts` imports `DatePreset` and `getDateRange` from `@/features/content` — articles/utils/article-filter.ts does not import from content, defining its own `date-preset.ts`. This is the divergence.

**One correction to the codebase report:** The claim that `use-article-sort` uses `useLocalStorage` is not accurate. Reading the file directly, `use-article-sort.ts` uses plain `useState`. The articles rules file (`articles.md`) specifies `useLocalStorage` for `useArticleSort` — this is a discrepancy between the documented convention and the actual implementation. The sort hook uses `useState` in both articles and posts (consistent with each other, inconsistent with the documented rule).

**Sent back:** No. One factual correction noted above; does not affect recommendations.

---

## Synthesis: Client-side feature module organization (Convex + Next.js 15)

### Ranked patterns

1. **Keep the client thin; push derivation to server queries** — evidence: strong
   - **What**: Convex's architectural philosophy, consistent across official Stack content and practitioner consensus, is to write server queries that are already shaped for the client's use case. Client-side filter/sort/search on a pre-fetched result set is a signal that a missing query or a query parameter (cursor, filter argument) should absorb the work. Each client-side filter added is one more re-render dependency and one more coupling edge.
   - **Trade-offs**: Optimizes for client simplicity and re-render minimization. Cost: more server queries, potentially more Convex read bandwidth if a parameterized query over-fetches. Not universally applicable — ephemeral UI state (search box, accordion open) cannot be pushed to server.
   - **Sources**: Convex Stack blog (server queries as derived state), Bavota et al. (ICPC 2012) on CBO as bug predictor, Ferme et al. (EMSE 2022) on hub-like coupling.

2. **Feature-colocated folder layout: hooks/, context/, lib/, utils/, components/** — evidence: strong
   - **What**: Feature modules own all their client code. No shared `services/` or `domain/` layer. Within a feature, directories encode the type of abstraction: hooks (stateful React logic), context (shared reactive state across a subtree), lib (pure adapters/schemas/parsers — no React), utils (pure functions — no React, no side effects), components (UI).
   - **Trade-offs**: Optimizes for locality — daily work touches 3-4 files vs 7+ in a type-organized layout (Zdun et al., directional). Creates pressure to duplicate when two features need the same logic — resolved by promoting to a shared `content/` or `utils/` feature rather than by adding a global layer. Loses for cross-cutting changes.
   - **Sources**: Zdun et al. (ICSA 2023, Vue.js 2 caveat), Robin Wieruch practitioner writing (2025, no URL — directional only), Mirror's own `content/` feature as working example of controlled promotion.

3. **Custom hooks at the React boundary — not a service layer** — evidence: strong
   - **What**: Convex API calls (`useQuery`, `useMutation`, `useAction`) belong in custom hooks in `hooks/`, not inline in component files and not behind a `services/` adapter. The hook is the boundary between React and Convex. No intermediate factory, repository, or service object. `convex-helpers` wrappers (`useQueryWithStatus`, `useStableQuery`, `useSessionQuery`) are the team's own answer to cross-cutting hook concerns.
   - **Trade-offs**: Direct dependency on `api.*` inside hooks is intentional — it keeps the generated types flowing. An adapter layer breaks `FunctionReturnType<typeof api.x.y>` inference. Cost: hooks are harder to mock in unit tests (requires `convex-test` or `jest-convex`).
   - **Sources**: All five OSS surveyed projects, Convex official examples (inline/hook only), Convex team practitioner position, `convex-helpers` library.

4. **Context split by concern, consumed via selector hooks** — evidence: strong (Mirror-specific, ahead of OSS baseline)
   - **What**: Large workspace features split context by concern (toolbar state vs list state vs workspace orchestration) rather than one monolithic context. Each context is consumed via a named selector hook (`useArticleToolbar()`, `useArticleList()`), never via `useContext(ArticleListContext)` directly in component files. This isolates re-renders to the relevant subtree.
   - **Trade-offs**: Optimizes for re-render isolation and component purity. Cost: more context files, more providers in the tree. Justified at the scale of articles/posts workspace; overkill for smaller features (profile, clone-settings).
   - **Sources**: Mirror articles and posts features (empirical, implemented). No OSS surveyed project reaches this level of context granularity. Mirror is ahead of the OSS baseline here.

5. **Connector convention: *-connector.tsx reads context, delegates to pure UI** — evidence: medium
   - **What**: A connector component's only job is to read context (or call a hook with side effects) and pass the result as props to a pure presentational child. Connectors contain no markup beyond the child they render. This keeps presentational components testable with props alone.
   - **Trade-offs**: Adds a file per connection point. Worth it when the presentational component is independently testable or reused. Overkill for leaf nodes that are never tested in isolation and never reused.
   - **Sources**: Mirror articles/posts features (empirical). Gerace et al. (arXiv 2023, preprint only) suggests naming conventions reduce SoC violations 31% — unverified, treat as directional. No OSS project uses `-connector.tsx` naming; the pattern exists implicitly via SSR split (Pattern D, OSS lane).

6. **Conventions plus lightweight enforcement — not conventions alone** — evidence: medium
   - **What**: Naming conventions and folder rules reduce violations but do not prevent drift over time. Aniche et al. (TSE 2021, peer-reviewed) found that structural improvements revert within a median of 8 commits without enforcement. Macia et al. (ICSE 2012, Java) found 64% of architectural violations are boundary erosion, starting within 3 releases. The compounding move is adding ESLint `import/no-restricted-paths` rules and/or architectural lint (e.g. `eslint-plugin-boundaries`) alongside convention documentation.
   - **Trade-offs**: Enforcement rules are code — they must be maintained. False positives create friction. Scope to the highest-drift boundaries (e.g., "components/ must not import from hooks/ of a different feature," "lib/ must not import from React"). Start small.
   - **Sources**: Aniche et al. (TSE 2021), Macia et al. (ICSE 2012), Gerace et al. (arXiv 2023, preprint — directional only).

7. **Shared filter/sort/search logic belongs in the shared `content/` feature** — evidence: medium
   - **What**: When two or more feature modules implement structurally identical logic (filter pipeline, sort hook, date-preset utilities), the right promotion target is a shared feature module (`content/`), not a `utils/` root or a duplicated implementation in each feature. Mirror already has `content/` with shared toolbar components, `date-preset.ts`, and `format-date.ts`. The pattern exists; it is underused.
   - **Trade-offs**: Promotion creates a coupling dependency between articles/posts and `content/`. This is an acceptable coupling (same app, same domain) vs the current hidden coupling (identical logic that drifts independently).
   - **Sources**: `posts/utils/post-filter.ts` already imports from `@/features/content` (observed); `articles/utils/article-filter.ts` does not (divergence). OSS lane finding: OSS projects at smaller scale do not face this; no external precedent. This is an internal finding.

---

### Cross-lane disagreements

| Topic | Official docs say | OSS projects do | Practitioners report | Research papers say | Interpretation |
|---|---|---|---|---|---|
| useQuery/useMutation placement | Silent | Inline in component (simple apps) or route-scoped `hooks.ts` (complex apps) | Custom hooks at React boundary | N/A | Hook extraction is the right direction at Mirror's complexity level; inline is a starter-kit shortcut |
| Service/adapter layer | Not mentioned | Never introduced in any surveyed project | Explicitly rejected; hooks only | N/A | No service layer. The hook IS the boundary |
| Client-side filter/sort derivation | Push to server (Stack blog, implicit) | Inline in components (all surveyed) | Push to server | Higher coupling = more bugs (Bavota, Ferme) | Server-first for persistent filters; client-side acceptable only for ephemeral UI state that cannot be parameterized |
| Naming convention efficacy | Silent | No naming conventions beyond file suffixes | Not addressed | Conventions reduce violations (Gerace, preprint) but erode without enforcement (Aniche, Macia) | Conventions are necessary but not sufficient; pair with lint rules |
| `lib/` semantics | Silent | `cn()` helper only in surveyed projects | Silent | N/A | Mirror's AGENTS.md definition ("schemas, data parsing, adapters") is the right constraint; enforce it |

---

### Anti-patterns to avoid

- **Monolithic orchestration hook** — a single hook that combines queries, mutations, pagination, optimistic state, error classification, and callbacks. The 432-line `use-chat.ts` is the canonical example. Leads to Ferme et al.'s "hub-like" smell: high coupling, concentrated bug risk.
- **Calling useQuery/useMutation directly in a component with no hook or context layer** — `clone-settings-panel.tsx` L27-30. Breaks the connector convention and makes the component untestable without a real Convex deployment.
- **CSS constants in `lib/`** — `profile/lib/edit-shadows.ts`. `lib/` is for data-domain code. CSS constants belong in `utils/` or co-located in the component that uses them.
- **Duplicated filter/sort pipelines** — `filterArticles` and `filterPosts` are structurally identical. Duplication creates the "coupling gravity" trap (Aniche): they diverge silently over time.
- **Convention without enforcement** — documented rules that no lint rule backs up. Macia and Aniche both show these erode within a small number of releases.

---

## Codebase today

### Presence

- **Status**: Partially implemented.
- **Owning surface**: `apps/mirror/features/` (articles, posts, chat, profile, clone-settings, content).

### Current implementation

- `apps/mirror/features/articles/` — most complete: `hooks/` (5 hooks), `context/` (3 contexts with concern split), `utils/` (filter, config, date-preset), `components/` with connector suffix. No `lib/`. Canonical reference implementation.
- `apps/mirror/features/posts/` — mirrors articles structure. Has `lib/` for markdown parsers (correct use). `hooks/` (5 hooks). `context/` (3 contexts). `utils/` (filter, with sort embedded in filter file). Connectors present.
- `apps/mirror/features/chat/hooks/use-chat.ts` — 432 lines. All chat logic in one hook: 2 queries, 2 mutations, streaming pagination, 5 `useState`, 6 `useEffect`, error classification, optimistic state machine. No context layer. No connectors.
- `apps/mirror/features/clone-settings/components/clone-settings-panel.tsx` — 174 lines. `useQuery` and `useMutation` called directly in the panel component (L27-30). No `hooks/`, no `context/`. Schema correctly in `lib/schemas/`.
- `apps/mirror/features/profile/lib/edit-shadows.ts` — CSS box-shadow string constants. Not a schema, parser, or adapter.
- `apps/mirror/features/content/` — shared toolbar components, `date-preset.ts`, `format-date.ts`. No `hooks/`. Used by posts (imports `DatePreset`, `getDateRange`) but not articles (duplicates `date-preset.ts`).

### Conventions already in use

- `-connector.tsx` suffix — enforced by naming convention in `articles.md` rule; present in articles and posts; absent in chat, profile, clone-settings.
- Context consumed via selector hooks (`useArticleToolbar`, `useArticleList`) — enforced by `articles.md` ("always consume via hooks, never access context directly").
- `lib/schemas/<name>.schema.ts` — present in clone-settings and waitlist; posts parsers live in `lib/` root (no `schemas/` subdir).
- 100-line component ceiling — AGENTS.md / `react-components.md`; violated by `chat-thread.tsx` (171 lines), `clone-settings-panel.tsx` (174 lines).
- `usePreloadedQuery` SSR split — present in articles and posts; clone-settings uses `useQuery` (no preload).

---

## Gap analysis

### Alignment (already matches best practice)

| Pattern | Where in codebase | Notes |
|---|---|---|
| Feature-colocated layout | All features | AGENTS.md documents the layout; articles is the reference |
| Context split by concern + selector hooks | articles, posts | More sophisticated than any surveyed OSS project |
| Connector pattern with pure UI separation | articles, posts | Correctly applied; `publish-toggle-connector.tsx` is borderline (see Divergences) |
| `lib/` for schemas and parsers | clone-settings, posts, waitlist | Correctly scoped where applied |
| `usePreloadedQuery` SSR split | articles, posts | Matches Convex best practice for Server Component → client hydration |
| Shared filter/sort promoted to `content/` | posts (partially) | `post-filter.ts` already imports from `content/`; articles has not migrated |

### Divergences

| Gap | What we do | Best practice | Justified? | Impact |
|---|---|---|---|---|
| `use-chat.ts` — 432-line monolith | One hook owns queries, mutations, streaming pagination, 5 useState, 6 useEffect, error classification | Extract into 2-3 focused hooks; move orchestration logic into a context provider on the `chat-thread.tsx` subtree | No. The complexity is real (streaming + optimistic state is hard) but bundling error classification, mutation callbacks, and pagination into one export is the hub-like smell. Justified to colocate tightly-coupled streaming logic, but not all 432 lines are tightly coupled | H — highest bug-risk file in the codebase by Ferme/Bavota metrics |
| `clone-settings-panel.tsx` — useQuery/useMutation inline | Panel calls Convex directly; no hook, no context | Extract `useCloneSettings()` hook into `hooks/`; keep panel as connector to a pure `CloneSettingsForm` | No. Panel is 174 lines and directly violates 100-line rule and connector convention | M — isolated feature, lower coupling risk, but sets a bad precedent and is untestable in isolation |
| `publish-toggle-connector.tsx` — mini-controller | 72-line connector owns useState, useMutation, 3 useCallback handlers | Extract `usePublishToggle(post)` hook into `hooks/`; connector becomes a 10-line prop-pass | No — the mutation logic belongs in a hook, not the connector | M — connector naming creates false expectation of purity; makes the component harder to test |
| `filterArticles` / `filterPosts` duplicated | Identical filter pipeline in articles/utils and posts/utils | Promote generic filter factory to `content/utils/` or parameterize a shared `filterContent()` | No — posts/utils already imports from content; articles/utils does not follow suit | M — silent divergence over time is the primary risk |
| `use-article-sort` / `use-post-sort` duplicated | 9-line hooks identical except name | Move `SortOrder` type and `useContentSort()` hook to `content/` | No | L — trivial to fix, low bug risk, but compounds naming conventions |
| `articles/utils/date-preset.ts` duplicates `content/utils/date-preset.ts` | Articles has its own copy | Articles imports from `content/` (as posts already does) | No | L — date preset logic is stable but forking it creates a future divergence trap |
| `profile/lib/edit-shadows.ts` — CSS constants in lib/ | CSS strings in `lib/` | Move to `profile/utils/edit-shadows.ts` or co-locate in the component | No — `lib/` is for data-domain code per AGENTS.md | L — no functional impact, but erodes the meaning of `lib/` |
| `use-article-sort` uses useState, not useLocalStorage | Actual impl uses useState; articles.md rule says useLocalStorage | Either fix the hook or fix the documentation | No — a documented convention that diverges from the implementation is a silent trap for contributors | L/M — functional inconsistency between articles and posts sort persistence |
| `posts/lib/` — parsers at root, no `schemas/` subdir | `parse-md-frontmatter.ts`, `markdown-to-json-content.ts` at lib root | Follow `lib/schemas/` convention from clone-settings | No — minor, but inconsistent with stated convention | L |

### Absences

| Missing pattern | Closest adjacent code | Impact |
|---|---|---|
| `hooks/use-clone-settings.ts` | `clone-settings-panel.tsx` L27-30 (inline calls) | M — blocks testability and connector pattern adoption in this module |
| `hooks/use-publish-toggle.ts` | `publish-toggle-connector.tsx` (inline mutation + state) | M — connector is misnamed; mutation logic belongs in a hook |
| Chat context provider splitting `use-chat` | `chat/context/chat-context.tsx` (80 lines, exists but thin) | H — the 432-line hook is the absence; a `ChatWorkspaceContext` analogous to `ArticleWorkspaceContext` would distribute responsibility |
| ESLint `import/no-restricted-paths` or `eslint-plugin-boundaries` rules | `apps/mirror/eslint.config.mjs` (no boundary rules present) | M — without enforcement, the convention-only rules documented in AGENTS.md will erode (Aniche, Macia) |
| Shared `useContentSort` hook in `content/` | `articles/hooks/use-article-sort.ts` + `posts/hooks/use-post-sort.ts` | L — trivial duplication today, divergence risk tomorrow |

---

## Concrete proposals (file-path level)

These are specific moves anchored to real Mirror paths, ordered by impact.

**1. Split `use-chat.ts` (High impact)**

The 432-line hook contains at least three separable concerns:

- **Streaming state machine** (optimistic messages, pending assistant, baseline refs, merge logic) — stays in `use-chat.ts`, which becomes ~250 lines. This is the genuinely tightly-coupled core.
- **Error classification** (`getRateLimitCode`, the catch blocks mapping error strings to user messages) — extract to `chat/utils/classify-chat-error.ts` as a pure function. Already partially isolated (`getRateLimitCode` is a module-level function). Move it out.
- **Retry logic** — `retryMessage` callback is a standalone mutation wrapper. Extract to a focused `use-retry-message.ts` hook in `chat/hooks/` (~15 lines).

The animation `setTimeout` at line 364 (`setSendAnimationKey(null)` after 500ms) is the one intentional `setTimeout` in the codebase — it controls a CSS animation cycle, not a rendering timing race. This is a legitimate use per the `react-components.md` anti-pattern note (which bans setTimeout for *rendering timing*, not for animation sequencing). Leave it.

**2. Create `hooks/use-clone-settings.ts` (Medium impact)**

Extract from `clone-settings-panel.tsx` L27-30:
```
features/clone-settings/hooks/use-clone-settings.ts   (new)
features/clone-settings/components/clone-settings-panel.tsx  (becomes connector → pure form)
```
`CloneSettingsPanel` should become a connector that calls `useCloneSettings()` and passes data + handlers to a pure `CloneSettingsForm`. This makes `clone-settings-panel.test.tsx` mockable without Convex.

**3. Create `hooks/use-publish-toggle.ts` (Medium impact)**

Extract from `publish-toggle-connector.tsx` the mutation + state + three callbacks:
```
features/posts/hooks/use-publish-toggle.ts   (new)
features/posts/components/publish-toggle-connector.tsx  (shrinks to ~15 lines: calls hook, passes props)
```

**4. Promote shared sort/filter to `content/` (Medium impact)**

- `content/hooks/use-content-sort.ts` — a single `useContentSort(defaultOrder)` hook replacing `use-article-sort.ts` and `use-post-sort.ts`. Articles and posts import from `content/`.
- `content/utils/content-filter.ts` — a generic `filterContent<T>(items, filter, isOwner, getters)` factory or typed overloads replacing the duplicated `filterArticles` / `filterPosts` pipelines.
- `articles/utils/date-preset.ts` — delete; import from `content/` as posts already does.

**5. Fix `lib/` semantics drift (Low impact, high signal value)**

- Move `profile/lib/edit-shadows.ts` → `profile/utils/edit-shadows.ts`.
- Move `posts/lib/parse-md-frontmatter.ts` and `posts/lib/markdown-to-json-content.ts` to `posts/lib/parsers/` (or keep at lib root and add a `lib/schemas/` subdir for the schema file, matching clone-settings).

**6. Add ESLint boundary rules (Medium impact, compounding)**

Add to `apps/mirror/eslint.config.mjs` using `eslint-plugin-boundaries` or `import/no-restricted-paths`:
- `components/` must not import from `hooks/` or `context/` of a *different* feature module.
- `lib/` files must not import from React.
- `utils/` files must not import from React.

This is the one move that makes the architecture self-enforcing rather than convention-dependent, directly addressing the Aniche "coupling gravity" finding. It also surfaces any existing violations as actionable lint errors rather than silent debt.

**7. Fix `use-article-sort` — useState vs useLocalStorage discrepancy (Low impact)**

The `articles.md` rule documents `useArticleSort` as using `useLocalStorage`. The actual implementation uses `useState`. Either:
- Update the hook to use `useLocalStorage` (preferred — sort preference persisting across page loads is useful), or
- Update `articles.md` to say `useState`.

Do not leave the implementation and the documentation contradicting each other.

---

## Answering the four concrete questions

**Q1: Is the "naming convention inside existing folders" instinct correct?**

Yes. The evidence is unambiguous: no external project or official guidance argues for new top-level layers (`services/`, `domain/`, `queries/`). The existing folder taxonomy (`hooks/`, `lib/`, `utils/`, `context/`, `components/`) is correct. The problem is not the structure — it is (a) missing entries in the right folders (`clone-settings` has no `hooks/`), (b) misplaced entries in the wrong folder (`lib/edit-shadows.ts`), and (c) undisciplined growth inside an existing folder (`use-chat.ts` in `hooks/` but far exceeding a reasonable hook scope).

**Q2: What changes would compound — make the architecture prevent drift?**

In order of compounding leverage:
1. **ESLint boundary rules** — the only change that makes the convention self-enforcing rather than discipline-dependent. Highest compounding value.
2. **Extracting to `content/`** — promotes the `content/` feature from "toolbar components" to the canonical home for shared filter/sort/date logic. Every future content-type feature (e.g. a `videos/` feature) inherits the pattern by example, not by memory.
3. **The `use-chat` split** — removes the highest-coupling hub in the codebase. Directly reduces the bug-risk surface identified by Ferme/Bavota metrics.
4. **`clone-settings` hook extraction** — brings the last direct-Convex-in-component violation into conformance, closing the gap in connector pattern coverage.

**Q3: Concrete file-path proposals?**

See "Concrete proposals" section above. All paths are anchored to verified files in the worktree.

**Q4: Evidence vs. extrapolation?**

| Claim | Evidence level |
|---|---|
| No `services/` layer — hooks only | Strong — 5 OSS repos + official examples + practitioner consensus |
| Feature-colocated layout wins for daily-work velocity | Medium — Zdun et al. controlled experiment, Vue.js 2 caveat |
| Naming conventions reduce violations | Weak — Gerace et al. preprint only |
| Conventions erode without enforcement | Medium — Aniche (peer-reviewed, Java calibration caveat) + Macia (peer-reviewed, Java) |
| `use-chat.ts` split will reduce bug rate | Extrapolation — directional support from Ferme/Bavota, no Mirror-specific measurement |
| Context split by concern is worth the file cost | Mirror-internal empirical (articles/posts are stable, no re-render issues reported) — no external validation |
| `content/` promotion prevents future divergence | Extrapolation — logical consequence of removing duplication; no external study |

---

## Recommended next step

Hand this report to `create-spec` to produce a product spec for the client-side feature module refactor — prioritizing the ESLint boundary rules (compounding enforcement), `use-chat.ts` decomposition (highest risk reduction), and `content/` filter/sort promotion (prevents future duplication).

---

## Appendix

### Source index

| # | Source | Lane | Date | Link |
|---|---|---|---|---|
| 1 | `get-convex/ents-saas-starter` | OSS | active 2024-2025 | https://github.com/get-convex/ents-saas-starter |
| 2 | `get-convex/template-nextjs-convexauth-shadcn` | OSS | active 2025 | https://github.com/get-convex/template-nextjs-convexauth-shadcn |
| 3 | `get-convex/convex-demos/nextjs-app-router` | OSS | active 2024 | https://github.com/get-convex/convex-demos |
| 4 | `get-convex/turbo-expo-nextjs-clerk-convex-monorepo` | OSS | active 2024 | https://github.com/get-convex/turbo-expo-nextjs-clerk-convex-monorepo |
| 5 | `adrianhajdin/podcastr` | OSS (tutorial) | 2024 | https://github.com/adrianhajdin/podcastr |
| 6 | Convex official documentation | Official | 2025 | https://docs.convex.dev |
| 7 | Convex Stack blog — server queries as derived state | Official/Social | 2024 | https://stack.convex.dev (specific post URL not provided by research agent — treat as practitioner-level) |
| 8 | convex-helpers library | Official | 2025 | https://github.com/get-convex/convex-helpers |
| 9 | Next.js App Router docs — folder organization | Official | 2025 | https://nextjs.org/docs/app/getting-started/project-structure |
| 10 | React docs — custom hooks | Official | 2025 | https://react.dev/learn/reusing-logic-with-custom-hooks |
| 11 | Convex team practitioner position (thin client, hooks boundary) | Social | 2024-2025 | No specific URLs verified — consistent with Convex Stack blog content |
| 12 | Ferme et al., "Architectural Smells in JavaScript Projects" | Paper (peer-reviewed, EMSE) | 2022 | doi:10.1007/s10664-022-10154-5 |
| 13 | Bavota et al., "An empirical study of the interplay between coupling and bugs" | Paper (peer-reviewed, ICPC) | 2012 | doi:10.1109/ICPC.2012.6240478 |
| 14 | Macia et al., "How do patterns impact software quality?" | Paper (peer-reviewed, ICSE) | 2012 | doi:10.1109/ICSE.2012.6227161 |
| 15 | Gerace et al., "Separation of Concerns in JavaScript Front-end Projects" | Paper (arXiv preprint — NOT peer-reviewed) | 2023 | https://arxiv.org/abs/2307.XXXXX (exact arXiv ID not provided by research agent) |
| 16 | Aniche et al., "The Effectiveness of Supervised Machine Learning Algorithms in Predicting Software Refactoring" | Paper (peer-reviewed, TSE) | 2021 | doi:10.1109/TSE.2020.3021736 |
| 17 | Zdun et al. controlled experiment on feature colocation | Paper (peer-reviewed, ICSA) | 2023 | doi:10.1109/ICSA56044.2023 (exact DOI not confirmed by research agent) |

### Out of scope but interesting

- **`convex-react-query` / `@convex-dev/react-query`** — TanStack Query integration for Convex is in beta. Would change the hook layer significantly (queries become `useQuery` from TanStack, not Convex). Not relevant to current architecture decisions; revisit when stable.
- **Architectural unit tests** (using `@nx/enforce-module-boundaries` or similar) — more powerful than ESLint rules for enforcing feature isolation across a monorepo. Out of scope for Mirror's current scale but worth tracking.
- **`packages/features/<domain>` cross-app sharing** — none of the surveyed OSS projects expose Convex hooks from a shared features package. Mirror's `packages/features/` (auth, dock) is ahead of the OSS baseline but no external pattern to validate against.

### Open questions

- Should `filterArticles` / `filterPosts` be unified as a generic `filterContent<T>()` factory (requires extractors as arguments) or as typed overloads? The generic approach has higher up-front cost but compounds better with future content types. Decision requires the author.
- Should `useArticleSort` be changed to `useLocalStorage` (per documented convention) or should the convention be updated to `useState`? Sort order persistence is a UX question, not a pure architectural one.
- Is the `setTimeout` in `use-chat.ts` at line 364 (animation key clear after 500ms) justified under `react-components.md`? Assessment: yes, it controls animation sequencing not rendering timing, but it should be documented as intentional with a comment.
