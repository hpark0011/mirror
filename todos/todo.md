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
