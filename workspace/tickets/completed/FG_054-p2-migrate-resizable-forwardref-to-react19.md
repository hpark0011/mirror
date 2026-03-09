---
id: FG_054
title: "Resizable primitives use React 19 ref pattern"
date: 2026-03-09
type: refactor
status: completed
priority: p2
description: "resizable.tsx is the only primitive in @feel-good/ui using React.forwardRef. All 53 other primitives use React 19's native ref-as-prop pattern (React.ComponentProps includes ref). The forwardRef wrapper should be migrated to match the codebase convention."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -c 'forwardRef' packages/ui/src/primitives/resizable.tsx returns 0"
  - "ResizablePanelGroup and ResizablePanel accept ref prop and pass it through"
  - "pnpm build succeeds"
  - "Existing e2e tests pass (panel toggle still works with refs)"
owner_agent: "UI library maintenance specialist"
---

# Resizable primitives use React 19 ref pattern

## Context

PR #193 converted `ResizablePanelGroup` and `ResizablePanel` in `packages/ui/src/primitives/resizable.tsx` to use `React.forwardRef` to support imperative ref access (`setLayout`, `collapse`). However, the rest of the `@feel-good/ui` package uses React 19's native pattern where `ref` is included in `React.ComponentProps<T>` without needing `forwardRef`.

## Goal

`resizable.tsx` uses the same ref-as-prop pattern as every other primitive in the UI package, with no `forwardRef` calls.

## Scope

- Convert `ResizablePanelGroup` and `ResizablePanel` from `forwardRef` to plain function components with `ref` destructured from props
- Ensure ref forwarding still works for `DesktopWorkspace`

## Out of Scope

- Changing `ResizableHandle` (it doesn't use forwardRef)
- Auditing other packages for forwardRef usage

## Approach

Replace the `React.forwardRef` wrapper with a plain function that destructures `ref` from `React.ComponentProps`. In React 19, function components natively accept `ref` as a prop.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Convert `ResizablePanelGroup` from `React.forwardRef<...>(...)` to `function ResizablePanelGroup({ ref, className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>)`
2. Convert `ResizablePanel` similarly
3. Pass `ref` directly to the underlying primitive
4. Run `pnpm build` (full monorepo to catch all consumers)
5. Run mirror e2e tests to verify panel refs still work

## Constraints

- Must maintain the same ref forwarding behavior
- Must not break any existing consumers that don't pass ref

## Resources

- React 19 ref-as-prop: https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
- `packages/ui/src/primitives/resizable.tsx`
