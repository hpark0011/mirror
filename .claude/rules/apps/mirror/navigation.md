---
paths:
  - "apps/mirror/hooks/use-profile-navigation-effects.ts"
  - "apps/mirror/styles/globals.css"
  - "apps/mirror/app/[username]/**"
---

# Mirror Navigation Transitions

## Architecture

Profile routes (`/@username`, `/@username/slug`) use CSS View Transitions for directional slide animations.

### How it works

1. `useProfileNavigationEffects` detects forward/back navigation via pathname changes
2. Sets `data-nav-direction="forward"|"back"` on `<html>`
3. `<ViewTransition name="profile-content">` in `ProfileShell` wraps route content
4. CSS rules in `globals.css` key slide animations off `data-nav-direction`
5. Cleanup deletes `data-nav-direction` on the next pathname change

### View transition groups

| Name | Element | Purpose |
|------|---------|---------|
| `profile-content` | Route content wrapper in ProfileShell | Directional slide (forward/back) |
| `profile-toolbar` | Toolbar views (list + detail) | Cross-fade between toolbar states |
| `article-body` | RichTextViewer wrapper in ArticleDetailView | Isolated from slide — suppresses re-animation from lazy chunk load |
| `root` | Default | Suppressed (`animation: none`) to prevent navbar cross-fade |

### Lazy content isolation

`next/dynamic` chunk resolution triggers a React transition. Any ancestor `<ViewTransition>` re-animates content that changed. To prevent double-animation, lazy-loaded content gets its own `view-transition-name` with `animation: none`, carving it out of the parent transition group.

Pattern: wrap the dynamic component in a stable container with an isolated view-transition-name.
