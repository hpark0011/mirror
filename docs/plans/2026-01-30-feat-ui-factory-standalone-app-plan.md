---
title: "feat: Create standalone UI Factory app"
type: feat
date: 2026-01-30
---

# Create Standalone UI Factory App

## Overview

Extract the UI Factory from the mirror app into a standalone Next.js application within the monorepo. UI Factory is used to design, preview, and maintain UI components that will be shared across all Feel Good applications.

## Problem Statement

The UI Factory currently lives as a route (`/ui-factory`) inside the mirror app. This creates several maintainability issues:

1. **Coupling**: UI design tooling is tightly coupled to a production app
2. **Dependencies**: Mirror app carries auth dependencies (Convex, Better Auth) that UI Factory doesn't need
3. **Development friction**: Running mirror dev server just to work on UI components
4. **Isolation**: Changes to mirror could inadvertently break UI Factory

## Proposed Solution

Create a new `@feel-good/ui-factory` app in `apps/ui-factory/` that:

- Contains only UI-related dependencies (no auth, no Convex)
- Shares fonts and global styles with mirror
- Imports from the shared `@feel-good/ui` package
- Runs independently at its own port (e.g., `localhost:3002`)

## Technical Approach

### Files to Migrate

From `apps/mirror/`:

| Source | Destination |
|--------|-------------|
| `app/ui-factory/_components/*` | `app/_components/*` |
| `app/ui-factory/_views/*` | `app/_views/*` |
| `app/ui-factory/layout.tsx` | `app/layout.tsx` (merge with root layout) |
| `app/ui-factory/page.tsx` | `app/page.tsx` |
| `app/fonts/*` | `app/fonts/*` |
| `styles/globals.css` | `styles/globals.css` |
| `styles/fonts.css` | `styles/fonts.css` |

### Root Layout Configuration

The new app needs a simplified root layout based on mirror's configuration:

**Required from mirror's root layout:**
- Local fonts (Inter, InstrumentSerif via `next/font/local`)
- Google font (Geist Mono via `next/font/google`)
- CSS variable setup for fonts
- Global CSS import
- ThemeProvider (from `@feel-good/ui`)

**Not needed:**
- ConvexProvider
- SessionProvider
- Auth-related providers

### Dependencies

**Required packages (from mirror's package.json):**

```json
{
  "dependencies": {
    "@feel-good/ui": "workspace:*",
    "@radix-ui/colors": "catalog:",
    "lucide-react": "catalog:",
    "next": "catalog:",
    "next-themes": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "tw-animate-css": "catalog:"
  },
  "devDependencies": {
    "@feel-good/eslint-config": "workspace:*",
    "@tailwindcss/postcss": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "eslint": "catalog:",
    "eslint-config-next": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:"
  }
}
```

### Provider Setup

Create a minimal `RootProvider` that only includes ThemeProvider:

```tsx
// providers/root-provider.tsx
"use client";

import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
```

## Acceptance Criteria

### Functional Requirements

- [ ] New `apps/ui-factory/` app created and registered in workspace
- [ ] All components from mirror's ui-factory route migrated
- [ ] App runs independently with `pnpm dev --filter=@feel-good/ui-factory`
- [ ] Theme toggle works (light/dark/system)
- [ ] All button variants display correctly

### Non-Functional Requirements

- [ ] No TypeScript errors (`pnpm build` passes)
- [ ] No ESLint errors (`pnpm lint` passes)
- [ ] Global CSS properly wired (radix colors, tailwind utilities work)
- [ ] Inter font loads correctly (check via browser DevTools)
- [ ] InstrumentSerif font loads correctly
- [ ] Geist Mono font loads correctly

### Browser Verification Checklist

- [ ] Background uses `--gray-1` color variable
- [ ] Text uses `--gray-12` color variable
- [ ] Body has `-0.04em` letter-spacing
- [ ] Inter font applied to body text
- [ ] Theme toggle switches between light/dark modes
- [ ] All button variants render with correct styles

## Implementation Steps

### Step 1: Create app directory structure

```
apps/ui-factory/
├── app/
│   ├── fonts/
│   │   ├── font.ts
│   │   ├── InterVariable.ttf
│   │   ├── InterVariable-Italic.ttf
│   │   ├── InstrumentSerif-Regular.ttf
│   │   └── InstrumentSerif-Italic.ttf
│   ├── _components/
│   │   ├── buttons.tsx
│   │   ├── nav-header.tsx
│   │   ├── section-header.tsx
│   │   └── theme-toggle-button.tsx
│   ├── _views/
│   │   └── factory-view.tsx
│   ├── layout.tsx
│   └── page.tsx
├── providers/
│   └── root-provider.tsx
├── styles/
│   ├── globals.css
│   └── fonts.css
├── next.config.ts
├── package.json
├── tsconfig.json
└── postcss.config.mjs
```

### Step 2: Create configuration files

**package.json:**
- Name: `@feel-good/ui-factory`
- Scripts: dev, build, start, lint
- Dependencies: minimal set (no auth packages)

**tsconfig.json:**
- Extends from `@feel-good/tsconfig` or use mirror's config
- Path alias: `@/*` maps to `./*`

**next.config.ts:**
- Minimal config (security headers optional for dev tool)

**postcss.config.mjs:**
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### Step 3: Copy font files and configuration

Copy all `.ttf` files from `apps/mirror/app/fonts/` to `apps/ui-factory/app/fonts/`.

Copy `font.ts` configuration (unchanged).

### Step 4: Copy and adapt styles

Copy `globals.css` - update `@source` path:
```css
@source "../node_modules/@feel-good/ui";
```

Copy `fonts.css` (unchanged).

### Step 5: Create root layout

Merge mirror's root layout with ui-factory layout:

```tsx
// app/layout.tsx
import { InstrumentSerif, Inter } from "@/app/fonts/font";
import { RootProvider } from "@/providers/root-provider";
import "@/styles/globals.css";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UI Factory",
  description: "Component design and preview tool for Feel Good apps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${Inter.variable} ${InstrumentSerif.variable} ${geistMono.variable} antialiased`}
      >
        <RootProvider>
          <div className="mx-auto relative">
            {children}
          </div>
        </RootProvider>
      </body>
    </html>
  );
}
```

### Step 6: Migrate components

Copy from mirror to ui-factory, update imports from `@/app/ui-factory/...` to `@/app/...`:

- `_components/buttons.tsx` - no changes needed
- `_components/nav-header.tsx` - no changes needed
- `_components/section-header.tsx` - no changes needed
- `_components/theme-toggle-button.tsx` - no changes needed
- `_views/factory-view.tsx` - update import path

### Step 7: Create page component

```tsx
// app/page.tsx
import { NavHeader } from "@/app/_components/nav-header";
import { FactoryView } from "@/app/_views/factory-view";

export default function UIFactoryPage() {
  return (
    <>
      <NavHeader />
      <main className="mx-auto min-h-screen">
        <div className="flex flex-col items-center justify-center h-screen pb-10">
          <FactoryView />
        </div>
      </main>
    </>
  );
}
```

### Step 8: Install dependencies and verify

```bash
pnpm install
pnpm build --filter=@feel-good/ui-factory
pnpm dev --filter=@feel-good/ui-factory
```

## Validation Commands

```bash
# TypeScript check
pnpm build --filter=@feel-good/ui-factory

# Lint check
pnpm lint --filter=@feel-good/ui-factory

# Full monorepo build (ensures no breaking changes)
pnpm build
```

## References

### Internal References

- Mirror root layout: `apps/mirror/app/layout.tsx`
- Mirror RootProvider: `apps/mirror/providers/root-provider.tsx`
- Mirror global styles: `apps/mirror/styles/globals.css`
- Font configuration: `apps/mirror/app/fonts/font.ts`
- UI package: `packages/ui/package.json`

### Related Files

- Workspace config: `pnpm-workspace.yaml`
- Turbo config: `turbo.json`
