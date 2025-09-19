# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds App Router routes, layouts, and page logic; start here for feature work.
- `components/ui/` provides shadcn/ui primitives with Radix wiring; extend via `@/lib/utils` `cn()` helper.
- `components/providers/` composes theme, React Query, and toast providers; wrap new context providers here.
- `components/trello/` contains the drag-and-drop board implementation and related types.
- Shared logic lives in `lib/`, reusable hooks in `hooks/`, icons in `icons/`, and product briefs in `PRPs/`.

## Build, Test, and Development Commands
- `pnpm dev` launches the Turbopack dev server at http://localhost:3000.
- `pnpm build` creates an optimized Next.js production bundle.
- `pnpm start` runs the compiled app in production mode.
- `pnpm lint` executes the Next.js ESLint config; run before every commit.

## Coding Style & Naming Conventions
- TypeScript, React 19, and Tailwind CSS 4 are mandatory; keep files `.ts`/`.tsx` with strict typing.
- Prefer functional components, compound patterns, and Radix Slots; colocate styles via Tailwind utility classes.
- Use `camelCase` for functions/hooks, `PascalCase` for components, and `kebab-case` for file names inside `components/*`.
- Rely on `@/lib/utils/cn` for class merging and respect `data-slot` markers in compound components.

## Testing Guidelines
- Formal test tooling is not yet configured; coordinate before introducing new frameworks.
- When adding tests, follow `__tests__/ComponentName.test.tsx` naming and favor React Testing Library with Vitest.
- Ensure critical flows (forms, drag-and-drop, feature flags) have coverage before merge.

## Commit & Pull Request Guidelines
- Format commit subjects using imperative mood (e.g., `Add board column drag handle`).
- Scope each commit to a single concern; include screenshots or screen recordings for UI changes in PR summaries.
- Reference linked PRPs or issues, list manual verification steps, and call out impacts to providers or environment variables.
- Confirm `pnpm lint` and any added tests succeed before requesting review.

## Security & Configuration Tips
- Store secrets in `.env.local` and prefix client-exposed values with `NEXT_PUBLIC_`.
- Follow the PRP-guided feature flag plan when gating functionality; avoid shipping dormant code without a flag.
- Keep dependencies updated via `pnpm`, and never commit `.env*` or build artifacts.
