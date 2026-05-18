---
id: FG_250
title: "Shared Tooltip primitive has a guaranteed root TooltipProvider"
date: 2026-05-18
type: fix
status: completed
priority: p1
description: "Tooltip no longer self-wraps TooltipProvider, so shared-package consumers silently break in any app whose root lacks a TooltipProvider; ui-factory was only incidentally covered via SidebarProvider internals."
dependencies: []
acceptance_criteria:
  - "TooltipProvider wraps the children tree in apps/ui-factory/providers/root-provider.tsx"
  - "packages/ui/AGENTS.md states consuming apps must mount TooltipProvider at the app root"
  - "ui-factory tooltip context does not depend solely on SidebarProvider"
  - "pnpm --filter=@feel-good/ui-factory build succeeds"
---

# Shared Tooltip primitive has a guaranteed root TooltipProvider

## Context

This branch removed the per-`Tooltip` `TooltipProvider` wrapper (FG_243). Shared consumers (`packages/ui` icon-button, editor toolbar-button) now require an ancestor provider. ui-factory had none in root-provider.tsx — only incidental coverage via SidebarProvider. Found in code review (convention, confidence 0.93).

## Resolution

Added an explicit root `TooltipProvider` in `apps/ui-factory/providers/root-provider.tsx` wrapping `<SidebarProvider>{children}</SidebarProvider>`; documented the contract in `packages/ui/AGENTS.md`. A genuine pre-existing ui-factory build defect (the `Button` primitive's `wrapper` variant was unrepresented in the `button-variants` showcase config — `wrapper` missing from `BUTTON_VARIANTS` and `variantLabels`) blocked the build-green criterion; fixed as a necessary accepted out-of-scope spot-fix. `pnpm --filter=@feel-good/ui-factory build` exits 0. Recovered after a worktree git-clobber and re-verified (build re-gate exit 0).
