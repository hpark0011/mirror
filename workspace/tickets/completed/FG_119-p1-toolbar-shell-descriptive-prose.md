---
id: FG_119
title: "Toolbar shell renders only interactive affordances, no descriptive prose"
date: 2026-05-03
type: refactor
status: completed
priority: p1
description: "The Bio panel rendered description copy inside ContentToolbarShell, breaking the convention that workspace toolbars contain only interactive controls."
dependencies: []
acceptance_criteria:
  - "Bio toolbar contains no descriptive prose."
  - "Bio description copy lives in the panel body."
  - "pnpm build --filter=@feel-good/mirror exits 0"
  - "pnpm lint --filter=@feel-good/mirror exits 0"
owner_agent: "Frontend refactor engineer (React/Tailwind, feature-module conventions)"
---

# Toolbar shell renders only interactive affordances

## Context

The toolbar-unification refactor placed Bio description copy inside
`ContentToolbarShell`. Existing article and post callers use the shell only for
buttons, dropdowns, and back links. Body copy in that shell blurred the boundary
between workspace chrome and content.

## Resolution

The Bio description was restored to `bio-panel.tsx`; `bio-toolbar.tsx` now
contains only its conditional add-entry action. `ContentToolbarShell` itself was
left unchanged.

## Verification

Build and lint the Mirror app, then visually confirm `/@<owner>/bio` renders the
description in the panel body rather than the toolbar.
