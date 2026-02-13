# Mirror App Layout Architecture

Reference architecture for the Mirror app's two-space layout system.

## Space Definitions

The app is divided into two primary spaces separated by a resizable handle.

### Agent Interaction Space (left panel)

- Blue zone in `docs/architecture/mirror-app-layout.png`
- Users interact with agents: digital clone of the profile owner (for readers) or a helper agent (for profile owners)
- Interaction modes (future): text chat, video calling, voice calling
- Agent has tool access to the workspace — anything a user can do through UI, the agent can achieve through tools, with real-time visibility

### Content Management Workspace (right panel)

- Warm zone in `docs/architecture/mirror-app-layout.png`
- Three sub-zones stacked vertically:

| Sub-zone | Color | Scrolls? | Purpose |
|----------|-------|----------|---------|
| **Workspace Navbar** | Yellow | No (fixed) | Global controls, content type navigation (articles, video, sns in future) |
| **Workspace Toolbar** | Orange | No (fixed) | Context-dependent controls that change per content type and view |
| **Workspace Content** | Brown | Yes | Scrollable content area (list views, detail views, editors) |

### Workspace Toolbar behavior

The toolbar changes based on **which content type is active** and **which view within that content type**:

| Content Type | View | Toolbar Controls |
|---|---|---|
| Articles | List | Sort, filter, search, selection count, delete, "New" button |
| Articles | Detail | Back button, (future: edit, share) |
| Video (future) | List | Different sort/filter controls |
| Video (future) | Detail | Different contextual controls |

### Resizable Handle

The divider between the two spaces is user-draggable. Both panels have min/max size constraints.

---

## Current Implementation Mapping

### What maps correctly

| Diagram Zone | Current Component | File |
|---|---|---|
| Two-panel split | `ResizablePanelGroup` | `app/[username]/_components/profile-shell.tsx` |
| Resizable handle | `ResizableHandle` | `app/[username]/_components/profile-shell.tsx` |
| Left panel container | Left `ResizablePanel` | `profile-shell.tsx:72-76` |
| Right panel fixed header | `ProfileHeader` outside scroll | `profile-shell.tsx:82-84` |
| Right panel scroll area | `overflow-y-auto` div wrapping `{children}` | `profile-shell.tsx:86-91` |
| Feature isolation | `features/articles/`, `features/profile/` | Separate feature modules with index exports |
| Owner context | `ProfileProvider` / `useIsProfileOwner()` | `features/profile/context/profile-context.tsx` |

### Current right panel DOM tree

```
ResizablePanel (right)
  div.flex.flex-col
    ProfileHeader              ← fixed (outside scroll container)
    div.flex-1.min-h-0
      ViewTransition
        div.overflow-y-auto    ← scrolls
          {children}           ← page.tsx content
```

### Gaps

#### Gap 1: ArticleToolbar is inside the scroll container

`ArticleToolbar` is rendered by `ScrollableArticleList` which is `{children}` inside the scroll div. The toolbar scrolls away instead of staying fixed.

**Current tree:**
```
overflow-y-auto (scrolls)
  └── ScrollableArticleList        ← owns all hooks
      ├── ArticleToolbar           ← scrolls away
      └── ArticleListView
```

**Target tree:**
```
fixed zone
  ├── WorkspaceNavbar
  └── WorkspaceToolbar             ← ArticleToolbar rendered here
overflow-y-auto (scrolls)
  └── ArticleListView              ← only the list scrolls
```

#### Gap 2: No navbar/toolbar separation

`ProfileHeader` is the only fixed element and serves both roles:
- Theme toggle = navbar-level (global)
- Back button on article detail = toolbar-level (contextual)

There is no concept of workspace navbar vs workspace toolbar as separate components or layout slots.

**What belongs where:**

| Control | Zone | Exists? | Changes per content type? |
|---|---|---|---|
| Theme toggle | Navbar | Yes | No |
| Content type tabs (articles/video/sns) | Navbar | Future | No |
| User avatar / settings | Navbar | Future | No |
| Back button (article detail) | Toolbar | Yes | Yes |
| Sort / Filter / Search | Toolbar | Yes | Yes |
| Selection count + Delete | Toolbar | Yes | Yes |
| "New" button | Toolbar | Yes | Yes |

---

## Data Flow Analysis

### Article state pipeline

```
articles (server prop)
  → useArticleSearch(articles)        → filteredArticles
  → filterArticles(filtered, state)   → filteredByFilter
  → useArticleList(filtered, sort)    → paginatedArticles, hasMore, loadMore
  → useArticleSelection(slugs)        → selection state
```

### Hook dependency map

| Hook | Input | Dependency | Liftable? |
|---|---|---|---|
| `useArticleSort` | none | Pure `useState` | Trivially |
| `useArticleFilter` | none | `useLocalStorage` | Trivially |
| `useArticleSearch` | `articles` array | Needs server data | Needs articles prop |
| `useArticleList` | filtered + sort | Chain output | Depends on pipeline |
| `useArticleSelection` | `allSlugs` | Derived from pipeline | Depends on pipeline |

### Shared state between toolbar and content

Both `ArticleToolbar` and `ArticleListView` consume from the same hook instances inside `ScrollableArticleList`:

**Toolbar consumes:** `isOwner`, `selection.count`, `handleDelete`, `sortOrder`, `handleSortChange`, `search.*`, `uniqueCategories`, `filter.*`

**List consumes:** `paginatedArticles`, `hasMore`, `loadMore`, `scrollRoot`, `username`, `isOwner`, `selection.isSelected`, `selection.onToggle`, `selection.toggleAll`, `shouldAnimate`

To render them in different DOM positions, shared state must live in a common ancestor above both.

---

## Design Options for Toolbar Separation

### Option A: Context provider wraps both zones

```
ArticleWorkspaceProvider         ← calls all hooks, exposes via context
├── ArticleToolbar               ← fixed zone (reads from context)
└── scroll container
    └── ArticleListView          ← scroll zone (reads from context)
```

- Hooks move from `ScrollableArticleList` into the provider
- Provider receives `articles` + `username` as props
- Both toolbar and list consume from context
- Extends naturally to other content types (each has own provider)

### Option B: Render-prop / slot pattern

```
useArticleWorkspace({ articles, username })
  returns { toolbar: <ArticleToolbar .../>, content: <ArticleListView .../> }
```

- Parent layout destructures and places in DOM slots
- Hook ownership stays centralized
- No context overhead
- Component becomes a headless state container

### Option C: Layout accepts toolbar + content slots

```
WorkspaceLayout
  navbar={<WorkspaceNavbar />}
  toolbar={<slot from feature>}
  content={<slot from feature>}
```

- Layout is generic, features inject their toolbar + content
- Can use React context slots, Next.js parallel routes, or render props
- Most flexible for future content types

### Recommended approach

**Option A (context provider)** for the article workspace state, composed with **Option C (slot-based layout)** for the workspace shell. This gives:
- Clean state sharing via context within a content type
- Generic layout that accepts any content type's toolbar + content
- Natural extension point for video/sns features
