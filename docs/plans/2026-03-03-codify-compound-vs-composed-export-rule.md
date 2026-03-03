---
title: "Codify compound vs composed component export rule"
type: convention
status: active
date: 2026-03-03
origin: refactor(chat) ConversationList internalization (commit 01d15a98)
---

# Codify compound vs composed component export rule

## Context

The `ConversationList` refactor revealed a missing convention: when should a component export shadcn-style compound sub-components vs a single composed component with a props API? The UI primitives layer (`packages/ui/`) correctly uses compound exports — consumers compose `Dialog`, `DialogTrigger`, `DialogContent` etc. But feature components with fixed data contracts shouldn't force consumers to handle iteration, empty states, and sub-component wiring. The rule needs to be documented and added to the existing conventions.

## Changes

### 1. New rule file: `.claude/rules/component-exports.md`

Add a concise rule (matches the style of `file-organization.md`, `react-components.md`, `forms.md`):

**Compound exports** (multiple sub-components) — for `packages/ui/` only:
- Context-free, generic UI building blocks
- Consumers need layout flexibility (Dialog content varies per usage)
- Following shadcn/ui patterns (Radix wrappers with styling)

**Composed exports** (single component, clean props API) — for feature components:
- Fixed data contract (takes `conversations`, not `children`)
- Iteration, empty states, item rendering are internal concerns
- Sub-components kept as non-exported functions for internal readability
- Consumer gets a declarative `<ConversationList conversations={...} />` API

Decision rule:
> If the component's children are determined by its data (not by the consumer), export one composed component.

Include the `ConversationList` as the canonical before/after example.

### 2. Update `.claude/commands/patterns/composition.md`

Add a new section **"Export Surface: Compound vs Composed"** to the Anti-Patterns table and add a brief reference to the full rule in `.claude/rules/component-exports.md`.

Add to Anti-Patterns table:
| Feature component exports sub-components for consumer to compose | Export one composed component; keep sub-components internal |

### 3. Update `docs/conventions/file-organization-convention.md`

Add a one-line cross-reference in the feature module section pointing to the new rule, since file organization and export surface are closely related.

## Files to modify

- `.claude/rules/component-exports.md` (new)
- `.claude/commands/patterns/composition.md` (add anti-pattern row + cross-reference)
- `docs/conventions/file-organization-convention.md` (add cross-reference)

## Verification

- Re-read all 3 files after editing to confirm accuracy
- Ensure no contradictions with existing conventions
