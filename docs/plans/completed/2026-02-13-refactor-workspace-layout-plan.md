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
| **New files** | 5 |
| **Modified files** | 6 |
| **Deleted files** | 1 (ProfileHeader) |
| **Quality gate** | `pnpm build --filter=@feel-good/mirror` after every phase |

## Affected Files

### New Files

| # | File | Phase | Purpose |
|---|------|-------|---------|
| 1 | `apps/mirror/features/articles/context/article-workspace-context.tsx` | 1 | Context provider holding all article hooks state |
| 2 | `apps/mirror/features/articles/views/article-toolbar-view.tsx` | 2 | Thin toolbar wrapper consuming from context |
| 3 | `apps/mirror/features/articles/views/article-detail-toolbar-view.tsx` | 2 | Toolbar for article detail page (back button) |
| 4 | `apps/mirror/components/workspace-navbar.tsx` | 2 | Global navbar extracted from ProfileHeader |
| 5 | `apps/mirror/components/workspace-toolbar-slot.tsx` | 3 | Context-based toolbar slot (register toolbar from pages, render in shell) |

### Modified Files

| # | File | Phase | Change |
|---|------|-------|--------|
| 6 | `apps/mirror/features/articles/components/scrollable-article-list.tsx` | 1 | Move hook calls to context, consume from context |
| 7 | `apps/mirror/features/articles/index.ts` | 1 | Export new context provider and toolbar views |
| 8 | `apps/mirror/app/[username]/_components/profile-shell.tsx` | 3 | Restructure right panel with navbar + toolbar slot + content |
| 9 | `apps/mirror/app/[username]/page.tsx` | 3 | Wrap with ArticleWorkspaceProvider, pass toolbar slot |
| 10 | `apps/mirror/app/[username]/[slug]/page.tsx` | 3 | Pass article detail toolbar slot |
| 11 | `apps/mirror/hooks/use-nav-direction.ts` | 3 | Remove `isArticleDetail` return, keep ViewTransition side effect |

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
- `useState(initialArticles)` — local mutable copy of the articles prop (mutated by `handleDelete`)
- `useArticleSearch(articles)` — operates on the mutable `articles` state, not the raw prop
- `useArticleSort()` — no dependencies
- `useArticleFilter()` — no dependencies (reads from localStorage)
- `useArticleSelection(allSlugs)` — depends on derived `allSlugs`
- `useArticleList(filteredByFilter, sortOrder, isFiltered)` — depends on pipeline output
- Derived: `filteredByFilter`, `uniqueCategories`, `shouldAnimate`, `handleSortChange`, `handleDelete`

**What stays in consuming components (not in context):**
- `useScrollRoot()` — layout-level concern from `ScrollRootProvider`, not article workspace state. Each consuming component that needs it calls it directly.
- `ArticleToolbar` reads toolbar-relevant slices from context
- `ArticleListView` reads list-relevant slices from context
- `ScrollableArticleList` becomes a thin wrapper that reads from context

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
     hasNoArticles: boolean;
     showEmpty: boolean;
     emptyMessage: string;
   };
   ```

   **Two distinct empty states:**
   - `hasNoArticles` = the raw `articles` state has length 0 (no articles exist at all — toolbar should NOT render)
   - `showEmpty` = articles exist but `paginatedArticles` is empty due to search/filter (toolbar SHOULD render so user can clear filters)

3. Create context with `createContext<ArticleWorkspaceContextValue | null>(null)`

4. Create `ArticleWorkspaceProvider` component:
   - Props: `{ articles: Article[]; username: string; children: React.ReactNode }`
   - Move ALL hook calls and state from `ScrollableArticleList` into this provider:
     - `const [articles, setArticles] = useState(initialArticles)` — **critical:** local mutable copy. The `articles` prop from page.tsx is immutable server data; `handleDelete` calls `setArticles` to remove deleted articles. `useArticleSearch` operates on this mutable state.
     - `useIsProfileOwner()` from `@/features/profile`
     - `useArticleSearch(articles)` — pass the mutable `articles` state, not the raw prop
     - `useArticleSort()`
     - `useArticleFilter()`
     - The `filteredByFilter` memo
     - `useArticleList(filteredByFilter, sortOrder, isFiltered)`
     - `useArticleSelection(allSlugs)`
     - The `uniqueCategories` memo
     - The `shouldAnimate` state + timer ref + cleanup effect
     - The selection-clear effect (search open + filter change)
     - `handleSortChange` callback
     - `handleDelete` callback — uses `setArticles` to filter out deleted articles
     - The `hasNoArticles`, `showEmpty`, and `emptyMessage` derivations
   - **Do NOT move** `useScrollRoot()` — it's a layout-level concern, not article workspace state. Consuming components call it directly.
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

**Critical:** The `articles` and `username` props come from the server component page.tsx. The provider is a client component boundary. The provider maintains its own mutable copy of `articles` via `useState(initialArticles)` — this is what `handleDelete` mutates.

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
   - Calls `useScrollRoot()` directly (this is a layout concern, not part of the workspace context)
   - Handles two empty states: `hasNoArticles` (zero articles total) and `showEmpty` (filtered to empty)
   - Renders ONLY the content portion (no toolbar):
     ```tsx
     import { useArticleWorkspace } from "../context/article-workspace-context";
     import { useScrollRoot } from "../context/scroll-root-context";
     import { ArticleListView } from "../views/article-list-view";

     export function ScrollableArticleList() {
       const ctx = useArticleWorkspace();
       const scrollRoot = useScrollRoot();

       if (ctx.hasNoArticles) {
         return (
           <div className="flex items-center justify-center py-16 text-muted-foreground">
             No articles yet
           </div>
         );
       }

       if (ctx.showEmpty) {
         return (
           <div className="flex items-center justify-center py-16 text-muted-foreground">
             {ctx.emptyMessage}
           </div>
         );
       }

       return (
         <ArticleListView
           articles={ctx.articles}
           hasMore={ctx.hasMore}
           onLoadMore={ctx.onLoadMore}
           scrollRoot={scrollRoot}
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
- Provider has `const [articles, setArticles] = useState(initialArticles)` — local mutable copy, not just passing through the prop
- `handleDelete` calls `setArticles`, and `useArticleSearch` receives the mutable `articles` state
- `useScrollRoot()` is NOT inside the provider — it's called directly in `ScrollableArticleList`
- No hook calls remain in `ScrollableArticleList` except `useArticleWorkspace()` and `useScrollRoot()`
- `useArticleWorkspace` throws if used outside provider
- Context value is memoized to prevent unnecessary re-renders
- `ScrollableArticleList` no longer renders `ArticleToolbar`
- `ScrollableArticleList` handles both empty states: `hasNoArticles` (no toolbar) and `showEmpty` (toolbar still visible)
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

Extract the global controls from `ProfileHeader` into a standalone navbar. Carry over the gradient overlay from `ProfileHeader` (`bg-linear-to-b from-background via-background/70 to-transparent`) so scrolled content fades under the fixed header area.

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
        "z-10 flex h-10 items-center justify-end gap-2 px-4 bg-linear-to-b from-background via-background/70 to-transparent",
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

Each page provides its own toolbar via a context-based slot mechanism:
- `[username]/page.tsx` → `<WorkspaceToolbar><ArticleToolbarView /></WorkspaceToolbar>` (inside `ArticleWorkspaceProvider`)
- `[username]/[slug]/page.tsx` → `<WorkspaceToolbar><ArticleDetailToolbarView /></WorkspaceToolbar>`

**Slot mechanism:** `ToolbarSlotProvider` wraps the right panel internals in `ProfileShell`. Pages render `<WorkspaceToolbar>` which registers toolbar content via `useLayoutEffect`. A `ToolbarSlotRenderer` helper in ProfileShell reads the toolbar from context and renders it in the fixed zone. This avoids Next.js parallel routes complexity and keeps `layout.tsx` unchanged.

### Files

| # | File | Status | Agent |
|---|------|--------|-------|
| 1 | `apps/mirror/components/workspace-toolbar-slot.tsx` | new | A |
| 2 | `apps/mirror/app/[username]/_components/profile-shell.tsx` | modified | A |
| 3 | `apps/mirror/hooks/use-nav-direction.ts` | modified | A |
| 4 | `apps/mirror/app/[username]/page.tsx` | modified | B |
| 5 | `apps/mirror/app/[username]/[slug]/page.tsx` | modified | B |

### Agent A — Create Toolbar Slot + Restructure ProfileShell

- **Type:** `general-purpose` · **Model:** `sonnet` · **Mode:** `bypassPermissions`

**Task:**

Create `apps/mirror/components/workspace-toolbar-slot.tsx` and modify `apps/mirror/app/[username]/_components/profile-shell.tsx`.

Read these files first:
- Current `profile-shell.tsx`
- `apps/mirror/components/workspace-navbar.tsx` (new from Phase 2)
- `apps/mirror/features/articles/context/article-workspace-context.tsx` (from Phase 1)
- `apps/mirror/features/profile/views/mobile-profile-layout.tsx` (mobile drawer layout)
- `apps/mirror/hooks/use-nav-direction.ts` (nav direction hook to refactor)

**Step 0: Create `apps/mirror/components/workspace-toolbar-slot.tsx`**

This is a context-based slot that lets child pages register a toolbar node, and the layout shell reads it.

**Important implementation detail:** Use `useLayoutEffect` (not `useEffect`) to avoid a one-frame flash where the toolbar zone is empty. Extract `setToolbar` from the context object to get a stable reference — otherwise `[children, ctx]` would cause an infinite re-render loop since both are new references every render.

```tsx
"use client";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

type ToolbarSlotContextValue = {
  toolbar: React.ReactNode;
  setToolbar: (node: React.ReactNode) => void;
};

const ToolbarSlotContext = createContext<ToolbarSlotContextValue | null>(null);

export function ToolbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [toolbar, setToolbar] = useState<React.ReactNode>(null);
  const value = useMemo(() => ({ toolbar, setToolbar }), [toolbar]);
  return (
    <ToolbarSlotContext.Provider value={value}>
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
  const { setToolbar } = ctx;
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useLayoutEffect(() => {
    setToolbar(childrenRef.current);
    return () => setToolbar(null);
  }, [setToolbar]);

  // Also update when children change (re-render with new toolbar content)
  useLayoutEffect(() => {
    setToolbar(children);
  }, [children, setToolbar]);

  return null;
}
```

**Why this pattern:**
- `useMemo` on the provider value prevents unnecessary re-renders of consumers that only read `setToolbar`
- `setToolbar` is a stable reference (from `useState`), so the dependency array is safe
- `useLayoutEffect` runs synchronously after DOM mutations but before paint, preventing the toolbar flash
- `childrenRef` captures children without creating a dependency cycle on mount

---

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

3. **Toolbar slot mechanism — `ToolbarSlotProvider` inside ProfileShell:**

   `ProfileShellProps` does NOT change (no `toolbar` prop needed). Instead, wrap the right panel internals in `ToolbarSlotProvider` and use a small `ToolbarSlotRenderer` component to read and render the toolbar.

   ```tsx
   // Private helper inside profile-shell.tsx
   function ToolbarSlotRenderer() {
     const toolbar = useToolbarSlot();
     if (!toolbar) return null;
     return <div className="shrink-0">{toolbar}</div>;
   }
   ```

   Desktop right panel becomes:
   ```tsx
   <ToolbarSlotProvider>
     <div className="relative h-full min-w-0 flex flex-col">
       <WorkspaceNavbar />
       <ToolbarSlotRenderer />
       <div className="flex-1 min-h-0">
         <ViewTransition name="profile-content">
           <div className="overflow-y-auto h-full px-4 pb-[64px]">
             {children}
           </div>
         </ViewTransition>
       </div>
     </div>
   </ToolbarSlotProvider>
   ```

   This works because both `ToolbarSlotRenderer` (consumer) and `{children}` (which contain `<WorkspaceToolbar>` registrar components from pages) are inside the same `ToolbarSlotProvider`.

   **No changes needed in layout.tsx** — the provider lives entirely in profile-shell.tsx.

4. Remove `ProfileHeader` import and usage from the right panel (it's replaced by `WorkspaceNavbar`)

5. **Refactor `useNavDirection` — keep the ViewTransition side effect, remove `isArticleDetail` return:**

   The `useNavDirection` hook (`hooks/use-nav-direction.ts`) does two things:
   - Returns `isArticleDetail` — no longer needed since each page provides its own toolbar
   - Sets `document.documentElement.dataset.navDirection` to `"forward"` or `"back"` — **this is still needed** for CSS ViewTransition directional animations

   Refactor the hook to only do the side effect (rename to `useNavDirectionEffect` or keep name). Remove the `isArticleDetail` return value. Call the hook in `ProfileShell` purely for its side effect:
   ```tsx
   useNavDirection(); // side effect only — sets data-navDirection for ViewTransition CSS
   ```
   Remove the destructuring `const { isArticleDetail } = useNavDirection()` and replace with a bare call.

6. **Update mobile layout with detailed toolbar slot placement:**

   Current mobile structure in `profile-shell.tsx`:
   ```
   main.h-screen
     ProfileHeader (fixed top-0 inset-x-0)     ← replace with WorkspaceNavbar
     MobileProfileLayout
       DrawerContent
         drag handle
         div.h-[calc(100%-36px)]                ← content area
           ViewTransition
             div.overflow-y-auto (ref=mobileScrollRoot)
               ScrollRootProvider
                 {children}                      ← toolbar is inside here (scrolls)
   ```

   Target mobile structure:
   ```
   main.h-screen
     WorkspaceNavbar (className="fixed top-0 inset-x-0")
     MobileProfileLayout
       DrawerContent
         drag handle
         div.h-[calc(100%-36px)]                ← content area
           {toolbarSlot}                         ← toolbar rendered here (fixed within drawer)
           ViewTransition
             div.overflow-y-auto (ref=mobileScrollRoot)
               ScrollRootProvider
                 {children}                      ← only content scrolls
   ```

   Key details:
   - `WorkspaceNavbar` gets `className="fixed top-0 inset-x-0"` to match mobile `ProfileHeader` positioning
   - The toolbar slot renders inside the drawer content area but ABOVE the scroll container
   - `ScrollRootProvider` still wraps the scroll div (unchanged)
   - `ToolbarSlotProvider` must wrap the entire content tree including both the toolbar render site and the `{children}` that register toolbars

7. Delete `apps/mirror/app/[username]/_components/profile-header.tsx` — it's fully replaced by `WorkspaceNavbar` + toolbar views.

8. Clean up `useNavDirection`:
   - Remove `isArticleDetail` from the return value
   - Remove `isArticleDetailRoute` helper if only used for the return value (keep it if used for the side effect logic, which it is)
   - Update the hook to return `void` or remove the return entirely

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

**Note:** `workspace-toolbar-slot.tsx` is created by Agent A. The `ToolbarSlotProvider` and `ToolbarSlotRenderer` are wired into `profile-shell.tsx` by Agent A. Agent B only updates the page components to register their toolbars via `<WorkspaceToolbar>`.

Read the updated `profile-shell.tsx` and `workspace-toolbar-slot.tsx` from Agent A before making changes.

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

**No changes needed in `layout.tsx`** — the `ToolbarSlotProvider` lives inside `profile-shell.tsx` (Agent A places it there).

### Validator

- **Type:** `Explore` · **Model:** `sonnet`

Check:
- Right panel has three distinct zones: navbar (fixed), toolbar (fixed), content (scrolls)
- `ToolbarSlotProvider` wraps both `ToolbarSlotRenderer` and `{children}` in profile-shell.tsx
- `ArticleToolbar` renders in the fixed zone via `ToolbarSlotRenderer`, NOT inside the scroll container
- `ArticleDetailToolbarView` renders in the fixed zone on detail pages
- `WorkspaceNavbar` is route-independent (no content-type logic)
- `WorkspaceNavbar` carries the gradient overlay (`bg-linear-to-b from-background via-background/70 to-transparent`)
- `WorkspaceToolbar` uses `useLayoutEffect` (not `useEffect`) and has stable dependency references
- `WorkspaceToolbar` context slot correctly mounts/unmounts on route changes without infinite loops
- Mobile layout has toolbar outside the scroll container but inside the drawer content area
- Mobile `WorkspaceNavbar` has `fixed top-0 inset-x-0` positioning (matches old `ProfileHeader` mobile behavior)
- `ScrollRootProvider` still wraps the correct scroll container on mobile
- `ProfileHeader` is deleted
- `useNavDirection` keeps the `data-navDirection` side effect but no longer returns `isArticleDetail`
- `ViewTransition` still wraps the scrollable content correctly

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
| `useNavDirection` | Refactored, not deleted | Keep ViewTransition `data-navDirection` side effect; remove `isArticleDetail` return since pages own their own toolbars |
| `scrollRoot` | Stays outside workspace context | Layout-level concern from `ScrollRootProvider`; consuming components call `useScrollRoot()` directly |
| Local `articles` state | Moved into provider as `useState(initialArticles)` | `handleDelete` mutates this state; `useArticleSearch` operates on it; the server prop is immutable |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Context re-renders — large context value triggers unnecessary renders | Medium | Memoize context value with `useMemo`; consider splitting into toolbar + list contexts if perf issues arise |
| Toolbar slot effect timing — toolbar flickers on route change | Medium | Use `useLayoutEffect` (not `useEffect`) in `WorkspaceToolbar` to register before paint; `ViewTransition` handles cross-route animation |
| Toolbar slot infinite re-render — unstable deps in effect | High if wrong | Extract `setToolbar` from context (stable `useState` setter); use `childrenRef` pattern; do NOT put `ctx` object in dependency array |
| Mobile layout breakage — drawer toolbar placement | Medium | Toolbar must go inside drawer content area but above scroll div; validate with real scroll + drawer snap points |
| `ScrollRootProvider` ordering — provider must wrap content correctly | Low | `useScrollRoot()` stays in consuming component, not in workspace context; no ordering change needed |
| ViewTransition direction loss | Low | `useNavDirection` is refactored (not deleted) — keeps `data-navDirection` side effect, only removes `isArticleDetail` return |

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
