---
name: Composition Pattern
category: Component Organization
applies_to: [components, features]
updated: 2025-01-21
documented_in: CLAUDE.md
---

# Feature Component Organization Pattern

Atomic component architecture with feature-based naming. Each component handles one specific aspect of the feature.

## Rules (Canonical)

| Rule | Requirement |
|------|-------------|
| Naming | `{feature}-{name}.tsx` → `FeatureName` (PascalCase function) |
| Props | Always define `ComponentNameProps` interface |
| Exports | Named exports only (`export function`, not `export default`) |
| Responsibility | One component = one purpose |
| Client directive | `"use client"` only for: state, hooks, DOM APIs, event handlers |
| Early returns | `if (!data) return null;` before main render |
| Type safety | No `any`; use tRPC types, proper interfaces |

## Component Categories

| Type | Has State | Client Directive | Use Case | Example |
|------|-----------|------------------|----------|---------|
| Presentational | No | No | Display-only, no side effects | `ProfileName`, `ProfileBio` |
| Container | UI state only | Yes | Composes children, manages dialogs/modals | `ProfileHeader`, `ProfileSocials` |
| Interactive/Form | Yes | Yes | User input, form state, mutations | `EditProfileForm`, `ProfileChatInput` |
| Utility/Wrapper | Side effects | Yes | DOM manipulation, providers, analytics | `ProfileBackgroundWrapper` |

### Code Examples

```typescript
// Presentational (server component)
interface ProfileNameProps {
  name: string;
}

export function ProfileName({ name }: ProfileNameProps) {
  return <h1>{name}</h1>;
}
```

```typescript
// Container (client component)
"use client";

export function ProfileHeader({ slug, name }: ProfileHeaderProps) {
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  return (
    <>
      <ProfileWarning slug={slug} />
      <ProfileShareSheet open={shareSheetOpen} onOpenChange={setShareSheetOpen} />
    </>
  );
}
```

```typescript
// Interactive/Form (client component)
"use client";

export function EditProfileForm({ profile, slug }: EditProfileFormProps) {
  const form = useForm({ defaultValues: { name: profile.name } });
  return <Form {...form}>{/* fields */}</Form>;
}
```

```typescript
// Utility/Wrapper (client component)
"use client";

export function ProfileBackgroundWrapper({ children }: Props) {
  useEffect(() => {
    document.documentElement.classList.add("profile-page-bg");
    return () => document.documentElement.classList.remove("profile-page-bg");
  }, []);
  return <>{children}</>;
}
```

## Directory Structure

| Structure | When to Use |
|-----------|-------------|
| Flat: `{feature}-{name}.tsx` | < 3 related files |
| Folder: `feature-family/` | 3+ files: main + sub-components, config, types, hooks |

```
features/{feature-name}/
  components/
    {feature}-{name}.tsx              # Flat (standalone)
    feature-family/                   # Folder (3+ related files)
      feature-family.tsx              # Main component
      feature-family-item.tsx         # Sub-component
      feature-family.config.ts        # Config
      index.ts                        # export { FeatureFamily } from "./feature-family"
  views/
    {feature}-view.tsx                # Main composition point
  hooks/
    use-{feature}-{hook-name}.tsx
```

**Real examples:**
- `project-select/` — Main + menu items + dialogs + color indicator
- `sub-tasks/` — List + rows + editor + 10 sub-components + types
- `ticket-card/` — Card + timer + toolbar + tag + form dialog + config

## Composition Pattern

Compose in `views/{feature}-view.tsx`:

```typescript
import { FeatureComponentA } from "../components/feature-component-a";
import { FeatureComponentB } from "../components/feature-component-b";

export default function FeatureView({ data }: FeatureViewProps) {
  return (
    <div>
      <FeatureComponentA prop={data.propA} />
      <FeatureComponentB prop={data.propB} />
    </div>
  );
}
```

Import from `components/`, compose in view, pass props down.

## Component Template

```typescript
// 1. Imports (external → internal)
import { ExternalLib } from "external-lib";
import { LocalComponent } from "./local-component";

// 2. Types (if needed)
type SomeType = RouterOutputs["feature"]["getData"];

// 3. Props interface
interface ComponentNameProps {
  requiredProp: string;
  optionalProp?: number;
}

// 4. Component
export function ComponentName({ requiredProp, optionalProp }: ComponentNameProps) {
  if (!requiredProp) return null;

  const processedData = processData(requiredProp);

  return <div>{/* JSX */}</div>;
}
```

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| `profile/header/header.tsx` (single-file folder) | `profile-header.tsx` OR `profile-header/` (3+ files) |
| `button.tsx` (generic name) | `profile-button.tsx` (feature prefix) |
| Display + edit in one file | `profile-bio.tsx` + `edit-profile-bio.tsx` |
| `props: any` | `interface ComponentProps { ... }` |
| `"use client"` everywhere | Client only for state/hooks/DOM |

## Checklist

Before committing, verify against **Rules (Canonical)** table above.

- [ ] All rules followed
- [ ] Correct component category chosen
- [ ] Composed in parent view (not nested folders)
