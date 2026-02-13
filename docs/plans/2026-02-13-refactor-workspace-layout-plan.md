---
title: "refactor: Workspace layout — toolbar separation & navbar/toolbar split"
type: refactor
date: 2026-02-13
architecture: docs/architecture/mirror-workspace-layout.md
---

# Workspace Layout Refactor

## Overview

Restructure the Mirror app's right panel to match the workspace layout architecture: a fixed **Workspace Navbar** (global controls), a fixed **Workspace Toolbar** (context-dependent controls), and a scrollable **Workspace Content** area. Currently the toolbar scrolls with content and there is no navbar/toolbar distinction.

## Problem Statement

Two structural gaps prevent the layout from matching the target architecture:

1. **ArticleToolbar scrolls with content** — It's rendered inside `ScrollableArticleList` which sits inside the `overflow-y-auto` div. Users lose access to sort/filter/search controls when scrolling down.

2. **No navbar/toolbar separation** — `ProfileHeader` is the only fixed element and mixes global controls (theme toggle) with contextual controls (back button). There's no layout slot for content-type-specific toolbars.

See `docs/architecture/mirror-workspace-layout.md` for full analysis.

## Target DOM Structure (right panel)

```
ResizablePanel (right)
  div.flex.flex-col.h-full
    WorkspaceNavbar                    ← global controls (theme toggle, future: content type tabs)
    WorkspaceToolbar slot              ← contextual (ArticleToolbar, or ArticleDetailToolbar, or future video toolbar)
    div.flex-1.min-h-0
      div.overflow-y-auto             ← only this scrolls
        WorkspaceContent               ← ArticleListView, ArticleDetailView, etc.
```

## Scope

| Metric | Value |
|--------|-------|
| **Gaps addressed** | Gap 1 (toolbar in scroll), Gap 2 (navbar/toolbar split) |
| **Phases** | 3 |
| **New files** | 4 |
| **Modified files** | 5 |
| **Deleted files** | 0 |
| **Quality gate** | `pnpm build --filter=@feel-good/mirror` after every phase |

## Affected Files

### New Files

| # | File | Phase | Purpose |
|---|------|-------|---------|
| 1 | `apps/mirror/features/articles/context/article-workspace-context.tsx` | 1 | Context provider holding all article hooks state |
| 2 | `apps/mirror/features/articles/views/article-toolbar-view.tsx` | 2 | Thin toolbar wrapper consuming from context |
| 3 | `apps/mirror/features/articles/views/article-detail-toolbar-view.tsx` | 2 | Toolbar for article detail page (back button) |
| 4 | `apps/mirror/components/workspace-navbar.tsx` | 2 | Global navbar extracted from ProfileHeader |

### Modified Files

| # | File | Phase | Change |
|---|------|-------|--------|
| 5 | `apps/mirror/features/articles/components/scrollable-article-list.tsx` | 1 | Move hook calls to context, consume from context |
| 6 | `apps/mirror/features/articles/index.ts` | 1 | Export new context provider and toolbar views |
| 7 | `apps/mirror/app/[username]/_components/profile-shell.tsx` | 3 | Restructure right panel with navbar + toolbar slot + content |
| 8 | `apps/mirror/app/[username]/page.tsx` | 3 | Wrap with ArticleWorkspaceProvider, pass toolbar slot |
| 9 | `apps/mirror/app/[username]/[slug]/page.tsx` | 3 | Pass article detail toolbar slot |

---

## Execution Graph

```
Phase 1: Extract Article Workspace Context
    │
    ▼
Phase 2: Create Navbar + Toolbar Views
    │
    ▼
Phase 3: Restructure Layout Shell
```

All phases are sequential — each depends on the previous.

---

## Phase 1: Extract Article Workspace Context

**Goal:** Move all article hook orchestration from `ScrollableArticleList` into a context provider, so toolbar and content can be rendered in different DOM positions while sharing state.

**Depends on:** Nothing

### Analysis

Currently `ScrollableArticleList` (`features/articles/components/scrollable-article-list.tsx`) calls 5 hooks and passes their returns as props to both `ArticleToolbar` and `ArticleListView`. To separate them in the DOM, the shared state needs to live in a context that wraps both.

**What moves into context:**
- `useArticleSearch(articles)` — needs `articles` prop on provider
- `useArticleSort()` — no dependencies
- `useArticleFilter()` — no dependencies (reads from localStorage)
- `useArticleSelection(allSlugs)` — depends on derived `allSlugs`
- `useArticleList(filteredByFilter, sortOrder, isFiltered)` — depends on pipeline output
- Derived: `filteredByFilter`, `uniqueCategories`, `shouldAnimate`, `handleSortChange`, `handleDelete`

**What stays in the consuming components:**
- `ArticleToolbar` reads toolbar-relevant slices from context
- `ArticleListView` reads list-relevant slices from context
- `ScrollableArticleList` becomes a thin wrapper or is replaced by direct context consumption

### Files

| # | File | Status | Agent |
|---|------|--------|-------|
| 1 | `features/articles/context/article-workspace-context.tsx` | new | A |
| 2 | `features/articles/components/scrollable-article-list.tsx` | modified | B |
| 3 | `features/articles/index.ts` | modified | B |

### Agent A — Article Workspace Context

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`

**Task:**

Create `apps/mirror/features/articles/context/article-workspace-context.tsx`.

Reference files to read first:
- `apps/mirror/features/articles/components/scrollable-article-list.tsx` (current hook orchestration to extract)
- `apps/mirror/features/articles/context/scroll-root-context.tsx` (context pattern in this feature)
- `apps/mirror/features/profile/context/profile-context.tsx` (context pattern in this app)

Requirements:

1. `"use client"` directive

2. Define context value type `ArticleWorkspaceContextValue`:
   ```typescript
   type ArticleWorkspaceContextValue = {
     // Toolbar state
     isOwner: boolean;
     sortOrder: SortOrder;
     onSortChange: (order: SortOrder) => void;
     search: UseArticleSearchReturn;
     filter: UseArticleFilterReturn;
     categories: { name: string; count: number }[];
     selectedCount: number;
     onDelete: () => void;

     // List state
     articles: Article[];
     hasMore: boolean;
     onLoadMore: () => void;
     username: string;
     isAllSelected: boolean;
     isIndeterminate: boolean;
     onToggleAll: () => void;
     isSelected: (slug: string) => boolean;
     onToggle: (slug: string) => void;
     shouldAnimate: boolean;

     // Empty state
     showEmpty: boolean;
     emptyMessage: string;
   };
   ```

3. Create context with `createContext<ArticleWorkspaceContextValue | null>(null)`

4. Create `ArticleWorkspaceProvider` component:
   - Props: `{ articles: Article[]; username: string; children: React.ReactNode }`
   - Move ALL hook calls from `ScrollableArticleList` into this provider:
     - `useIsProfileOwner()` from `@/features/profile`
     - `useArticleSearch(articles)`
     - `useArticleSort()`
     - `useArticleFilter()`
     - The `filteredByFilter` memo
     - `useArticleList(filteredByFilter, sortOrder, isFiltered)`
     - `useScrollRoot()`
     - `useArticleSelection(allSlugs)`
     - The `uniqueCategories` memo
     - The `shouldAnimate` state + timer ref + cleanup effect
     - The selection-clear effect (search open + filter change)
     - `handleSortChange` callback
     - `handleDelete` callback
     - The `showEmpty` and `emptyMessage` derivations
   - Wrap children in context provider with memoized value

5. Create `useArticleWorkspace()` hook:
   ```typescript
   export function useArticleWorkspace() {
     const context = useContext(ArticleWorkspaceContext);
     if (!context) throw new Error("useArticleWorkspace must be used within ArticleWorkspaceProvider");
     return context;
   }
   ```

6. Export `ArticleWorkspaceProvider` and `useArticleWorkspace`

**Critical:** The `articles` and `username` props come from the server component page.tsx. The provider is a client component boundary. `scrollRoot` comes from `useScrollRoot()` which reads from `ScrollRootProvider` — this context must wrap the provider or be consumed inside it.

### Agent B — Simplify ScrollableArticleList

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`
- **Sequential:** Runs after Agent A completes

**Task:**

Modify `apps/mirror/features/articles/components/scrollable-article-list.tsx`.

Read the current file and the new `article-workspace-context.tsx` first.

Refactor `ScrollableArticleList` to consume from `ArticleWorkspaceProvider` context instead of calling hooks directly:

1. Remove all hook imports and calls (they now live in the provider)
2. Import `useArticleWorkspace` from `../context/article-workspace-context`
3. The component now:
   - Calls `useArticleWorkspace()` to get all state
   - Renders ONLY the content portion (no toolbar):
     ```tsx
     export function ScrollableArticleList() {
       const ctx = useArticleWorkspace();
       if (ctx.showEmpty) return <div className="...">{ctx.emptyMessage}</div>;
       return (
         <ArticleListView
           articles={ctx.articles}
           hasMore={ctx.hasMore}
           onLoadMore={ctx.onLoadMore}
           scrollRoot={...}
           username={ctx.username}
           isOwner={ctx.isOwner}
           isAllSelected={ctx.isAllSelected}
           isIndeterminate={ctx.isIndeterminate}
           onToggleAll={ctx.onToggleAll}
           isSelected={ctx.isSelected}
           onToggle={ctx.onToggle}
           shouldAnimate={ctx.shouldAnimate}
         />
       );
     }
     ```
4. Remove the `ArticleToolbar` render — it will be rendered separately in the fixed zone (Phase 2)
5. Props are now empty or minimal (data comes from context)

Also update `features/articles/index.ts`:
- Export `ArticleWorkspaceProvider` and `useArticleWorkspace` from context
- Export new toolbar views (placeholder until Phase 2 creates them)
- Keep existing exports

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- `ArticleWorkspaceProvider` contains ALL hook calls that were previously in `ScrollableArticleList`
- No hook calls remain in `ScrollableArticleList` (it only reads from context)
- `useArticleWorkspace` throws if used outside provider
- Context value is memoized to prevent unnecessary re-renders
- `ScrollableArticleList` no longer renders `ArticleToolbar`
- The `scrollRoot` from `useScrollRoot()` is correctly consumed (provider must be inside `ScrollRootProvider`)
- `articles/index.ts` exports the new context provider
- No unused imports remain

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

**Note:** After this phase, the toolbar disappears from the UI since `ScrollableArticleList` no longer renders it. This is intentional — Phase 2 re-introduces it in the correct position.

---

## Phase 2: Create Navbar + Toolbar Views

**Goal:** Create the workspace navbar component and thin toolbar wrapper views that consume from the article workspace context.

**Depends on:** Phase 1

### Analysis

The current `ProfileHeader` mixes global and contextual controls. Split it into:
- `WorkspaceNavbar` — global controls (theme toggle, future content type tabs)
- `ArticleToolbarView` — consumes article workspace context, renders `ArticleToolbar`
- `ArticleDetailToolbarView` — back button for article detail page

The existing `ArticleToolbar` component stays as-is (it receives props). The new `ArticleToolbarView` is a thin wrapper that reads from context and passes props down.

### Files

| # | File | Status | Agent |
|---|------|--------|-------|
| 1 | `apps/mirror/components/workspace-navbar.tsx` | new | A |
| 2 | `apps/mirror/features/articles/views/article-toolbar-view.tsx` | new | A |
| 3 | `apps/mirror/features/articles/views/article-detail-toolbar-view.tsx` | new | A |

### Agent A — Navbar + Toolbar Views

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`

**Task:**

Create 3 files. Read these first:
- `apps/mirror/app/[username]/_components/profile-header.tsx` (current header to split)
- `apps/mirror/features/articles/components/article-toolbar.tsx` (toolbar props shape)
- `apps/mirror/features/articles/context/article-workspace-context.tsx` (context shape from Phase 1)

**File 1: `apps/mirror/components/workspace-navbar.tsx`**

Extract the global controls from `ProfileHeader` into a standalone navbar.

```tsx
"use client";

import { ThemeToggleButton } from "@feel-good/features/theme/components";
import { cn } from "@feel-good/utils/cn";

type WorkspaceNavbarProps = {
  className?: string;
};

export function WorkspaceNavbar({ className }: WorkspaceNavbarProps) {
  return (
    <nav
      className={cn(
        "flex h-10 items-center justify-end gap-2 px-4",
        className,
      )}
    >
      {/* Future: content type tabs (articles, video, sns) go here */}
      <ThemeToggleButton />
    </nav>
  );
}
```

**File 2: `apps/mirror/features/articles/views/article-toolbar-view.tsx`**

Thin wrapper that reads from `ArticleWorkspaceProvider` context and renders `ArticleToolbar` with the correct props.

```tsx
"use client";

import { useArticleWorkspace } from "../context/article-workspace-context";
import { ArticleToolbar } from "../components/article-toolbar";

export function ArticleToolbarView() {
  const ctx = useArticleWorkspace();
  return (
    <ArticleToolbar
      isOwner={ctx.isOwner}
      selectedCount={ctx.selectedCount}
      onDelete={ctx.onDelete}
      sortOrder={ctx.sortOrder}
      onSortChange={ctx.onSortChange}
      search={ctx.search}
      categories={ctx.categories}
      filter={ctx.filter}
    />
  );
}
```

**File 3: `apps/mirror/features/articles/views/article-detail-toolbar-view.tsx`**

Toolbar for article detail view — currently the back button from `ProfileHeader`.

```tsx
"use client";

import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";

type ArticleDetailToolbarViewProps = {
  username: string;
};

export function ArticleDetailToolbarView({ username }: ArticleDetailToolbarViewProps) {
  return (
    <div className="flex h-10 items-center px-4">
      <Link
        href={`/@${username}`}
        className="flex items-center gap-0.5 text-[14px] text-muted-foreground hover:text-foreground group"
      >
        <Icon
          name="ArrowLeftCircleFillIcon"
          className="size-6 text-icon group-hover:text-foreground"
        />
        <span className="leading-[1.2]">Back</span>
      </Link>
    </div>
  );
}
```

Also update `apps/mirror/features/articles/index.ts` to export the new views:
```typescript
export { ArticleToolbarView } from "./views/article-toolbar-view";
export { ArticleDetailToolbarView } from "./views/article-detail-toolbar-view";
```

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- `WorkspaceNavbar` contains only global controls (no content-type-specific logic)
- `ArticleToolbarView` reads all props from context — no prop drilling
- `ArticleDetailToolbarView` is a standalone component (no context dependency — it receives `username` as prop)
- The existing `ArticleToolbar` component is NOT modified — `ArticleToolbarView` wraps it
- All files have `"use client"` directive
- Import paths are correct
- `articles/index.ts` exports both new views

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

---

## Phase 3: Restructure Layout Shell

**Goal:** Modify `ProfileShell` to render workspace navbar + toolbar slot + scrollable content as three distinct zones, and update page.tsx files to provide the correct toolbar for each route.

**Depends on:** Phase 2

### Analysis

`ProfileShell` needs to accept a `toolbar` slot from its children (page routes). Each page provides its own toolbar:
- `[username]/page.tsx` → `ArticleToolbarView` (wrapped in `ArticleWorkspaceProvider`)
- `[username]/[slug]/page.tsx` → `ArticleDetailToolbarView`

The layout pattern: page.tsx wraps its content in the workspace provider and passes both toolbar and content through the layout's slot mechanism.

**Slot approach:** Use a React context to pass the toolbar from child pages up to the layout shell. This avoids Next.js parallel routes complexity while keeping the layout generic.

Alternative: Pass toolbar as a prop through the layout. Since Next.js layouts receive `children`, we need a mechanism. Options:
1. **Toolbar context** — child page renders a `<WorkspaceToolbar>` component that portals/registers its content
2. **Compound component** — page wraps content in `<WorkspaceLayout toolbar={...}>content</WorkspaceLayout>`
3. **Direct in ProfileShell** — ProfileShell renders the workspace provider internally and conditionally shows toolbar based on route

The simplest approach for now: **ProfileShell accepts an optional `toolbar` prop** and page components pass it through a wrapper. Since the layout already receives `isOwner` and `children`, we can restructure so page.tsx provides both toolbar and content.

Actually, the cleanest Next.js approach: use the existing layout/page boundary. The **layout** renders the fixed zones (navbar + toolbar slot) and the scrollable wrapper. Pages provide their content. For the toolbar, we use a **context-based slot**: child mounts a toolbar via context, layout reads it.

### Files

| # | File | Status | Agent |
|---|------|--------|-------|
| 1 | `apps/mirror/app/[username]/_components/profile-shell.tsx` | modified | A |
| 2 | `apps/mirror/app/[username]/page.tsx` | modified | B |
| 3 | `apps/mirror/app/[username]/[slug]/page.tsx` | modified | B |

### Agent A — Restructure ProfileShell

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`

**Task:**

Modify `apps/mirror/app/[username]/_components/profile-shell.tsx`.

Read these files first:
- Current `profile-shell.tsx`
- `apps/mirror/components/workspace-navbar.tsx` (new from Phase 2)
- `apps/mirror/features/articles/context/article-workspace-context.tsx` (from Phase 1)

Changes to the desktop layout (right `ResizablePanel`):

1. Import `WorkspaceNavbar` from `@/components/workspace-navbar`

2. Replace `ProfileHeader` in the right panel with the three-zone structure:
   ```tsx
   <ResizablePanel defaultSize={50} minSize={40} maxSize={80}>
     <div className="relative h-full min-w-0 flex flex-col">
       {/* Zone 1: Workspace Navbar (fixed) */}
       <WorkspaceNavbar />

       {/* Zone 2: Workspace Toolbar (fixed) — provided by page via children */}
       {/* Zone 3: Workspace Content (scrolls) — provided by page via children */}
       <div className="flex-1 min-h-0 *:h-full">
         <ViewTransition name="profile-content">
           <div className="overflow-y-auto h-full px-4 pb-[64px]">
             {children}
           </div>
         </ViewTransition>
       </div>
     </div>
   </ResizablePanel>
   ```

3. **Important decision — toolbar slot mechanism:**

   For this phase, use the simplest approach: each page renders its toolbar ABOVE its content, but we restructure the scroll container so the toolbar is OUTSIDE it.

   Change the right panel structure to accept `toolbar` as a separate prop:
   ```tsx
   type ProfileShellProps = {
     profile: Profile;
     isOwner: boolean;
     toolbar?: React.ReactNode;
     children: React.ReactNode;
   };
   ```

   Desktop right panel becomes:
   ```tsx
   <div className="relative h-full min-w-0 flex flex-col">
     <WorkspaceNavbar />
     {toolbar && <div className="shrink-0">{toolbar}</div>}
     <div className="flex-1 min-h-0">
       <ViewTransition name="profile-content">
         <div className="overflow-y-auto h-full px-4 pb-[64px]">
           {children}
         </div>
       </ViewTransition>
     </div>
   </div>
   ```

4. Remove `ProfileHeader` import and usage from the right panel (it's replaced by `WorkspaceNavbar`)

5. Remove `isArticleDetail` detection (`useNavDirection` hook) — no longer needed since each page provides its own toolbar

6. Update mobile layout similarly:
   - Replace `ProfileHeader` with `WorkspaceNavbar`
   - Add toolbar slot above the mobile scroll content

7. Delete `apps/mirror/app/[username]/_components/profile-header.tsx` if it is no longer imported anywhere. If the mobile layout still uses it, keep it for now and note it as cleanup.

8. Remove `useNavDirection` import if no longer used.

### Agent B — Update Page Components

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`
- **Sequential:** Runs after Agent A completes

**Task:**

Modify page components to provide toolbar through the new layout prop mechanism.

Read these files first:
- Updated `profile-shell.tsx` (from Agent A)
- `apps/mirror/app/[username]/page.tsx`
- `apps/mirror/app/[username]/[slug]/page.tsx`
- `apps/mirror/app/[username]/layout.tsx`

**Challenge:** Next.js layouts receive only `children`. The `toolbar` prop needs to flow from page → layout → ProfileShell. Options:

**Option 1 — Layout reads toolbar from context:** Page mounts a context value, layout reads it. Requires a `WorkspaceToolbarProvider`.

**Option 2 — Page renders both toolbar and content as children:** The page renders toolbar + content together as children. ProfileShell uses a convention (e.g., a wrapper component) to extract the toolbar from children.

**Option 3 — Restructure to use Next.js parallel routes:** Add `@toolbar` slot in the layout.

**Recommended: Option 1 — Context-based toolbar slot.**

Create a small toolbar slot context:

In `apps/mirror/components/workspace-toolbar-slot.tsx`:
```tsx
"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

type ToolbarSlotContextValue = {
  toolbar: React.ReactNode;
  setToolbar: (node: React.ReactNode) => void;
};

const ToolbarSlotContext = createContext<ToolbarSlotContextValue | null>(null);

export function ToolbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [toolbar, setToolbar] = useState<React.ReactNode>(null);
  return (
    <ToolbarSlotContext.Provider value={{ toolbar, setToolbar }}>
      {children}
    </ToolbarSlotContext.Provider>
  );
}

export function useToolbarSlot() {
  const ctx = useContext(ToolbarSlotContext);
  if (!ctx) throw new Error("useToolbarSlot must be used within ToolbarSlotProvider");
  return ctx.toolbar;
}

export function WorkspaceToolbar({ children }: { children: React.ReactNode }) {
  const ctx = useContext(ToolbarSlotContext);
  if (!ctx) throw new Error("WorkspaceToolbar must be used within ToolbarSlotProvider");
  useEffect(() => {
    ctx.setToolbar(children);
    return () => ctx.setToolbar(null);
  }, [children, ctx]);
  return null;
}
```

Then update pages:

**File 1: `apps/mirror/app/[username]/page.tsx`**
```tsx
import { ScrollableArticleList, ArticleWorkspaceProvider, ArticleToolbarView, MOCK_ARTICLES } from "@/features/articles";
import { isAuthenticated } from "@/lib/auth-server";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const isOwner = await isAuthenticated();
  const articles = isOwner ? MOCK_ARTICLES : MOCK_ARTICLES.filter((a) => a.status === "published");

  return (
    <ArticleWorkspaceProvider articles={articles} username={username}>
      <WorkspaceToolbar><ArticleToolbarView /></WorkspaceToolbar>
      <ScrollableArticleList />
    </ArticleWorkspaceProvider>
  );
}
```

**File 2: `apps/mirror/app/[username]/[slug]/page.tsx`**
```tsx
import { notFound } from "next/navigation";
import { ArticleDetailView, ArticleDetailToolbarView, findArticleBySlug } from "@/features/articles";
import { isAuthenticated } from "@/lib/auth-server";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default async function ArticlePage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const article = findArticleBySlug(slug);
  if (!article) notFound();
  if (article.status === "draft" && !(await isAuthenticated())) notFound();

  return (
    <>
      <WorkspaceToolbar><ArticleDetailToolbarView username={username} /></WorkspaceToolbar>
      <ArticleDetailView article={article} />
    </>
  );
}
```

**File 3: Update `profile-shell.tsx`** to use toolbar slot context:
- Wrap children in `ToolbarSlotProvider`
- Use `useToolbarSlot()` to read the toolbar
- Render toolbar in the fixed zone

**File 4: Update `apps/mirror/app/[username]/layout.tsx`** if needed to pass toolbar through.

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- Right panel has three distinct zones: navbar (fixed), toolbar (fixed), content (scrolls)
- `ArticleToolbar` renders in the fixed zone, NOT inside the scroll container
- `ArticleDetailToolbarView` renders in the fixed zone on detail pages
- `WorkspaceNavbar` is route-independent (no content-type logic)
- `WorkspaceToolbar` context slot correctly mounts/unmounts on route changes
- Mobile layout also has the toolbar outside the scroll container
- `ProfileHeader` is deleted or planned for deletion
- `useNavDirection` hook is removed if no longer used
- `ViewTransition` still wraps the scrollable content correctly
- `ScrollRootProvider` still wraps the correct scroll container on mobile

### Quality Gate

```bash
pnpm build --filter=@feel-good/mirror
```

### Checkpoint

> **All 3 phases complete.** Workspace layout matches the architecture diagram for articles. Toolbar is fixed, navbar is separated, and the slot pattern supports future content types. Verify visually in dev.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State sharing mechanism | Context provider (`ArticleWorkspaceProvider`) | Cleanest way to share hook state across DOM-separated toolbar + content |
| Toolbar slot mechanism | Context-based slot (`WorkspaceToolbar` component) | Avoids Next.js parallel routes complexity; pages declaratively register their toolbar |
| Navbar extraction | Separate `WorkspaceNavbar` component at `components/` level | Global control, not feature-specific — app-level per code promotion ladder |
| Existing `ArticleToolbar` | Unchanged — wrapped by `ArticleToolbarView` | Preserves working component, new view is a thin context-consuming adapter |
| `ProfileHeader` | Deleted (replaced by `WorkspaceNavbar` + toolbar views) | Its responsibilities split cleanly into the two zones |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Context re-renders — large context value triggers unnecessary renders | Medium | Memoize context value; consider splitting into toolbar + list contexts if perf issues arise |
| Toolbar slot effect timing — toolbar flickers on route change | Low | `ViewTransition` should handle this; test with nav between list and detail |
| Mobile layout breakage | Medium | Validate mobile separately; the mobile layout has different scroll mechanics (drawer) |
| `ScrollRootProvider` ordering — provider must wrap content correctly | Low | Validate scroll root is still accessible inside `ArticleWorkspaceProvider` |

---

## Future Extensions

This refactor enables:

1. **New content type modules** — `features/videos/` can provide its own `VideoWorkspaceProvider` + `VideoToolbarView` + `VideoListView`, slotting into the same layout
2. **Content type tabs in navbar** — `WorkspaceNavbar` gains tab navigation; switching tabs swaps the provider + toolbar + content
3. **Agent interaction space** — Left panel can evolve independently; agent tools can interact with workspace state via the same context providers
4. **Collapsible toolbar** — Since the toolbar is in its own DOM zone, it can be collapsed/expanded without affecting scroll position

---

## Agent Budget

| Phase | Agents | Parallel? | Model |
|-------|--------|-----------|-------|
| 1 | 2 exec + 1 validator | A → B | sonnet |
| 2 | 1 exec + 1 validator | A | sonnet |
| 3 | 2 exec + 1 validator | A → B | sonnet |

**Total executor agents:** 5
**Total validator agents:** 3
**Total agents:** 8
