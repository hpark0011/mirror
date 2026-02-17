---
title: "feat: Add Tiptap Rich Text Article Viewer"
type: feat
date: 2026-02-13
---

# feat: Add Tiptap Rich Text Article Viewer

## Overview

Refactor the article detail page to support rich text content using the Tiptap library. This is **Phase 1** (viewer only) — the editor will follow in a later phase. The work involves three parts:

1. Create a shared `editor` feature in `@feel-good/features` for cross-app rich text rendering
2. Convert mock article data from plain strings to Tiptap `JSONContent`
3. Refactor `ArticleDetailView` to render rich text via Tiptap's read-only mode

## Problem Statement

Articles currently store body content as plain strings with `\n\n` paragraph separators. The `ArticleDetailView` splits on `\n\n` and renders `<p>` tags. This prevents rich content like headings, bold/italic text, links, code blocks, blockquotes, lists, and images — all standard for a modern blogging platform.

## Technical Approach

### Rendering Strategy: `useEditor` with `editable: false`

**Chosen over** `generateHTML()` (server-side HTML string) and `@tiptap/static-renderer` (React elements).

**Rationale:**
- Same rendering engine will be reused when the editor is built in Phase 2
- Guarantees visual consistency between editing and viewing
- `immediatelyRender: false` handles Next.js SSR without hydration issues
- Custom NodeViews (e.g., optimized images) can be added incrementally

**Trade-off:** Requires `"use client"` on the viewer component. Article metadata (title, date, category) remains server-rendered in the parent — only the body viewer is a client component.

### Package Architecture

The editor feature lives inside `@feel-good/features` following the existing pattern (auth, dock, theme):

```
packages/features/editor/
  components/
    rich-text-viewer.tsx     # Tiptap viewer (useEditor, editable: false)
    index.ts
  lib/
    extensions.ts            # Shared extension config (StarterKit + Image + Link)
    get-plain-text.ts        # Extract plain text from JSONContent (for search)
    index.ts
  styles/
    tiptap-content.css       # Prose styling with design token overrides
  types.ts                   # Re-export JSONContent, content types
  index.ts                   # Public barrel export
```

### Tiptap Extensions (Phase 1)

| Extension | Package | Purpose |
|-----------|---------|---------|
| StarterKit | `@tiptap/starter-kit` | Paragraph, Heading (h2-h4), Bold, Italic, Strike, Code, CodeBlock, Blockquote, BulletList, OrderedList, ListItem, HorizontalRule, HardBreak |
| Image | `@tiptap/extension-image` | Block images with src, alt, title |
| Link | `@tiptap/extension-link` | Inline hyperlinks with target/rel |

**Not included in Phase 1:** Syntax highlighting (`code-block-lowlight`), Underline, Table, TaskList, Highlight. These can be added as extensions later without changing the architecture.

**Heading levels:** Configured to `[2, 3, 4]` only — the article title is `<h1>`, so body headings start at `<h2>` to maintain proper heading hierarchy for accessibility and SEO.

### Styling Strategy

1. Install `@tailwindcss/typography` and add `@plugin "@tailwindcss/typography"` to `globals.css`
2. Create `tiptap-content.css` that overrides `--tw-prose-*` CSS variables with `@feel-good/ui` design tokens
3. Apply `prose` + `tiptap-content` classes to the viewer wrapper
4. Import the stylesheet in `globals.css`

**Why CSS variable overrides instead of Tailwind modifiers:** The override list for 10+ prose elements gets unwieldy as class modifiers. CSS variables keep the JSX clean and centralize styling in one file.

**Styling file organization** (`tiptap-content.css` sections):
```
— Token mapping (--tw-prose-body, --tw-prose-headings, etc.)
— Typography overrides (heading sizes, paragraph spacing)
— Block elements (blockquote, code blocks, horizontal rules)
— Inline elements (links, inline code, bold, italic)
— Lists (bullet, ordered, nested)
— Media (images, figures)
```

### Search Fix

The current `useArticleSearch` hook calls `article.body.toLowerCase()` on line 39 of `use-article-search.ts`. When `body` changes from `string` to `JSONContent`, this breaks completely.

**Solution:** Add a `getPlainText(content: JSONContent): string` utility in `packages/features/editor/lib/` that recursively extracts text nodes from the JSON tree. Update `useArticleSearch` to use this utility. Pre-compute plain text per article with `useMemo` to avoid repeated extraction on each keystroke.

---

## Implementation Phases

### Phase 1: Package Setup & Dependencies

**Install Tiptap packages** in `@feel-good/features`:

```bash
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link --filter=@feel-good/features
```

**Install typography plugin** in mirror app:

```bash
pnpm add @tailwindcss/typography --filter=@feel-good/mirror
```

**Update `packages/features/package.json` exports:**

```json
"./editor": "./editor/index.ts",
"./editor/components": "./editor/components/index.ts",
"./editor/lib": "./editor/lib/index.ts",
"./editor/types": "./editor/types.ts"
```

**Files created/modified:**
- `packages/features/package.json` — add exports + dependencies
- `packages/features/editor/index.ts` — barrel export
- `packages/features/editor/types.ts` — re-export `JSONContent` from `@tiptap/core`

### Phase 2: Shared Extension Configuration

Create the extension config that will be shared between the viewer (Phase 1) and editor (future Phase 2):

**File: `packages/features/editor/lib/extensions.ts`**
```typescript
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import type { Extensions } from "@tiptap/core";

export function createArticleExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    Image.configure({
      inline: false,
      HTMLAttributes: {
        loading: "lazy",
      },
    }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  ];
}
```

**Why a factory function** (not module-level constant): Following the provider separation-of-concerns pattern documented in `docs/solutions/`. Extensions are instantiated per-use, avoiding shared mutable state.

**File: `packages/features/editor/lib/get-plain-text.ts`**
```typescript
import type { JSONContent } from "@tiptap/core";

export function getPlainText(content: JSONContent): string {
  // Recursively extract text nodes from JSONContent tree
}
```

### Phase 3: Rich Text Viewer Component

**File: `packages/features/editor/components/rich-text-viewer.tsx`**

```typescript
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { createArticleExtensions } from "../lib/extensions";

interface RichTextViewerProps {
  content: JSONContent;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps) {
  const editor = useEditor({
    extensions: createArticleExtensions(),
    content,
    editable: false,
    immediatelyRender: false, // Required for Next.js SSR
  });

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className={cn("tiptap-content prose dark:prose-invert max-w-none", className)}
    />
  );
}
```

### Phase 4: Tiptap Content Styling

**File: `packages/features/editor/styles/tiptap-content.css`**

Maps `@tailwindcss/typography` prose CSS variables to `@feel-good/ui` design tokens. Sections:

1. **Token mapping:** `--tw-prose-body: var(--foreground)`, `--tw-prose-headings: var(--foreground)`, `--tw-prose-links: var(--information)`, `--tw-prose-code: var(--foreground)`, `--tw-prose-pre-bg: var(--accent)`, `--tw-prose-hr: var(--border)`, `--tw-prose-quotes: var(--muted-foreground)`, `--tw-prose-quote-borders: var(--border)`, etc.
2. **Typography overrides:** Match the current article feel — `font-weight: 480`, base size and line-height adjustments if needed.
3. **Element-specific tweaks:** Code block `overflow-x: auto` for horizontal scroll on mobile, image `max-w-full h-auto rounded-lg`, blockquote border style.

**Update `apps/mirror/styles/globals.css`:**

```css
@plugin "@tailwindcss/typography";
@import "@feel-good/features/editor/styles/tiptap-content.css";
```

**Also add `@source` for the editor package** (already covered by existing `@source "../node_modules/@feel-good/features"` directive on line 25 of globals.css — no change needed).

### Phase 5: Mock Data Conversion

**File: `apps/mirror/features/articles/lib/mock-articles.ts`**

1. Change `Article` type: `body: string` → `body: JSONContent` (imported from `@feel-good/features/editor/types`)
2. Convert **all 28 mock articles** to Tiptap `JSONContent` format
3. Add rich content variety across articles:

| Article (by index) | Rich content demonstrated |
|---|---|
| 1 ("The Art of Listening Deeply") | Headings (h2, h3), bold, italic, blockquote, image |
| 2 ("Why Constraints Fuel Creativity") | Ordered list, code block, link, horizontal rule |
| 3 ("Morning Silence as Practice") | Bullet list, blockquote with attribution, image |
| 4 ("The Producer as Mirror") | Bold + italic mixed, nested list, h2 sections |
| 5+ | Standard paragraphs with occasional bold/italic/links |

**Image sources:** Use `https://images.unsplash.com/` URLs with specific photo IDs. These are freely accessible and don't require API keys.

**Update `apps/mirror/next.config.ts`** — add `images.remotePatterns`:

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
  ],
},
```

### Phase 6: Refactor ArticleDetailView

**File: `apps/mirror/features/articles/views/article-detail-view.tsx`**

Replace the `\n\n` split rendering with `RichTextViewer`:

```typescript
import { RichTextViewer } from "@feel-good/features/editor/components";

export function ArticleDetailView({ article }: ArticleDetailViewProps) {
  return (
    <div className="py-22 px-4 bg-background min-h-[calc(100vh-40px)]">
      <article className="max-w-xl mx-auto">
        {/* Header metadata stays the same (server-renderable) */}
        <div className="mb-[56px]">
          {/* date, category, title — unchanged */}
        </div>

        {/* Body: now uses RichTextViewer */}
        <RichTextViewer content={article.body} />
      </article>
    </div>
  );
}
```

**Note:** `ArticleDetailView` itself must add `"use client"` since it now imports a client component (`RichTextViewer`). Alternatively, the header metadata section could be extracted to a server component, but for Phase 1 this is unnecessary complexity — the page is already rendered from a server component parent that passes the `article` prop.

### Phase 7: Fix Article Search

**File: `apps/mirror/features/articles/hooks/use-article-search.ts`**

Update the search to work with `JSONContent`:

```typescript
import { getPlainText } from "@feel-good/features/editor/lib";

// In the filter logic, replace:
//   const bodyLower = article.body.toLowerCase();
// With:
//   const bodyLower = getPlainText(article.body).toLowerCase();
```

**Performance consideration:** `getPlainText()` is called inside a `useMemo` that only recomputes when `debouncedQuery` or `articles` change. Since `articles` is a stable reference from mock data, this only recomputes on query changes. For 28 articles, the overhead is negligible. For larger datasets, pre-compute plain text once and cache it.

### Phase 8: Update Exports & Verify Build

1. Update `apps/mirror/features/articles/index.ts` — the `Article` type export stays the same (re-exported from `mock-articles.ts`)
2. Run `pnpm build --filter=@feel-good/mirror` to verify everything compiles
3. Run `pnpm lint --filter=@feel-good/mirror` to catch any issues
4. Manual visual check: `pnpm dev --filter=@feel-good/mirror` and navigate to article detail pages

---

## File Manifest

### New files

| File | Purpose |
|------|---------|
| `packages/features/editor/index.ts` | Barrel export for editor package |
| `packages/features/editor/types.ts` | Re-export `JSONContent` type |
| `packages/features/editor/components/index.ts` | Component exports |
| `packages/features/editor/components/rich-text-viewer.tsx` | Tiptap viewer (`useEditor`, `editable: false`) |
| `packages/features/editor/lib/index.ts` | Lib exports |
| `packages/features/editor/lib/extensions.ts` | `createArticleExtensions()` factory |
| `packages/features/editor/lib/get-plain-text.ts` | Extract text from JSONContent |
| `packages/features/editor/styles/tiptap-content.css` | Prose styling with design token overrides |

### Modified files

| File | Change |
|------|--------|
| `packages/features/package.json` | Add Tiptap dependencies + editor export paths |
| `apps/mirror/package.json` | Add `@tailwindcss/typography` devDependency |
| `apps/mirror/styles/globals.css` | Add `@plugin` + import tiptap styles |
| `apps/mirror/next.config.ts` | Add `images.remotePatterns` for Unsplash |
| `apps/mirror/features/articles/lib/mock-articles.ts` | Type change + JSONContent bodies |
| `apps/mirror/features/articles/views/article-detail-view.tsx` | Use `RichTextViewer` |
| `apps/mirror/features/articles/hooks/use-article-search.ts` | Use `getPlainText()` for body search |

---

## Styling Documentation

### How Tiptap Content Styles Are Organized

The styling follows a **three-layer approach** documented here for ongoing reference:

**Layer 1: `@tailwindcss/typography` baseline (`prose` class)**
- Provides sensible defaults for spacing, line heights, element relationships
- Applied via `prose dark:prose-invert max-w-none` on the viewer wrapper

**Layer 2: Design token mapping (`tiptap-content.css`)**
- Overrides `--tw-prose-*` CSS variables with `@feel-good/ui` tokens
- Ensures colors adapt automatically to light/dark mode via existing `:root` / `.dark` token switching
- Single file, organized by sections: tokens → typography → blocks → inline → lists → media

**Layer 3: Extension-level HTMLAttributes**
- Structural attributes set per-extension in `extensions.ts` (e.g., `loading="lazy"` on images)
- Reserved for attributes that are inherent to the element, not visual theme

**When adding new element styles:**
1. Check if `@tailwindcss/typography` already handles it (usually yes for standard HTML elements)
2. If the default colors don't match, add a `--tw-prose-*` variable override in `tiptap-content.css`
3. If the element needs structural modifications beyond color, add Tailwind `@apply` rules in the appropriate section of `tiptap-content.css`
4. If the extension needs HTML attributes (accessibility, performance), configure in `extensions.ts`

---

## Edge Cases & Mitigations

| Scenario | Handling |
|----------|----------|
| Empty JSONContent (`{ type: "doc", content: [] }`) | Tiptap renders an empty editor div — acceptable for Phase 1 |
| Malformed JSONContent | Tiptap silently skips unknown nodes — no crash, graceful degradation |
| Image loading failure | Browser shows broken image icon — acceptable for mock data; custom error handling deferred |
| Code block horizontal overflow (mobile) | `overflow-x: auto` in `tiptap-content.css` enables horizontal scroll |
| Dark mode | Automatic via `--tw-prose-*` variable overrides mapped to design tokens |
| View transition flash | `useEditor` mounts asynchronously; content appears after JS hydration. The 300ms transition should cover this. If visible, a skeleton loader can be added later |
| Links in read-only mode | Configured with `openOnClick: true` so clicks navigate normally |

---

## Acceptance Criteria

### Functional

- [x] Article detail page renders rich text content (headings, bold, italic, links, code blocks, blockquotes, bullet/ordered lists, images, horizontal rules)
- [x] All 28 mock articles have JSONContent bodies
- [x] At least 4 articles demonstrate diverse rich content (images, code blocks, lists, blockquotes)
- [x] Article search still works correctly with JSONContent bodies
- [x] Links open in new tab with `rel="noopener noreferrer"`
- [x] Images from Unsplash load correctly

### Visual / Styling

- [x] Rich text styling uses design system tokens (foreground, muted-foreground, border, accent colors)
- [x] Dark mode renders correctly for all prose elements
- [x] Code blocks have horizontal scroll on mobile (no layout overflow)
- [x] Images are responsive (`max-w-full`, `h-auto`)
- [x] Heading hierarchy: article title is `<h1>`, body headings start at `<h2>`

### Architecture

- [x] Editor package exists at `packages/features/editor/` with proper barrel exports
- [x] `@feel-good/features` package.json has Tiptap dependencies and editor export paths
- [x] Extension config is in a single shared factory function (`createArticleExtensions`)
- [x] `tiptap-content.css` is organized by sections with comments
- [x] `pnpm build --filter=@feel-good/mirror` passes
- [x] `pnpm lint --filter=@feel-good/mirror` passes

---

## Future Considerations (Out of Scope)

- **Phase 2: Editor** — Add `editable: true` mode, toolbar, keyboard shortcuts. The architecture is designed for this: flip `editable` flag, add toolbar component, reuse same extensions and styling.
- **Syntax highlighting** — Add `@tiptap/extension-code-block-lowlight` with a highlight.js theme
- **`next/image` optimization** — Custom NodeView wrapping `<Image>` for optimized loading
- **Copy-to-clipboard** for code blocks
- **Cover image rendering** in article detail
- **Real data persistence** — Replace mock data with Convex storage of JSONContent

## References

- [Tiptap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Tiptap Styling Guide](https://tiptap.dev/docs/editor/getting-started/style-editor)
- [Tiptap Image Extension](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Tiptap Link Extension](https://tiptap.dev/docs/editor/extensions/marks/link)
- [Tailwind Typography Plugin](https://github.com/tailwindlabs/tailwindcss-typography)
- Existing patterns: `packages/features/auth/` (layered feature architecture), `packages/features/dock/` (component + hook separation)
- Institutional learnings: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`, `docs/solutions/tailwind/monorepo-source-configuration.md`
