# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `pnpm dev` - Start development server with Turbopack at http://localhost:3000
- `pnpm build` - Build the production application
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint to check code quality

### Package Management

Use `pnpm` for all package operations (not npm, yarn, or bun).

## Architecture

### Tech Stack

- **Next.js 15.4.7** with App Router
- **React 19** with React Compiler
- **TypeScript 5** with strict configuration
- **Tailwind CSS 4** for styling
- **shadcn/ui components** with Radix UI primitives (New York style)
- **React Hook Form 7.62 + Zod 4.0** for forms and validation
- **TanStack Query 5.85** for data fetching and caching
- **@dnd-kit** for drag-and-drop functionality
- **next-themes** for dark/light mode support

### Project Structure

- `/app` - Next.js App Router pages and layouts
- `/components/ui` - shadcn/ui components (pre-configured with New York style)
- `/components/providers` - React context providers (root-provider, react-query, theme)
- `/components/trello` - Trello board implementation with drag-and-drop
- `/lib` - Utility functions and shared logic
- `/hooks` - Custom React hooks
- `/icons` - Custom SVG icon library (100+ icons with TypeScript support)
- `/PRPs` - Product Requirements Plans for features

### Path Aliases

- `@/*` maps to the project root
- Common imports: `@/components`, `@/lib/utils`, `@/hooks`

## Development Principles

### Core Principles

- **KISS**: Keep solutions simple and straightforward
- **YAGNI**: Build only what's needed now
- **Clear separation of concerns**: Don't mix different concerns in one function
- **Performance**: Fast startup, responsive UI, optimistic updates
- **Privacy**: Data encryption and user control

### Component Patterns

- **Compound components** with `data-slot` attributes for identification
- **Class Variance Authority (CVA)** for variant-based styling
- **Radix UI Slot pattern** for flexible composition
- All UI components use shadcn/ui with Radix UI primitives
- Components are already installed in `/components/ui`
- Use `cn()` utility from `@/lib/utils` for className management (combines clsx + tailwind-merge)

### Icons

- **Primary**: Lucide React (configured as default in components.json)
- **Custom SVG icons**: Available in `/icons` directory with TypeScript exports
- Icon component at `/components/ui/icon.tsx` for custom SVG icons
- SVGR webpack configuration for importing SVGs as React components

### Forms and Validation

- Use React Hook Form for all form handling
- Use Zod for schema validation
- Form components available at `@/components/ui/form`
- Pattern: Define Zod schema → infer TypeScript types → use with useForm

### Styling

- Tailwind CSS 4 with CSS variables for theming
- Global styles in `/app/globals.css`
- Component styles use `cn()` utility from `@/lib/utils`
- Theme tokens defined as CSS variables in `:root` and `.dark`
- Container queries support enabled

### Provider Architecture

- All providers composed in `/components/providers/root-provider.tsx`
- Includes: TanStack Query client, Theme provider, Toast notifications (sonner)
- Root layout wraps app with `<RootProvider>`

## Current Features

### Trello Board Implementation

- Located in `/components/trello/`
- Four columns: "Backlog", "To Do", "In Progress", "Complete"
- Drag-and-drop between columns using @dnd-kit
- Ticket CRUD operations with modal forms
- TypeScript interfaces in `types.ts`
- Local state management (ready for API integration)

## Feature Development

### Feature Flag System (Planned)

A PRP exists at `/PRPs/feature-flag-system.md` for implementing an environment-variable-based feature flag system using TypeScript without additional dependencies.

### Environment Variables

- Client-side variables must use `NEXT_PUBLIC_` prefix
- Server-side variables don't need the prefix
- Define in `.env.local` for development

### Next.js Configuration

- Standalone output mode for containerization
- Custom webpack config for SVG handling with @svgr/webpack
- Turbopack enabled for fast development builds
