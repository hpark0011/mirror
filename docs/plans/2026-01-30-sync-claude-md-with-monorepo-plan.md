# Sync CLAUDE.md Files with Current Monorepo State

## Overview

The context-guardian agent identified that documentation is **out of sync** with the actual codebase. The monorepo has grown to 3 apps and 5 packages, but documentation only covers 1 app and 2 packages.

---

## Current State

| Category | Documented | Actual | Gap |
|----------|------------|--------|-----|
| Apps | 1 | 3 | **2 missing** |
| Packages | 2 | 5 | **3 missing** |

### Missing from Root CLAUDE.md

| Path | Description | Priority |
|------|-------------|----------|
| `apps/mirror/` | Auth app with Convex + Better Auth | High |
| `apps/ui-factory/` | Design system showcase (new) | Medium |
| `packages/convex/` | Shared Convex backend | High |
| `packages/features/` | Shared auth features | High |
| `packages/ui/` | Shared UI components (shadcn/ui) | High |

### Missing CLAUDE.md Files

| Location | Impact | Effort |
|----------|--------|--------|
| `apps/mirror/CLAUDE.md` | High - Complex auth | 30 min |
| `packages/ui/CLAUDE.md` | High - Core components | 30 min |
| `packages/features/CLAUDE.md` | High - Auth exports | 20 min |
| `apps/ui-factory/CLAUDE.md` | Medium - New app | 15 min |

---

## Implementation Plan

### Phase 1: Update Root CLAUDE.md (Immediate)

**File**: `/CLAUDE.md`

Update the Structure section to reflect actual state:

```
feel-good/
├── apps/
│   ├── greyboard/              # Task management app (Next.js 15)
│   ├── mirror/                 # Auth app (Convex + Better Auth)
│   └── ui-factory/             # Design system showcase
├── packages/
│   ├── convex/                 # Shared Convex backend
│   ├── features/               # Shared auth features
│   ├── icons/                  # SVG icon components
│   ├── ui/                     # Shared UI components (shadcn/ui)
│   └── utils/                  # Shared utilities
├── tooling/
│   ├── eslint/                 # @feel-good/eslint-config
│   ├── prettier/               # @feel-good/prettier-config
│   └── typescript/             # @feel-good/tsconfig
└── ...
```

Add new package documentation:

```markdown
### @feel-good/ui

Shared UI components based on shadcn/ui.

\`\`\`typescript
import { Button, Card, Dialog } from "@feel-good/ui";
\`\`\`

### @feel-good/features

Shared feature components (authentication).

\`\`\`typescript
import { SignInForm, UserMenu } from "@feel-good/features/auth";
\`\`\`

### @feel-good/convex

Shared Convex backend configuration.

\`\`\`typescript
import { api } from "@feel-good/convex";
\`\`\`
```

Add new app documentation:

```markdown
### Mirror (`apps/mirror`)

Authentication dashboard with Convex real-time backend and Better Auth.
See `apps/mirror/CLAUDE.md` for detailed documentation.

### UI Factory (`apps/ui-factory`)

Design system showcase and component playground.
See `apps/ui-factory/CLAUDE.md` for detailed documentation.
```

### Phase 2: Update Monorepo Rules (Immediate)

**File**: `/.claude/rules/monorepo.md`

Add import examples for new packages:

```markdown
## Package Imports
- `@feel-good/utils` - Shared utilities (cn, formatting)
- `@feel-good/icons` - SVG icon components
- `@feel-good/ui` - Shared UI components (shadcn/ui)
- `@feel-good/features` - Auth features
- `@feel-good/convex` - Convex backend
```

### Phase 3: Update Health Status (Immediate)

**File**: `/.claude/health.md`

Update status and date:

```markdown
## Status: NEEDS_UPDATE
Last audit: 2026-01-30

### Outstanding Items
- [ ] Create apps/mirror/CLAUDE.md
- [ ] Create packages/ui/CLAUDE.md
- [ ] Create packages/features/CLAUDE.md
- [ ] Create apps/ui-factory/CLAUDE.md
```

### Phase 4: Create Missing CLAUDE.md Files (This Week)

#### 4.1 `apps/mirror/CLAUDE.md`

```markdown
# Mirror

Authentication dashboard with Convex real-time backend.

## Tech Stack

- Next.js 15 (App Router)
- Convex (real-time backend)
- Better Auth (authentication)
- @feel-good/ui (shared components)

## Quick Start

\`\`\`bash
pnpm dev --filter=@feel-good/mirror
\`\`\`

## Key Patterns

- Server components by default
- Better Auth for session management
- Convex for real-time data
```

#### 4.2 `packages/ui/CLAUDE.md`

```markdown
# @feel-good/ui

Shared UI component library based on shadcn/ui.

## Usage

\`\`\`typescript
import { Button, Card, Dialog } from "@feel-good/ui";
\`\`\`

## Available Components

See `src/` for full list. Core components:
- Button, Card, Dialog
- Form components (Input, Select, Checkbox)
- Layout components (Tabs, Accordion)
```

#### 4.3 `packages/features/CLAUDE.md`

```markdown
# @feel-good/features

Shared feature components across apps.

## Auth Features

\`\`\`typescript
import { SignInForm, UserMenu, AuthProvider } from "@feel-good/features/auth";
\`\`\`

## Adding Features

1. Create feature directory in `src/`
2. Export via barrel file
3. Update package.json exports if needed
```

#### 4.4 `apps/ui-factory/CLAUDE.md`

```markdown
# UI Factory

Standalone design system showcase application.

## Quick Start

\`\`\`bash
pnpm dev --filter=@feel-good/ui-factory
\`\`\`

## Purpose

- Component playground
- Design token visualization
- Pattern documentation
```

---

## Other Issues Found

### Medium Priority

1. **Stale reference in features.md**
   - File: `/.claude/commands/patterns/features.md`
   - Line 11 references "Delphi codebase"
   - Action: Update to "feel-good codebase"

2. **Large hooks.md file**
   - File: `/.claude/commands/patterns/hooks.md`
   - Size: 993 lines (threshold: 600)
   - Action: Split into focused files

### Low Priority

1. Add commit message conventions to root CLAUDE.md
2. Create `/.claude/rules/apps/mirror/` for auth patterns
3. Consider `/skills/convex-backend/` for Convex patterns

---

## Verification

1. Run `ls apps/ packages/` to confirm all directories documented
2. Verify all packages in root CLAUDE.md match actual `packages/*/package.json`
3. Check that new CLAUDE.md files follow existing patterns (compare with `apps/greyboard/CLAUDE.md`)
4. Run `pnpm lint` to ensure no broken imports

---

## Files to Modify

- [x] `/CLAUDE.md` - Add missing apps/packages sections
- [x] `/.claude/rules/monorepo.md` - Add new package imports
- [x] `/.claude/health.md` - Update status and checklist

## Files to Create

- [x] `apps/mirror/CLAUDE.md`
- [x] `apps/ui-factory/CLAUDE.md`
- [x] `packages/ui/CLAUDE.md`
- [x] `packages/features/CLAUDE.md`
