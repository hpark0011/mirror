---
id: FG_253
title: "Codegen-gate comment no longer claims convex codegen is offline"
date: 2026-05-18
type: docs
status: completed
priority: p2
description: "An inline comment in the codegen freshness gate claims --no-install keeps convex codegen offline, directly contradicting the file header and the verified 2026-05-15 lesson, risking a future false CI or lint gate."
dependencies: []
acceptance_criteria:
  - "`grep -n offline scripts/verify-convex-codegen.mjs` does not return a line claiming --no-install makes convex codegen network-offline"
  - "The line at scripts/verify-convex-codegen.mjs ~42 states --no-install only skips npx auto-download and that codegen still requires CONVEX_DEPLOYMENT and pushes functions to the dev deployment"
  - "`node --check scripts/verify-convex-codegen.mjs` passes"
---

# Codegen-gate comment no longer claims convex codegen is offline

## Context

`scripts/verify-convex-codegen.mjs:42` reads `// 1. Regenerate. \`--no-install\` keeps it offline by resolving the local bin.` That is wrong: `--no-install` only suppresses npx's package auto-download — `convex codegen` 1.37 still requires a configured deployment and uploads functions to it. The file's own header (lines 15-22) and `workspace/lessons.md` (2026-05-15) both document this explicitly; the inline comment contradicts them.

Found in code review (data-integrity reviewer, confidence 0.95). The gate logic itself is correct; the danger is purely the false mental model — a future reader trusting the comment wires this into `pnpm lint` or CI (no deployment there), it exits 1 every run, gets disabled, and stale `_generated/api.d.ts` ships undetected, which is the exact P0 the gate exists to prevent.

## Scope

- Reword the inline comment at scripts/verify-convex-codegen.mjs ~42 to match the file header and the 2026-05-15 lesson.

## Approach

Replace the misleading clause with something like: `// 1. Regenerate. --no-install only skips npx auto-download; codegen still needs CONVEX_DEPLOYMENT and pushes functions to the dev deployment (see header).`

## Implementation Steps

1. Read scripts/verify-convex-codegen.mjs:15-45 (header + the step-1 comment).
2. Rewrite the line so it no longer asserts "offline"; align it with the header and workspace/lessons.md 2026-05-15.
3. Run `node --check scripts/verify-convex-codegen.mjs`.

## Resources

- workspace/lessons.md 2026-05-15 "`convex codegen` (1.37) is not offline"
- Contradicted-by: scripts/verify-convex-codegen.mjs:15-22 (header)
