---
status: completed
priority: p2
issue_id: "201"
tags: [code-review, pr-124, security, xss, editor, tiptap]
dependencies: []
---

# No JSONContent sanitization before rendering in Tiptap

## Problem Statement

`RichTextViewer` passes `content` (JSONContent) directly to `useEditor({ content })` and `editor.commands.setContent(content)` without sanitization. While current data is mock (hardcoded), when dynamic user-generated content is introduced, unsanitized JSONContent could contain malicious HTML attributes, event handlers, or script-bearing nodes that Tiptap renders into the DOM.

## Findings

- **Location:** `packages/features/editor/components/rich-text-viewer.tsx:14-22`
- Tiptap's `setContent` renders JSONContent nodes into ProseMirror DOM — custom attributes and marks are preserved
- The Image extension allows arbitrary `src` attributes (no URL scheme validation)
- The Link extension allows arbitrary `href` attributes on programmatic content load (only `openOnClick` validates user clicks)
- No allowlist of node types, marks, or attributes exists

## Proposed Solutions

### Option A: Build a sanitizeContent utility (Recommended)

Create a recursive JSONContent sanitizer that:
1. Allowlists node types (`paragraph`, `heading`, `image`, `link`, `text`, etc.)
2. Validates URL schemes on `src` and `href` (only `https:`, `http:`, `mailto:`)
3. Strips unknown attributes and marks

```typescript
// packages/features/editor/lib/sanitize-content.ts
export function sanitizeContent(content: JSONContent): JSONContent { ... }
```

- **Effort:** Medium
- **Risk:** Low

### Option B: Use DOMPurify on HTML output

Convert JSONContent to HTML, sanitize with DOMPurify, then render.

- **Effort:** Medium
- **Risk:** Medium — adds HTML round-trip and dependency

## Acceptance Criteria

- [x] JSONContent is sanitized before being passed to Tiptap editor
- [x] Only allowlisted node types are rendered
- [x] URLs with `javascript:` or `data:text/html` schemes are stripped
- [x] Existing mock content renders identically after sanitization

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 security review | Tiptap renders JSONContent nodes into DOM without built-in sanitization |
| 2026-02-13 | Implemented Option A: sanitizeContent utility | Allowlists node types, marks, attrs; validates URL schemes; integrated into RichTextViewer with useMemo; mirror build passes |
