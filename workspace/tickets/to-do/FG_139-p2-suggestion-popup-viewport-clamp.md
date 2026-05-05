---
id: FG_139
title: "Slash-command popup is clamped to viewport bounds"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "The slash-command popup positions to rect.left without clamping to window width, rendering off-screen at end-of-line on narrow viewports."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`packages/features/editor/utils/suggestion-popup.ts` clamps `popup.style.left` to `Math.max(8, Math.min(rect.left, window.innerWidth - popupRect.width - 8))`."
  - "Manual test: type `/` at the right edge of the editor on a 768px-wide viewport — the popup is fully visible (not clipped at the right edge)."
  - "Vertical positioning still flips above the caret when there is not enough space below (existing behavior preserved)."
  - "`pnpm build --filter=@feel-good/mirror` passes."
owner_agent: "frontend engineer (Tiptap)"
---

# Slash-command popup is clamped to viewport bounds

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086770). `packages/features/editor/utils/suggestion-popup.ts:21-25` sets `popup.style.left = rect.left + 'px'` with no horizontal clamp. Vertical overflow is handled (flips above the caret), but on a narrow viewport (mobile, narrow browser window) or when the caret is near the right edge of a wide content area, the menu renders partially or fully off-screen.

**Risk:** user types `/` at end of a long line, sees the popup truncated or invisible, can't pick a block type, and abandons the slash command — the entire feature appears broken on that viewport+caret combination.

## Goal

The slash-command popup is always fully visible regardless of caret position or viewport width.

## Scope

- Clamp the `left` style to `Math.max(8, Math.min(rect.left, window.innerWidth - popupRect.width - 8))`.
- (Optional) similarly clamp the `top` style to handle the rare case of negative top after flip.

## Out of Scope

- Changing the popup's appearance or contents.
- Changing the trigger logic.

## Approach

Inline arithmetic; no new dependencies.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/features/editor/utils/suggestion-popup.ts:21`, replace `popup.style.left = \`${rect.left}px\`` with `popup.style.left = \`${Math.max(8, Math.min(rect.left, window.innerWidth - popupRect.width - 8))}px\``.
2. Verify `popupRect` is read AFTER the popup is in the DOM (its width is needed before clamping).
3. Manually test in dev at viewport widths 1440, 1024, and 768 with the caret at left, middle, and right edges.

## Constraints

- Must not break the existing vertical-flip behavior.
- Must not introduce flicker (read `popupRect` once per show).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086770
