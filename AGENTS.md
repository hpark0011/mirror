# Feel Good Monorepo

Turborepo monorepo. Two Next.js 15 (App Router, React 19) apps backed by a shared Convex deployment (real-time queries + Better Auth), with UI primitives in `packages/ui` and cross-app feature modules in `packages/features`.

Full project map (apps, packages, ports, auth layers): [`docs/project-map.md`](docs/project-map.md).

## Commands

```bash
pnpm install                          # Install all workspaces
pnpm dev --filter=@feel-good/mirror   # Run one app (or cd apps/mirror && pnpm dev)
pnpm build --filter=@feel-good/mirror # Build one app — see verification rules for tier
pnpm lint --filter=@feel-good/mirror  # Lint one app
```

App-specific commands live in each app's `AGENTS.md` (`apps/mirror/AGENTS.md`, `apps/ui-factory/AGENTS.md`).

## Deploy & Build Footguns

Two things about the Vercel/Convex setup are easy to break and hard to diagnose — read before touching:

- **`turbo.json` `globalEnv` array.** Any env var read by Next or Convex at build time must be listed here, or Turbo filters it out before the build subprocess sees it. Owner: [`.claude/rules/auth.md` § Monorepo deploy gotcha](.claude/rules/auth.md).
- **Vercel build command.** Root Directory is `apps/mirror` but Convex lives at `packages/convex/convex/`. The build walks up with `cd ../../packages/convex && npx convex deploy --cmd "cd ../../apps/mirror && ..."`. Do not simplify this. Owner: [`.claude/rules/auth.md` § Monorepo deploy gotcha](.claude/rules/auth.md).

## Core Principles

- **Always Choose the Compounding Option** — You should ALWAYS choose the option that compounds, that architecturally makes the codebase less prone for error and never choose the quick wins. When a bug or feedback reveals a gap in a skill, rule, convention, or template, patch the upstream artifact before (or alongside) fixing the downstream instance.
- **Git workflow** — Never commit directly to main. Always use feature branches. When a merge conflict or branch divergence occurs, stop and ask the user before force-pushing or resetting.

## Project Rules

Detailed conventions live in `.claude/rules/`. All rules auto-load via `paths:` frontmatter unless noted.

- **[Auth](.claude/rules/auth.md)** — Better Auth running inside Convex; Next.js only proxies `/api/auth/*`. **Check before debugging sign-in, OAuth, or session cookies — the URL/host choreography between `.convex.cloud`, `.convex.site`, and the app domain is the #1 footgun.**
- **[Convex](.claude/rules/convex.md)** — function guidelines, validators, schema, query/mutation patterns. Auto-loads under `packages/convex/convex/**`.
- **[Verification](.claude/rules/verification.md)** — build/lint/Chrome-MCP tiers per change type. **Run the matching tier before reporting any task complete.**
- **[File organization](.claude/rules/file-organization.md)** — where components/hooks/utils/schemas live in a feature module. All React components go in `components/`; `views/` is reserved for cross-app packages.
- **[Forms](.claude/rules/forms.md)** — React Hook Form + Zod + `zodResolver`; shadcn `Form` primitives from `@feel-good/ui/primitives/form`; schemas live in each feature's `lib/schemas/`.
- **[Identifiers](.claude/rules/identifiers.md)** — slugs/handles/codes must pass through one canonical normalizer at the mutation boundary; never `args.slug || generate(...)`; always `generate(args.slug ?? args.title)` plus an `assertValid…` check before DB write.
- **[React components](.claude/rules/react-components.md)** — components under ~100 lines; **never `setTimeout` to fix rendering timing — use Suspense, view-transition isolation, or `startTransition` instead.**
- **[State management](.claude/rules/state-management.md)** — three-tier hierarchy: `useState`/`useReducer` → `useLocalStorage` → React Context. Zustand is not used in this repo.
- **[Tailwind](.claude/rules/tailwind.md)** — Tailwind v4, CSS-first config (no `tailwind.config.js`); use `@source` to scan shared packages; three-layer token system (Radix → semantic → `@theme inline`).
- **[TypeScript](.claude/rules/typescript.md)** — inline type imports; feature types in `features/<feature>/types.ts`, shared in `types/<domain>.types.ts`.
- **[Providers](.claude/rules/providers.md)** — separate client singleton (`lib/<service>.ts`) from React provider (`providers/<service>-provider.tsx`); never `!` on `process.env`; lazy-init external clients.
- **[Testing](.claude/rules/testing.md)** — **Playwright CLI only for e2e tests.** Never the Playwright MCP plugin or browser-automation MCP tools.
- **[Dev process](.claude/rules/dev-process.md)** — session discipline, planning, problem-solving flow; **after any correction, update `workspace/lessons.md`.**
- **[App-specific](.claude/rules/apps/)** — per-app rules (currently `apps/mirror/articles.md`, `apps/mirror/navigation.md`).
- **[Sentry](.claude/rules/sentry/)** — exception capture, tracing spans, and logger patterns for Next.js.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
