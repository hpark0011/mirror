# Markdown Viewer with Tiptap

**Date:** 2026-02-19
**Status:** Complete
**Scope:** `apps/greyboard-desktop` + `packages/features/editor`

## What We're Building

A rendered markdown viewer for `greyboard-desktop`'s document-view route, replacing the current raw `<pre>` tag display. The viewer uses tiptap with the `tiptap-markdown` extension to parse `.md` files into tiptap's editor format, rendering them with the existing prose styles.

This is Phase 1 (viewer only). The tiptap pipeline is intentionally chosen to enable a future Phase 2 where `editable: true` + a toolbar turns the viewer into a full markdown editor with round-trip serialization back to `.md` files.

## Why Tiptap (Not react-markdown or Similar)

- **Future editing support** is the primary driver. A standalone markdown renderer (react-markdown, marked) would need to be replaced entirely when editing is added. Tiptap sets up the pipeline once.
- **Existing infrastructure**: tiptap v3, extensions, and prose styles already exist in `@feel-good/features/editor/`. We extend rather than duplicate.
- **Round-trip ready**: `tiptap-markdown` handles both `md → editor` (parse) and `editor → md` (serialize via `editor.storage.markdown.getMarkdown()`).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Markdown parsing library | `tiptap-markdown` extension | Single dep handles parse + serialize; integrates with tiptap extension system |
| Component location | `@feel-good/features/editor/` | Shared package, alongside existing `RichTextViewer` |
| Styling | Reuse `tiptap-content.css` | Consistent prose look across apps |
| Component name | `MarkdownViewer` | Parallel naming to `RichTextViewer` |

## Architecture Sketch

### New component in `packages/features/editor/`

```
editor/
  components/
    rich-text-viewer.tsx      # Existing (JSONContent input)
    markdown-viewer.tsx       # New (markdown string input)
    index.ts                  # Updated exports
  lib/
    extensions.ts             # Add Markdown extension to factory or create separate factory
```

### Extension setup

The `tiptap-markdown` `Markdown` extension gets added to the extensions array. This enables `editor.commands.setContent(markdownString)` to auto-parse markdown.

### document-view.tsx changes

Replace the `<pre>` tag with the new `MarkdownViewer` component. The IPC call already returns the raw markdown string — just pass it through.

### New dependency

`tiptap-markdown` added to `packages/features/package.json`.

## Open Questions

1. **Extension factory**: Should `createArticleExtensions()` be extended to include the Markdown extension, or should there be a separate `createMarkdownExtensions()` factory? The article viewer doesn't need markdown parsing (it works with JSONContent), so a separate factory may be cleaner.
2. **Heading levels**: The existing extensions restrict headings to `[2, 3, 4]` (h1 reserved for article titles in mirror). Markdown files commonly use h1. Should the markdown viewer allow all heading levels?
3. **Code syntax highlighting**: The StarterKit includes `codeBlock` but no syntax highlighting. Worth adding a highlight extension now, or defer?

## Phase 2 Preview (Not In Scope)

When editing is needed:
- Flip `editable: true` on the tiptap editor
- Add a toolbar component
- Use `editor.storage.markdown.getMarkdown()` to serialize back to `.md`
- Write back via `desktopAPI.docs.writeFile()` (new IPC channel)
