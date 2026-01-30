# @feel-good/ui

Shared UI component library based on shadcn/ui primitives.

## Installation

Add to your app's dependencies:

```json
{
  "dependencies": {
    "@feel-good/ui": "workspace:*"
  }
}
```

## Usage

```typescript
// Import primitives
import { Button } from "@feel-good/ui/primitives/button";
import { Card } from "@feel-good/ui/primitives/card";
import { Dialog } from "@feel-good/ui/primitives/dialog";

// Import hooks
import { useMediaQuery } from "@feel-good/ui/hooks/use-media-query";

// Import providers
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";

// Import styles (in layout/app)
import "@feel-good/ui/styles.css";
```

## Structure

```
src/
├── primitives/       # shadcn/ui base components
├── components/       # Composed components
├── hooks/            # UI-related hooks
├── providers/        # Context providers (theme, etc.)
├── lib/              # Utilities (cn, etc.)
└── styles/           # Global CSS
```

## Available Primitives

Core primitives (50+ components):

- **Layout:** Card, Separator, Tabs, Accordion, Collapsible
- **Forms:** Button, Input, Textarea, Select, Checkbox, Switch, Radio Group, Slider
- **Feedback:** Alert, Progress, Skeleton, Spinner, Sonner (toast)
- **Overlays:** Dialog, Sheet, Drawer, Popover, Tooltip, Hover Card
- **Navigation:** Breadcrumb, Navigation Menu, Menubar, Pagination
- **Data:** Table, Chart, Calendar, Carousel

## Adding New Components

1. Create component in `src/primitives/` or `src/components/`
2. Add export to `package.json` exports field
3. Run `pnpm install` from monorepo root

## Dependencies

Uses Radix UI primitives, class-variance-authority, and Tailwind CSS.
