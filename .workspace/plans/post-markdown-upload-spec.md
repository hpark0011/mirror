# Mirror: Markdown File Upload for Posts

## Overview

Users import local `.md` files from the Mirror posts toolbar to create new posts. YAML frontmatter is parsed for metadata (title, slug, category) and the markdown body is converted to JSONContent via tiptap-markdown. Posts are created in Convex with status `"draft"`. This enables writers who author content in external editors (Obsidian, VS Code, iA Writer) to publish into Mirror without a built-in editor.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| FR-01 | Clicking the "New" button in the post list toolbar opens a modal dialog | P0 | Playwright: click `[data-testid="new-post-btn"]`, assert `[role="dialog"]` is visible |
| FR-02 | The dialog contains a file input that accepts only `.md` files | P0 | DOM assertion: `input[type="file"]` has `accept=".md"` attribute |
| FR-03 | Selecting a non-`.md` file shows an inline error and does not proceed | P0 | Unit test: file with `.txt` extension returns error; Playwright: upload `.txt`, assert error visible |
| FR-04 | Files larger than 500 KB are rejected with an inline error | P1 | Unit test: File with `size > 512000` returns error; Playwright: upload oversized file, assert error visible |
| FR-05 | File is read client-side via `FileReader.readAsText` and frontmatter is parsed via `gray-matter` | P0 | Unit test: raw string with YAML frontmatter returns `{ title, slug, category, body }` |
| FR-06 | `title` from frontmatter; fallback to filename without extension | P1 | Unit test: (a) frontmatter title used; (b) no title + filename `my-post.md` -> `"my-post"` |
| FR-07 | `slug` from frontmatter; fallback to slugified filename (lowercase, spaces -> hyphens) | P1 | Unit test: (a) frontmatter slug used; (b) no slug + filename `My Post.md` -> `"my-post"` |
| FR-08 | `category` from frontmatter; fallback to `DEFAULT_POST_CATEGORY` (`"Creativity"`) | P1 | Unit test: no category in frontmatter -> parsed result has `category: "Creativity"` |
| FR-09 | Markdown body (frontmatter stripped) is converted to JSONContent using a headless tiptap Editor with markdown extensions | P0 | Unit test: `"# Hello"` -> JSONContent with heading node containing text `"Hello"` |
| FR-10 | Parsed title, slug, and category are validated against server limits: title <= 500 chars, slug <= 200 chars, category <= 100 chars | P1 | Unit test: title of 501 chars returns validation error |
| FR-11 | Preview section in dialog shows extracted title, slug, and category before confirmation | P1 | Playwright: after selecting valid file, assert title/slug/category appear in preview |
| FR-12 | Clicking "Create" calls `posts.mutations.create` with `{ title, slug, category, body, status: "draft" }` | P0 | Unit test (mock mutation): assert called with correct payload including `status: "draft"` |
| FR-13 | After successful creation, the dialog closes | P0 | Playwright: after clicking "Create", assert `[role="dialog"]` not in DOM |
| FR-14 | Loading state disables the "Create" button while mutation is in flight | P1 | Playwright: assert button has `disabled` attribute during pending state |
| FR-15 | If mutation throws (e.g., slug collision), an inline error message is shown and dialog stays open | P1 | Unit test (mock rejected mutation): error message rendered, dialog mounted |
| FR-16 | File input and all parsed state reset when dialog is closed without submitting | P2 | Playwright: open, select file, close, reopen -> assert no file pre-populated |

### Non-Functional Requirements

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| NFR-01 | `gray-matter` is the only new runtime dependency | P0 | Diff of `package.json` shows only `gray-matter` added |
| NFR-02 | Build passes: `pnpm build --filter=@feel-good/mirror` exits 0 | P0 | CI or manual run |
| NFR-03 | Lint passes: `pnpm lint --filter=@feel-good/mirror` exits 0 | P0 | CI or manual run |
| NFR-04 | All file processing is client-side only; no file bytes sent to server | P0 | Code review: FileReader in `"use client"` component, no fetch with file content |
| NFR-05 | `markdown-to-json-content.ts` is browser-only (uses tiptap `DOMParser` internally) | P0 | File has `"use client"` directive or is only imported from client components |

---

## Architecture

### Data Flow

```
User clicks "New" button
  -> PostToolbarContext.openUploadDialog()
  -> Dialog renders (conditional rendering, unmounts on close for clean state)
  -> User selects .md file
  -> useMarkdownFileParser hook:
      1. Validate extension (.md) and size (<= 500KB)
      2. FileReader.readAsText()
      3. gray-matter -> { title, slug, category, body }
      4. Apply fallbacks (filename for title/slug, DEFAULT_POST_CATEGORY for category)
      5. Validate field lengths (title<=500, slug<=200, category<=100)
      6. Convert body markdown -> JSONContent via headless tiptap Editor
  -> Dialog renders preview (title, slug, category)
  -> User clicks "Create"
  -> useCreatePostFromFile calls useMutation(api.posts.mutations.create)
  -> On success: context closes dialog, Convex reactive query re-renders list
  -> On error: inline error shown in dialog
```

### Markdown -> JSONContent Conversion Strategy

The `tiptap-markdown` package's parse API requires an Editor instance. The `@tiptap/core` `generateJSON()` function calls `window.DOMParser` internally, so it only works in browser context.

**Approach:** Create a short-lived headless `Editor` instance with `createMarkdownExtensions()`, set content from the markdown string, extract `.getJSON()`, then destroy the editor. This runs in the browser (inside a `"use client"` hook) where DOM APIs are available.

```ts
// Simplified approach
const editor = new Editor({
  extensions: createMarkdownExtensions(),
  content: markdownString, // tiptap-markdown handles parsing
});
const json = editor.getJSON();
editor.destroy();
return json;
```

### Files to Create

| File | Purpose |
|------|---------|
| `apps/mirror/features/posts/components/markdown-upload-dialog.tsx` | Pure UI: file input, preview (title/slug/category), error display, Create/Cancel buttons |
| `apps/mirror/features/posts/components/markdown-upload-dialog-connector.tsx` | Reads PostToolbarContext + hooks, passes props to dialog |
| `apps/mirror/features/posts/hooks/use-markdown-file-parser.ts` | FileReader + validation + gray-matter + tiptap conversion; returns `{ parse, result, error, isParsing }` |
| `apps/mirror/features/posts/hooks/use-create-post-from-file.ts` | Wraps `useMutation(api.posts.mutations.create)`; returns `{ create, isPending, error }` |
| `apps/mirror/features/posts/lib/parse-md-frontmatter.ts` | Pure utility: extracts frontmatter + applies fallbacks + validates field lengths |
| `apps/mirror/features/posts/lib/markdown-to-json-content.ts` | Browser-only utility: headless tiptap Editor -> JSONContent. Imports `createMarkdownExtensions` from `@feel-good/features/editor/lib`. |

### Files to Modify

| File | Change |
|------|--------|
| `apps/mirror/features/posts/components/post-list-toolbar.tsx` | Add `data-testid="new-post-btn"`, wire `onClick` to `openUploadDialog()` from context |
| `apps/mirror/features/posts/context/post-toolbar-context.tsx` | Add `isUploadDialogOpen`, `openUploadDialog` (useCallback), `closeUploadDialog` (useCallback) to context |
| `apps/mirror/features/posts/components/post-list-toolbar-connector.tsx` | Mount `<MarkdownUploadDialogConnector />` conditionally when `isUploadDialogOpen` (unmount on close for clean state reset) |

### Dependencies to Add

| Package | Workspace | Justification |
|---------|-----------|---------------|
| `gray-matter` | `apps/mirror` | YAML frontmatter parsing; nothing equivalent exists in the monorepo |

### Key Interfaces

```ts
// lib/parse-md-frontmatter.ts
export interface ParsedMarkdown {
  title: string;
  slug: string;
  category: string; // always populated (falls back to DEFAULT_POST_CATEGORY)
  body: string;     // raw markdown, frontmatter stripped
}

export interface ParseError {
  field: string;
  message: string;
}

// hooks/use-markdown-file-parser.ts
export interface UseMarkdownFileParserReturn {
  parse: (file: File) => Promise<void>;
  result: { metadata: ParsedMarkdown; jsonContent: JSONContent } | null;
  error: string | null;
  isParsing: boolean;
}
```

---

## Unit Tests

All tests use vitest, `test()` (not `it()`), `.test.ts` suffix, `__tests__/` directories.

| Test File | Test Case | Verifies |
|-----------|-----------|----------|
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("extracts title from frontmatter")` | FR-06a |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("falls back to filename when title absent")` | FR-06b |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("extracts slug from frontmatter")` | FR-07a |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("falls back to slugified filename when slug absent")` | FR-07b |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("falls back to DEFAULT_POST_CATEGORY when category absent")` | FR-08 |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("strips frontmatter from body")` | FR-05 |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("rejects title exceeding 500 characters")` | FR-10 |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("rejects slug exceeding 200 characters")` | FR-10 |
| `lib/__tests__/parse-md-frontmatter.test.ts` | `test("rejects category exceeding 100 characters")` | FR-10 |
| `lib/__tests__/markdown-to-json-content.test.ts` | `test("converts heading to heading JSONContent node")` | FR-09 |
| `lib/__tests__/markdown-to-json-content.test.ts` | `test("converts paragraph to paragraph JSONContent node")` | FR-09 |
| `hooks/__tests__/use-markdown-file-parser.test.ts` | `test("rejects non-.md file extension")` | FR-03 |
| `hooks/__tests__/use-markdown-file-parser.test.ts` | `test("rejects file exceeding 500KB")` | FR-04 |
| `hooks/__tests__/use-markdown-file-parser.test.ts` | `test("returns parsed result for valid .md file")` | FR-05 |
| `hooks/__tests__/use-create-post-from-file.test.ts` | `test("calls mutation with status draft")` | FR-12 |
| `hooks/__tests__/use-create-post-from-file.test.ts` | `test("surfaces mutation error")` | FR-15 |

---

## Playwright E2E Tests

All tests in `apps/mirror/e2e/post-upload.spec.ts`.

| Scenario | Verifies |
|----------|----------|
| Opens upload dialog when New button is clicked | FR-01 |
| File input accepts only .md files | FR-02 |
| Shows error when non-.md file is selected | FR-03 |
| Shows error when file exceeds 500KB | FR-04 |
| Shows extracted title, slug, and category in preview | FR-11 |
| Creates a draft post and closes dialog on confirm | FR-12, FR-13 |
| Create button is disabled while mutation is pending | FR-14 |
| Shows inline error and keeps dialog open on mutation failure | FR-15 |
| Resets state when dialog is closed without submitting | FR-16 |

---

## Anti-Patterns to Avoid

| Anti-pattern | Reason |
|---|---|
| Parsing frontmatter inside a React component | Violates separation of concerns; untestable in isolation. All parsing in `lib/parse-md-frontmatter.ts`. |
| Using `generateJSON()` from `@tiptap/core` standalone | Calls `window.DOMParser` via `elementFromString` — fails in non-browser contexts. Use headless `Editor` instance instead. |
| Allowing `category: undefined` to reach the Convex mutation | `category` is `v.string()` (required). Always apply `DEFAULT_POST_CATEGORY` fallback before mutation call. |
| Creating `views/` inside `apps/mirror/features/posts/` | `views/` is only for cross-app packages. App-level components go in `components/`. |
| Storing raw File/Blob in React state or Convex | File bytes needed only during parsing. Store only the resulting JSONContent and metadata. |
| Keeping dialog mounted when closed (hidden via CSS) | Leads to stale state bugs. Conditionally render dialog so it unmounts on close, guaranteeing clean state on reopen. |
| Skipping `FileReader.onerror` handling | FileReader is async and can fail. The hook must handle `onerror` and surface a message. |
| Adding `gray-matter` to shared packages | This is Mirror-specific. Dependency belongs in `apps/mirror`. |
| Using `setTimeout` to fix any timing issues | Find the architectural root cause per project rules. |

---

## Team Orchestration Plan

Small feature (6 files to create, 3 to modify). Single implementation agent, linear order:

1. **Add `gray-matter`** — `pnpm add gray-matter --filter=@feel-good/mirror`. Verify resolves.
2. **`lib/parse-md-frontmatter.ts`** + unit tests — Pure utility, no React. Run vitest.
3. **`lib/markdown-to-json-content.ts`** + unit tests — Browser-only tiptap conversion. Run vitest.
4. **`hooks/use-markdown-file-parser.ts`** + unit tests — Composes lib utilities with FileReader. Run vitest.
5. **`hooks/use-create-post-from-file.ts`** + unit tests — Convex mutation wrapper. Run vitest.
6. **`context/post-toolbar-context.tsx`** — Add dialog state with `useCallback`-wrapped handlers.
7. **`components/markdown-upload-dialog.tsx`** — Pure UI component (props only).
8. **`components/markdown-upload-dialog-connector.tsx`** — Reads context + hooks, passes to dialog.
9. **`components/post-list-toolbar.tsx` + connector** — Wire button, mount dialog connector.
10. **Build + lint** — `pnpm build --filter=@feel-good/mirror && pnpm lint --filter=@feel-good/mirror`.
11. **Playwright E2E** — Write and run `post-upload.spec.ts`.

---

## Open Questions

None — all key decisions resolved.

---

## Adversarial Review Summary

| Concern | Severity | Resolution |
|---------|----------|------------|
| `generateJSON` needs `window.DOMParser`, fails outside browser | Critical | **Accepted** — Specified headless Editor approach; marked utility as browser-only (NFR-05) |
| `category` is required in mutation but FR-08 allowed undefined | Critical | **Accepted** — FR-08 updated to fall back to `DEFAULT_POST_CATEGORY` ("Creativity") |
| Slug collision shows raw Convex error with no fix path | Important | **Partially accepted** — FR-15 covers inline error display; pre-check query skipped (YAGNI for v1 draft uploads, user can retry with different file) |
| tiptap-markdown conversion path unspecified | Important | **Accepted** — Architecture section now specifies headless Editor approach with `createMarkdownExtensions()` |
| Dialog state reset fragility across separate state owners | Important | **Accepted** — Dialog uses conditional rendering (unmount on close) for guaranteed clean state |
| Field length validation missing client-side | Important | **Accepted** — Added FR-10 with client-side validation of title/slug/category lengths |
| gray-matter silently permits malformed YAML | Minor | **Rejected** — Fallbacks (FR-06/07/08) handle empty data gracefully; not worth added complexity |
| useCallback missing for context callbacks | Minor | **Accepted** — Noted in orchestration step 6 and architecture section |
