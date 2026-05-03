---
id: FG_117
title: "Hyphenated Convex modules under content/ are renamed to camelCase so npx convex dev deploys"
date: 2026-05-03
type: fix
status: to-do
priority: p1
description: "Three Convex modules introduced by the inline-image-lifecycle waves use hyphenated paths the Convex 1.32.0 deploy server rejects: content/storage-policy.ts, content/body-walk.ts, content/safe-fetch.ts. npx convex dev --once exits with InvalidConfig because path components must be alphanumeric/underscore/period. The dev backend (quick-turtle-404) is stuck on stale code without the wave-1 inline-image test fixture endpoints, which means all 8 inline-image E2E specs 404 at /test/ensure-article-fixtures and FG_094 cannot be reproduced or executed. Rename the three files to camelCase, update every importer, sync packages/convex/package.json's exports + typesVersions surfaces, and confirm convex dev --once deploys cleanly."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "find packages/convex/convex/content -name '*-*.ts' returns 0 matches (no hyphenated module names left under content/)"
  - "grep -rE 'from \"\\.{1,2}/.*?(storage-policy|body-walk|safe-fetch)\"|from \"@feel-good/convex/convex/.*?(storage-policy|body-walk|safe-fetch)\"' packages/convex apps/mirror returns 0 matches (no stale imports remain)"
  - "packages/convex/package.json exports map and typesVersions['*'] both reference the camelCase paths (./convex/content/storagePolicy, ./convex/content/bodyWalk, ./convex/content/safeFetch); no exports key references the old hyphenated paths"
  - "npx convex dev --once exits 0 against the dev deployment quick-turtle-404 (proves the deploy server accepts every renamed module)"
  - "pnpm --filter=@feel-good/convex test passes (252 tests; no regression introduced by the rename)"
  - "pnpm --filter=@feel-good/mirror build passes (TypeScript resolution succeeds end-to-end)"
owner_agent: "Convex backend / refactor specialist"
---

# Hyphenated Convex modules under content/ are renamed to camelCase so npx convex dev deploys

## Context

Resolving-tickets batch on `feature-add-editor` (2026-05-03) surfaced this as the
upstream blocker for FG_094. The Convex CLI 1.32.0 deploy server rejects every
hyphenated path under `convex/`:

```
$ npx convex dev --once
400 Bad Request: InvalidConfig: content/storage-policy.js is not a valid path to a
Convex module. Path component storage-policy.js can only contain alphanumeric
characters, underscores, or periods.
```

The three offenders (introduced across the inline-image-lifecycle waves):
- `packages/convex/convex/content/storage-policy.ts`
- `packages/convex/convex/content/body-walk.ts`
- `packages/convex/convex/content/safe-fetch.ts`

The author of these modules added a header comment claiming "pure modules with
no Convex function registrations" would be accepted, but the deploy server
rejects all hyphenated paths regardless of contents. The previously-extracted
`markdownImport.ts` (FG_095) intentionally used camelCase to avoid compounding
this — the rename here brings the three older neighbors in line.

Direct probes during the FG_094 investigation confirm `/test/ensure-article-fixtures`
returns 404 from both `quick-turtle-404.convex.site` (dev) and `famous-cricket-102.convex.site`
(prod). The wave-1 backend code is undeployed everywhere because every `convex dev`
or `convex deploy` invocation fails at config-validation. Until this lands,
FG_094's auth-race investigation cannot be reproduced and the markdown-import
endpoints stay un-callable from the live frontend.

## Goal

After this ticket, every module under `packages/convex/convex/content/` uses
camelCase, `npx convex dev --once` deploys cleanly to the dev backend, and the
three rename touch points (file names, importer paths, package.json export
surfaces) stay in sync per `.claude/rules/identifiers.md`.

## Scope

- `git mv` the three files: `storage-policy.ts` → `storagePolicy.ts`, `body-walk.ts` → `bodyWalk.ts`, `safe-fetch.ts` → `safeFetch.ts`.
- Update every importer of those modules across `packages/convex` and `apps/mirror` (grep-driven).
- Update `packages/convex/package.json` `exports` map AND `typesVersions["*"]` block to reference the new camelCase paths (both surfaces; missing either silently breaks TS resolution per `.claude/rules/identifiers.md`).
- Update any documentation/comments naming the old paths (header comments in the three files, AGENTS.md references, ticket cross-references in Resources sections of completed tickets).
- Verify the `npx convex dev --once` deploys cleanly; verify `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/mirror build` still pass.

## Out of Scope

- Resolving FG_094 itself — this ticket only restores the deploy precondition.
- Renaming hyphenated files outside `convex/content/` — none exist today; this is a focused fix, not a sweep.
- Migrating the `markdownImport.ts` naming style backward — it's already camelCase (FG_095) and stays.
- Refactoring any of the moved modules' implementations — pure rename + import-path edits only.

## Approach

Rename + import-fix is mechanical. The risk vectors are:

1. **Missing an importer.** Grep across the entire monorepo for each old path string before declaring done. Specific patterns to grep: `storage-policy`, `body-walk`, `safe-fetch` (use word-boundary or quote-anchored matches to avoid noise).
2. **Forgetting `package.json` `typesVersions` parity.** `.claude/rules/identifiers.md` explicitly calls out this footgun: TS resolution will fail at the call site even when runtime resolution succeeds if only `exports` is updated. Both surfaces must move together.
3. **Stale references in completed tickets and docs.** Cross-reference grep on `workspace/tickets/completed/` and `.claude/rules/` after the import-fix pass — these aren't load-bearing but accumulating drift erodes future search/audit value.
4. **`convex dev --once` masking failure on stdout.** The server returns `400 Bad Request`; the CLI may exit non-zero or may surface only as a stderr line. Run with `; echo "EXIT=$?"` and confirm exit 0 explicitly.

`CONVEX_DEPLOY_KEY` in `apps/mirror/.env.local` silently routes `convex dev` to prod (per saved memory and FG_118). Either `env -u CONVEX_DEPLOY_KEY npx convex dev --once` from the worktree root, or land FG_118 first.

- **Effort:** Small
- **Risk:** Medium — mechanical file rename, but the cross-cutting import surface and the TS-resolution footgun in `package.json` mean a missed update can break the build invisibly until a deep import resolves wrong.

## Implementation Steps

1. Run `git mv` on each of the three files in `packages/convex/convex/content/`. Stage the renames so `git status` shows them as `R` (rename, not delete+add).
2. Grep for old import paths and update them to the new camelCase form. Suggested patterns: `grep -rln "from .*storage-policy\|from .*body-walk\|from .*safe-fetch" packages/convex apps/mirror | xargs sed -i.bak 's|storage-policy|storagePolicy|g; s|body-walk|bodyWalk|g; s|safe-fetch|safeFetch|g'` (then delete `.bak` files; verify no over-broad matches in CSS, markdown, etc.). Manual review of each touched file is required because some references may live in `.md` ticket bodies — those should NOT be rewritten (history record), but importer `.ts`/`.tsx` files MUST be.
3. Update `packages/convex/package.json`: rewrite the `exports` map keys for the three modules to `./convex/content/storagePolicy`, `./convex/content/bodyWalk`, `./convex/content/safeFetch` (and the `value` paths to the new `.ts` files). Mirror the same key/value pairs in `typesVersions["*"]`. Confirm both surfaces are in sync — failing to update `typesVersions` is the rule's named footgun.
4. Update header comments inside the three renamed files that reference their own old hyphenated path (the "pure module" notes that incorrectly claimed hyphenation was tolerated). Replace with a one-line note recording the rename and ticket ID.
5. Run `pnpm --filter=@feel-good/convex test` from worktree root. Expect exit 0 with 252 tests passing (the count from the resolving-tickets batch baseline). Any TS errors here indicate a missed importer.
6. Run `pnpm --filter=@feel-good/mirror build` from worktree root. Expect exit 0; this catches mirror-side importers the test command would miss.
7. From `packages/convex/`, run `env -u CONVEX_DEPLOY_KEY npx convex dev --once 2>&1 | tail -20; echo "EXIT=$?"`. Expect EXIT=0 and a "successfully deployed" line. If EXIT is non-zero, the deploy server is reporting a still-bad path — re-run grep step 2 and look for any `.ts` file that wasn't picked up.
8. Probe `https://quick-turtle-404.convex.site/test/ensure-article-fixtures` (or whatever the convex-test fixture endpoint is — confirm via the convex/http.ts router) and confirm it returns something other than 404 (200/401/etc. — anything that proves the wave-1 code is now live on dev). This step is the "real-world" verification beyond the deploy-CLI exit code.

## Constraints

- Pure rename + import-path updates. NO behavior changes inside the three modules.
- `package.json` `exports` and `typesVersions` MUST be edited together in the same commit. `.claude/rules/identifiers.md` documents that splitting these surfaces is a silent TS-resolution breaker.
- Do NOT rewrite ticket files in `workspace/tickets/completed/` — those are historical records. Documentation references in `.md` files OUTSIDE `workspace/tickets/` (AGENTS.md, .claude/rules/) MAY be updated if they reference the old paths.
- Do NOT touch `markdownImport.ts` (already camelCase) or any other non-content/ Convex modules in this ticket.
- One commit per the rename + sync (atomic) so a future revert is clean. Do not interleave unrelated changes.

## Resources

- `.claude/rules/identifiers.md` — `package.json` `exports` + `typesVersions` parity rule.
- `.claude/rules/auth.md` § Monorepo deploy gotcha — Vercel build command depends on the convex package's exports.
- FG_094 ticket body (currently in `workspace/tickets/to-do/`) — describes the downstream impact and the auth-race investigation that's blocked until this lands.
- FG_095 ticket body (in `workspace/tickets/completed/`) — establishes the camelCase precedent with `markdownImport.ts` and explains the same Convex-1.32.0 constraint.
- Convex CLI 1.32.0 deploy server rejection message: `InvalidConfig: content/<file>.js is not a valid path to a Convex module. Path component <file>.js can only contain alphanumeric characters, underscores, or periods.`
