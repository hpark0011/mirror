# @feel-good/features

Shared feature components across Feel Good apps.

## Installation

Add to your app's dependencies:

```json
{
  "dependencies": {
    "@feel-good/features": "workspace:*"
  }
}
```

## Auth Feature

Authentication components and utilities using Better Auth with Convex.

### Auth Package Layers

| Layer | Import | Purpose |
|-------|--------|---------|
| Blocks | `@feel-good/features/auth/blocks` | Drop-in page sections |
| Forms | `@feel-good/features/auth/components/forms` | Complete forms with logic |
| Views | `@feel-good/features/auth/views` | Pure UI components |
| Hooks | `@feel-good/features/auth/hooks` | Headless auth logic |

### Quick Start (Blocks)

```typescript
import { LoginBlock } from "@feel-good/features/auth/blocks"
import { authClient } from "@/lib/auth-client"

export default function LoginPage() {
  return <LoginBlock authClient={authClient} />
}
```

### Hooks

```typescript
import {
  useMagicLinkRequest,
  useOTPAuth,
  createUseSession,
} from "@feel-good/features/auth/hooks";
```

### Client/Server Utilities

```typescript
// Client-side auth
import { getAuthClient } from "@feel-good/features/auth/client";

// Server-side auth
import { auth } from "@feel-good/features/auth/server";

// Types
import type { AuthSession, AuthUser, AuthError, AuthStatus } from "@feel-good/features/auth/types";
```

## Structure

```
auth/
├── blocks/               # Layer 1: Page sections
│   ├── login-block.tsx
│   ├── sign-up-block.tsx
│   └── shared/           # Layout helpers
├── components/
│   ├── forms/            # Layer 2: Container components
│   └── shared/           # Shared pieces
├── views/                # Layer 3: Pure UI components
├── hooks/                # Layer 4: Headless logic
├── lib/schemas/          # Zod validation schemas
├── utils/                # Auth utilities
├── client.ts             # Client-side auth setup
├── server.ts             # Server-side auth setup
├── types.ts              # TypeScript types
└── index.ts              # Barrel export
```

## Adding New Features

1. Create feature directory in package root (e.g., `notifications/`)
2. Add barrel export in `index.ts`
3. Update `package.json` exports field
4. Run `pnpm install` from monorepo root

## Dock Feature

macOS-style application dock for navigating between apps. Features auto-hide behavior, smooth animations, and a layered architecture.

### Dock Package Layers

| Layer | Import | Purpose |
|-------|--------|---------|
| Blocks | `@feel-good/features/dock/blocks` | Drop-in dock with all behavior built-in |
| Components | `@feel-good/features/dock/components` | Individual UI primitives for custom composition |
| Hooks | `@feel-good/features/dock/hooks` | Headless logic for visibility and config management |
| Providers | `@feel-good/features/dock/providers` | Context providers for state management |
| Lib | `@feel-good/features/dock/lib` | Types and validation schemas |

### Quick Start (Blocks)

```typescript
import { AppDock } from "@feel-good/features/dock/blocks";
import { HomeIcon, SettingsIcon } from "@feel-good/icons";

const dockConfig = {
  placement: "bottom",
  defaultAppId: "home",
  apps: [
    { id: "home", name: "Home", icon: HomeIcon, route: "/", order: 1 },
    { id: "settings", name: "Settings", icon: SettingsIcon, route: "/settings", order: 2 },
  ],
};

export default function Layout({ children }) {
  return (
    <>
      {children}
      <AppDock config={dockConfig} onAppClick={(appId) => console.log(appId)} />
    </>
  );
}
```

### Components

```typescript
import {
  DockRoot,
  DockContainer,
  DockItem,
  DockIcon,
} from "@feel-good/features/dock/components";
```

### Hooks

```typescript
import {
  useDock,
  useDockConfig,
  useDockVisibility,
} from "@feel-good/features/dock/hooks";
```

### Providers

```typescript
import { DockProvider, useDock } from "@feel-good/features/dock/providers";
```

### Types and Schemas

```typescript
import type {
  DockConfig,
  DockApp,
  DockPlacement,
  DockState,
  DockContextValue,
} from "@feel-good/features/dock/lib";

import {
  dockConfigSchema,
  dockAppSchema,
  dockPlacementSchema,
} from "@feel-good/features/dock/lib";
```

## Structure

```
dock/
├── blocks/               # Layer 1: Drop-in dock
│   └── app-dock.tsx
├── components/           # Layer 2: UI primitives
│   ├── dock-root.tsx
│   ├── dock-container.tsx
│   ├── dock-item.tsx
│   └── dock-icon.tsx
├── hooks/                # Layer 3: Headless logic
│   ├── use-dock-config.ts
│   └── use-dock-visibility.ts
├── providers/            # Layer 4: State management
│   └── dock-provider.tsx
├── lib/                  # Types and schemas
│   ├── types.ts
│   └── schemas/
└── index.ts              # Barrel export
```

## Editor Feature

Rich text viewer components powered by Tiptap. Used by Mirror for article rendering and Greyboard Desktop for document viewing.

### Imports

```typescript
// Components
import { MarkdownViewer, RichTextViewer } from "@feel-good/features/editor/components";

// Lib (extensions, sanitization, plain text extraction)
import { extensions, sanitizeContent, getPlainText } from "@feel-good/features/editor/lib";

// Types
import type { EditorTypes } from "@feel-good/features/editor/types";

// Styles (import in your app's global CSS or layout)
import "@feel-good/features/editor/styles/tiptap-content.css";
```

### Structure

```
editor/
├── components/           # Viewer components
│   ├── markdown-viewer.tsx
│   └── rich-text-viewer.tsx
├── lib/                  # Tiptap extensions, sanitization, text extraction
│   ├── extensions.ts
│   ├── sanitize-content.ts
│   └── get-plain-text.ts
├── styles/
│   └── tiptap-content.css
├── types.ts
└── index.ts
```

## Theme Feature

Theme toggle components for light/dark mode switching.

### Imports

```typescript
import { ThemeToggleButton } from "@feel-good/features/theme/components";
```

### Structure

```
theme/
├── components/
│   └── theme-toggle-button.tsx
└── index.ts
```

## Dependencies

- `@feel-good/ui` - UI components
- `@feel-good/icons` - Icons (GoogleIcon)
- `better-auth` - Authentication library
- `@convex-dev/better-auth` - Convex adapter
- `convex` - Real-time backend
- `zod` - Validation schemas
- `@tiptap/react` - Rich text editor (editor feature)
