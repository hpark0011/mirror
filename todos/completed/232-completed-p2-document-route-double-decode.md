---
status: completed
priority: p2
issue_id: "232"
tags: [code-review, quality, react-router, electron]
dependencies: []
---

# Remove Double Decoding in Document Route Param

The document view decodes `name` again even though React Router already decodes path segments before `useParams()` consumers read them.

## Problem Statement

`DocumentView` applies `decodeURIComponent` to `name` from `useParams()`. For filenames that contain literal `%` after router decoding (for example `100% coverage.md`), this throws `URIError: URI malformed` and breaks navigation.

## Findings

- `DocumentView` manually decodes `name`: `/Users/disquiet/.codex/worktrees/cd56/feel-good/apps/greyboard-desktop/src/routes/document-view.tsx:30`.
- The list route already URL-encodes filenames on navigation: `/Users/disquiet/.codex/worktrees/cd56/feel-good/apps/greyboard-desktop/src/routes/document-list.tsx:115`.
- React Router decodes path segments internally (`decodePath`), so an additional decode in app code is unsafe: `/Users/disquiet/.codex/worktrees/cd56/feel-good/node_modules/.pnpm/react-router@7.13.0_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/react-router/dist/development/chunk-JZWAC4HX.mjs:785`.
- Local reproduction confirms second decode fails on percent-bearing names: `decodeURIComponent('100% coverage.md') -> URIError`.

## Proposed Solutions

### Option 1: Trust Router-Decoded Param

**Approach:** Remove manual `decodeURIComponent` and use `name` directly.

**Pros:**
- Minimal diff
- Aligns with React Router contract
- Eliminates crash scenario

**Cons:**
- Requires confidence in router decoding behavior (already present in current version)

**Effort:** Small

**Risk:** Low

---

### Option 2: Defensive Decode Guard

**Approach:** Keep decode but wrap in `try/catch` and fallback to raw `name`.

**Pros:**
- Handles malformed inputs safely
- Preserves backward compatibility if encoding source changes

**Cons:**
- Keeps unnecessary logic
- Masks conceptual misuse of `useParams()`

**Effort:** Small

**Risk:** Low

---

### Option 3: Route by Safe File ID Instead of Name

**Approach:** Navigate by opaque identifier (index or hash) and resolve name server-side.

**Pros:**
- Avoids URL encoding edge cases entirely
- Better long-term routing stability

**Cons:**
- Requires broader API/store refactor
- Not necessary for immediate bug fix

**Effort:** Medium

**Risk:** Medium

## Recommended Action

## Technical Details

**Affected files:**
- `/Users/disquiet/.codex/worktrees/cd56/feel-good/apps/greyboard-desktop/src/routes/document-view.tsx`
- `/Users/disquiet/.codex/worktrees/cd56/feel-good/apps/greyboard-desktop/src/routes/document-list.tsx`

**Related components:**
- React Router path decoding behavior

**Database changes (if any):**
- No

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/148

## Acceptance Criteria

- [ ] Navigating to files with `%`, spaces, and non-ASCII names does not throw.
- [ ] Document detail page opens correctly for all listed files.
- [ ] Add regression test covering percent-containing filename routing.

## Work Log

### 2026-02-19 - Review Finding Captured

**By:** Codex

**Actions:**
- Traced router param flow from list navigation to detail route.
- Verified `react-router` decode behavior in installed dependency.
- Reproduced raw JavaScript failure mode for second decode.

**Learnings:**
- Router params should be treated as decoded user-space values unless explicitly documented otherwise.

## Notes

- This is a user-visible reliability regression on real-world filename patterns.
