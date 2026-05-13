---
id: FG_221
title: "New chat and profile components route user-facing strings through react-i18next"
date: 2026-05-13
type: improvement
status: to-do
priority: p2
description: "PR #93 adds new user-facing strings in chat-conversation-list-sheet.tsx, chat-input.tsx, chat-message-list.tsx, and configure-profile-button.tsx as bare string literals. The repo actively uses react-i18next in settings, posts, and articles features (per apps/mirror/AGENTS.md tech stack table). CodeRabbit raised four threads on this; none addressed."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "Default title in chat-conversation-list-sheet.tsx and the configuration title override are sourced via useTranslation"
  - "chat-input.tsx placeholder (clone + configuration variants, including {profileName} interpolation) and the footer disclaimer use translation keys"
  - "chat-message-list.tsx empty-state greetings (clone + configuration variants) use translation keys"
  - "configure-profile-button.tsx aria-label and tooltip content use translation keys"
  - "Translation keys are added to the project's locale files (verify path by grepping existing useTranslation usage in features/settings or features/posts)"
  - "pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint pass"
owner_agent: "Frontend i18n engineer"
---

# New chat and profile components route user-facing strings through react-i18next

## Context

PR #93 introduces user-facing copy in four new/modified components without going through the project's react-i18next layer:

1. **`apps/mirror/features/chat/components/chat-conversation-list-sheet.tsx:30,42`** — `title = "Conversations"` default + `{title}` render. CodeRabbit thread `r3232592040`.
2. **`apps/mirror/features/chat/components/chat-input.tsx:84-88,126-128`** — placeholder ternary (with `{profileName}` interpolation) and the "Conversations may be visible to..." disclaimer. CodeRabbit thread `r3232592050`.
3. **`apps/mirror/features/chat/components/chat-message-list.tsx:64-73`** — clone and configuration empty-state greetings (with `{profileName}` interpolation). CodeRabbit thread `r3232592064`.
4. **`apps/mirror/features/profile/components/configure-profile-button.tsx:24,31`** — `aria-label="Configure profile"` and `<TooltipContent>Configure profile</TooltipContent>`. CodeRabbit thread `r3232592069`.

The project's tech stack explicitly lists react-i18next at `apps/mirror/AGENTS.md` (i18n row). A grep confirms active usage across:
- `apps/mirror/features/settings/components/{settings-toolbar,settings-panel,default-content-type-select}.tsx`
- `apps/mirror/features/settings/hooks/use-profile-settings.ts`
- `apps/mirror/features/posts/components/editor/post-{editor-toolbar,metadata-text-fields,metadata-header}.tsx`
- `apps/mirror/features/articles/components/editor/article-{metadata-header,editor-toolbar,metadata-text-fields}.tsx`

So this is a consistency gap with an established codebase pattern — not a phantom-rule false positive. The aria-label case in particular has UX impact for screen-reader users in non-English locales.

## Goal

Every new user-facing string introduced by PR #93 routes through `useTranslation` and has a corresponding entry in the locale resource files. Accessibility text (aria-label) is translatable.

## Scope

- The four files listed above.
- The matching translation key entries in the locale files (locate via the existing settings/posts/articles usage).

## Out of Scope

- Migrating existing pre-PR-93 hardcoded strings in other components.
- Adding a new locale or refactoring the i18n bootstrap.
- The plan markdown file `workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md` — workspace plan files are internal docs, not user-facing.

## Approach

For each component, add `const { t } = useTranslation();` and replace each string with a `t(...)` call. Use namespaced keys following the existing convention (likely something like `chat.conversationList.title`, `chat.input.placeholder.clone`, etc. — confirm by reading settings/posts usage).

For interpolation, prefer i18next's `{{varname}}` syntax over template literals.

```ts
// Before
<p>Hi! I&apos;m {profileName}&apos;s digital clone.</p>

// After
<p>{t("chat.empty.cloneGreeting", { profileName })}</p>
```

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Locate the project's locale resource files (likely under `apps/mirror/locales/` or referenced from `apps/mirror/lib/i18n.ts`). Grep `useTranslation` usage in `features/settings/` for the calling convention.
2. Add translation keys for each new string (clone + configuration variants where applicable).
3. Update each of the four components to import `useTranslation` and replace the bare strings.
4. Run `pnpm --filter=@feel-good/mirror build` to confirm TypeScript and bundle survive.
5. Run `pnpm --filter=@feel-good/mirror lint` to confirm no warnings.
6. Smoke test via `pnpm dev:safe` — open the chat and configuration UI, confirm the strings render correctly.

## Constraints

- Keep all key names in the existing namespacing convention.
- Do not add a new locale; default English copy stays as-is.
- aria-label must be present on the button at all times (translatable but never empty).

## Resources

- PR #93 CodeRabbit threads: r3232592040, r3232592050, r3232592064, r3232592069
- `apps/mirror/AGENTS.md` — tech stack table (react-i18next)
- Active usage example: `apps/mirror/features/settings/components/settings-toolbar.tsx`
- `apps/mirror/lib/i18n.ts` (likely path) for resource configuration
