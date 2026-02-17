# 2026-02-17 Greyboard Desktop AGENTS.md

- [x] Confirm working branch is not `main`
- [x] Create `apps/greyboard-desktop/AGENTS.md`
- [x] Verify file and record review notes

## Review

- Created `apps/greyboard-desktop/AGENTS.md` with `@CLAUDE.md` indirection to follow repository convention.
- Verified active branch is `codex/021726-greyboard-desktop-agents` (not `main`).

# 2026-02-15 Mirror + Convex Sentry Integration

- [x] Finalize implementation plan and integration scope
- [x] Create shared `tooling/sentry` package (`@feel-good/sentry-config`) with Next.js option builders
- [x] Wire `apps/mirror` runtime Sentry initialization files and global error boundary
- [x] Integrate `withSentryConfig` into `apps/mirror/next.config.ts` with conditional source map upload
- [x] Update monorepo env caching contract in `turbo.json`
- [x] Document Mirror and Convex Sentry setup and verification steps
- [x] Run verification commands (`pnpm install`, mirror lint/build) and capture outcomes
- [x] Add review notes for completed integration

## Review

- Added shared Sentry config package at `tooling/sentry` with reusable Next.js runtime option builders and safe sample-rate parsing.
- Integrated Mirror Sentry runtime files: `instrumentation-client.ts`, `instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `app/global-error.tsx`.
- Updated `apps/mirror/next.config.ts` to use `withSentryConfig` and conditionally disable sourcemap upload when upload credentials are missing.
- Added Sentry env keys to monorepo `turbo.json` `globalEnv`.
- Updated docs:
  - `apps/mirror/README.md` with runtime/build env setup and verification checklist
  - `packages/convex/README.md` with Convex dashboard-driven Sentry integration instructions
- Verification:
  - `pnpm install` (pass)
  - `pnpm lint --filter=@feel-good/mirror` (pass)
  - `pnpm build --filter=@feel-good/mirror` with temporary required Mirror env vars (pass)
  - Build without required Mirror env vars still fails due pre-existing Mirror env validation, unrelated to Sentry.
- Remaining manual verification:
  - Real Sentry event ingestion (client/server/request) requires a valid DSN and runtime trigger in your environment.
  - Convex-side Sentry ingestion requires enabling integration in Convex dashboard with real Convex env settings.

# 2026-02-12 Mirror Article List Filter

- [x] Confirm filter behavior contract (date presets, root filter-search behavior, default states)
- [ ] Implement `use-article-filters` hook and pure filter helpers for category/date/published
- [ ] Build `ArticleFilterDropdown` with root search input (`placeholder="filter by..."`) and submenu triggers (`category`, `published date`, `created at date`, `published state`)
- [ ] Implement category submenu with Greyboard project-filter structure: search input, selected badges with remove actions, and multi-select checkbox items
- [ ] Implement `published date` submenu (single-select)
- [ ] Gate `created at date` submenu visibility to profile owner only
- [ ] Gate `published state` submenu visibility to profile owner only
- [ ] Integrate filter state into `ScrollableArticleList` so filters compose with existing sort/search/pagination
- [ ] Replace toolbar placeholder filter button with active-aware trigger state
- [ ] Keep root `filter by...` input scoped to narrowing dropdown filter options only (must not directly filter article list)
- [ ] Verify keyboard and focus behavior (input key handling, submenu interactions, no accidental close on multi-select actions)
- [ ] Run verification (`pnpm --filter @feel-good/mirror lint` and `pnpm --filter @feel-good/mirror exec tsc --noEmit`)
- [ ] Add review notes with behavior validation and any edge-case findings

## Architecture Decision

- Use `DropdownMenu` as the primary container for this feature.
- Reason: requirements explicitly call for nested submenu triggers (`category`, `published date`, `created at date`, `published state`), which map directly to `DropdownMenuSub*`.
- `Popover` is still a good fit for a single-panel filter (as in Greyboard), but with required submenus it adds custom nested overlay/focus work without clear upside.
- Reuse the interaction model from Greyboard's project filter for the category submenu internals, adapted to dropdown event behavior.

## Proposed Filter Model

- `categories: string[]` (multi-select)
- `publishedDate: "all" | "last7Days" | "last30Days" | "thisYear"` (single-select)
- `createdAtDate: "all" | "last7Days" | "last30Days" | "thisYear"` (single-select, owner only)
- `publishedState: "all" | "published" | "draft"` (single-select, owner only)
- `hasActiveFilters: boolean` derived from non-default state for trigger styling

## Confirmed Requirements

- Replace single date submenu with two date submenus: `published date` and `created at date`.
- `created at date` submenu is visible only to the profile owner.
- Root `filter by...` input only narrows dropdown filter options and does not directly filter article list rows.

## Review

- Planning updated with confirmed requirements. Waiting for implementation approval.

# 2026-02-09 Mirror Mobile Article Drawer Refactor

- [x] Inspect current mobile sheet implementation and extract style/behavior specs
- [x] Refactor `MobileProfileLayout` to use `@feel-good/ui/primitives/drawer` instead of custom sheet hook/container
- [x] Preserve visual specs from current UI (top fade, custom handle style, rounded superellipse corners, top offset)
- [x] Preserve interaction specs (initial peek snap and expanded snap, drag-to-expand/collapse behavior while content scrolls)
- [x] Verify with lint/typecheck for `@feel-good/mirror`
- [x] Add review notes with verification results

## Review

- Replaced custom bottom-sheet integration in `apps/mirror/features/profile/views/mobile-profile-layout.tsx` with `Drawer` + `DrawerContent` from `@feel-good/ui/primitives/drawer`.
- Preserved sheet visuals from the previous implementation:
  - top offset at `48px`
  - `rounded-t-4xl` and `[corner-shape:superellipse(1.1)]`
  - top gradient fade strip (`top-[32px]`, `h-6`, `from-background to-transparent`)
  - custom drag handle styling (`h-1 w-10`, `bg-muted-foreground/20`, `pt-3 pb-4`)
- Preserved behavior:
  - always-open non-modal drawer for mobile layout
  - snap points for peek/full (`0.1585` and `1`)
  - drag + scroll handoff via Vaul (`scrollLockTimeout={100}`)
  - article list `scrollRoot` still wired using the drawer scroll container ref
- Verification:
  - `pnpm --filter @feel-good/mirror lint` (pass)
  - `pnpm --filter @feel-good/mirror exec tsc --noEmit` (pass)

# 2026-02-09 Monorepo File Organization Convention

- [x] Run best-practice research for Next.js and feature-folder architecture
- [x] Inspect current folder organization in `apps/mirror`, `apps/greyboard`, `apps/ui-factory`, and `packages/features`
- [x] Inspect convention evolution from git history, local todos, and available PR metadata
- [x] Write planner output in `docs/plans/2026-02-09-feat-file-organization-convention-plan.md`
- [x] Write living convention doc in `docs/conventions/file-organization-convention.md`
- [x] Add review summary and limitations

## Review

- Added a planner document that consolidates three requested research streams (best-practice research, code inspection, code history) and turns them into a phased migration strategy:
  - `docs/plans/2026-02-09-feat-file-organization-convention-plan.md`
- Added a living convention document to be referenced by future work:
  - `docs/conventions/file-organization-convention.md`
- Convention decision captured:
  - Feature-first organization is the default.
  - Route-private folders are limited to `app/**/_components` for new code.
  - Feature-specific code goes in `features/<feature>/{components,hooks,store,types,utils,lib,views}`.
  - Cross-app features go in `packages/features/<feature>`.
- Historian limitation:
  - `gh` CLI could not reach GitHub API in this environment, so history used local git + tracked todo artifacts, with direct PR pages referenced where accessible.

# 2026-02-06 ui-factory Turbopack Panic Fix

- [x] Confirm failure mode and available Next.js dev flags in current version
- [x] Update `ui-factory` dev scripts to avoid Turbopack persistence crash by default
- [x] Add explicit scripts for Turbopack usage and cache reset recovery
- [x] Verify package scripts and record review notes

## Review

- Updated `apps/ui-factory/package.json`:
  - `dev` now uses `next dev --webpack --port 3002` (stable default).
  - Added `dev:turbo` for explicit Turbopack usage.
  - Added `dev:turbo:reset-cache` to wipe `.next` and relaunch Turbopack.
- Updated `apps/ui-factory/CLAUDE.md` command docs to match new scripts.
- Verification run:
  - `pnpm --filter @feel-good/ui-factory run` (confirmed scripts are registered).
  - `pnpm --filter @feel-good/ui-factory lint` (passes).
  - `pnpm --filter @feel-good/ui-factory run dev --help` (webpack script resolves).
  - `pnpm --filter @feel-good/ui-factory run dev:turbo --help` (turbo script resolves).
  - `pnpm --filter @feel-good/ui-factory run dev:turbo:reset-cache --help` (cache-reset script resolves).
  - `pnpm --filter @feel-good/ui-factory build` (fails in sandbox due blocked network request to `fonts.googleapis.com` for Geist Mono).
- Limitation: this sandbox does not allow binding to local ports (`listen EPERM`), so an interactive browser dev session could not be run here.

# 2026-02-08 Task 083 Server-Side Auth Guard

- [x] Review task spec and auth implementation touch points
- [x] Add server-side auth guard in protected layout
- [x] Verify with mirror lint/type checks
- [x] Update task doc status, acceptance criteria, and work log
- [x] Add review notes

## Review

- Updated `apps/mirror/app/(protected)/layout.tsx` to run `isAuthenticated()` server-side and `redirect("/sign-in")` before rendering protected children.
- Updated task tracker file and moved it to `todos/completed/083-completed-p2-server-side-auth-guard-protected-layout.md` with acceptance criteria checked and completion log added.
- Verification run:
  - `pnpm --filter @feel-good/mirror lint` (passes).
  - `pnpm --filter @feel-good/mirror exec tsc --noEmit` (passes).
  - `pnpm --filter @feel-good/mirror build` (fails in sandbox due blocked Google Fonts fetch for Geist Mono).

## Review

- Planning only. Waiting for implementation approval.
