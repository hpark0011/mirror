# PRD: User Profile Onboarding for Mirror

## 1. Problem Statement

Mirror has no real user profiles. After authentication, users are redirected to a hardcoded mock profile (`/@rick-rubin`). The Convex backend has no `schema.ts` and no app-level `users` table — Better Auth manages its own internal user table (with `id`, `email`, `name`, `image`, `emailVerified`) inside its component namespace, but there's nowhere to store app-specific profile data like usernames or bios.

Users cannot:
- Choose a username
- Set a bio or avatar
- Have their own profile page at `/@{username}`

## 2. Solution Overview

1. **App-level `users` table** in Convex with profile fields (username, bio, avatar)
2. **Better Auth `onCreate` trigger** syncs new auth users to the app table on sign-up
3. **Blocking `/onboarding` route** with a 2-step wizard
4. **Middleware + onboarding page** enforce profile completion before app access
5. **Post-auth redirect** to `/@{username}` once the profile exists

## 3. Backend Architecture (Convex)

### 3.1 Schema

**New file:** `packages/convex/convex/schema.ts`

No schema file exists today — this is the first. Better Auth's tables live inside the component namespace and are unaffected.

```
users table:
  authId:             v.string()                    — links to Better Auth internal user ID
  email:              v.string()
  username:           v.optional(v.string())         — set during onboarding step 1
  name:               v.optional(v.string())
  bio:                v.optional(v.string())
  avatarStorageId:    v.optional(v.id("_storage"))   — Convex file storage reference
  onboardingComplete: v.boolean()                    — false until wizard finishes

indexes:
  by_authId:    ["authId"]
  by_email:     ["email"]
  by_username:  ["username"]
```

**Note:** Convex has no unique constraints. Username uniqueness is enforced transactionally inside the mutation (query index → check → insert/patch within a single mutation).

### 3.2 Auth Triggers

**Modified file:** `packages/convex/convex/auth.ts`

Add lifecycle triggers to `authComponent`:

| Trigger          | Action |
|------------------|--------|
| `user.onCreate`  | Insert app `users` row: `{ authId, email, onboardingComplete: false }` |
| `user.onUpdate`  | Sync `email` changes from auth user to app user |
| `user.onDelete`  | Delete app user row + delete avatar from `ctx.storage` if present |

The `@convex-dev/better-auth` package exposes these trigger hooks on the component client. Wire them up in `auth.ts` where `authComponent` is already created.

### 3.3 Mutations

**New file:** `packages/convex/convex/users.ts`

| Mutation                       | Args                                           | Returns          | Purpose |
|--------------------------------|------------------------------------------------|------------------|---------|
| `users.setUsername`            | `username: v.string()`                         | `v.null()`       | Validate format + uniqueness (via `by_username` index), patch user |
| `users.updateProfile`         | `bio: v.optional(v.string())`, `name: v.optional(v.string())` | `v.null()` | Update bio and/or name |
| `users.setAvatar`             | `storageId: v.id("_storage")`                  | `v.null()`       | Set `avatarStorageId`, delete old file if replacing |
| `users.completeOnboarding`    | (none — derives user from auth)                | `v.null()`       | Set `onboardingComplete = true` |
| `users.generateAvatarUploadUrl` | (none)                                       | `v.string()`     | Return a Convex upload URL via `ctx.storage.generateUploadUrl()` |

All mutations derive the current user via `authComponent.getAuthUser(ctx)` — no user ID is passed from the client.

### 3.4 Queries

**Same file:** `packages/convex/convex/users.ts`

| Query                      | Args                     | Returns                    | Purpose |
|----------------------------|--------------------------|----------------------------|---------|
| `users.getCurrentProfile`  | (none)                   | User object or `null`      | Get authenticated user's full profile (used by onboarding page to check completion) |
| `users.getByUsername`      | `username: v.string()`   | User object or `null`      | Public profile lookup for `/@{username}` routes |
| `users.isUsernameTaken`    | `username: v.string()`   | `v.boolean()`              | Real-time availability check (debounced from client) |

`getCurrentProfile` should also resolve the avatar URL via `ctx.storage.getUrl(avatarStorageId)` so the client doesn't need a separate call.

## 4. Frontend — Onboarding Flow (Mirror)

### 4.1 Route

**New file:** `apps/mirror/app/(protected)/onboarding/page.tsx`

The onboarding page is a protected route (requires auth). It contains the multi-step wizard.

### 4.2 Step 1 — Choose Username

- Text input with `@` prefix visual indicator
- Real-time availability check via `users.isUsernameTaken` (debounced, ~300ms)
- Validation rules:
  - Lowercase alphanumeric + hyphens only
  - 3–30 characters
  - Cannot start or end with a hyphen
  - Not in `RESERVED_USERNAMES` set (from `apps/mirror/lib/reserved-usernames.ts`)
- Add `"onboarding"` to the reserved usernames list
- "Continue" button calls `users.setUsername` mutation
- On success, advance to Step 2

### 4.3 Step 2 — Profile Details

- **Avatar upload**: Click-to-upload circle with preview
  - Flow: call `users.generateAvatarUploadUrl` → `POST` file to returned URL → call `users.setAvatar` with the returned `storageId`
  - Accept: `image/jpeg`, `image/png`, `image/webp`; max 5 MB
  - Show circular preview after upload
- **Bio textarea**: Optional, max 280 characters
- **"Complete" button**:
  1. Calls `users.updateProfile` (bio)
  2. Calls `users.completeOnboarding`
  3. Redirects to `/@{username}`
- "Skip" option available — still calls `completeOnboarding` without bio/avatar

### 4.4 Form Infrastructure

Use existing packages:
- `@feel-good/ui/primitives/form` for form components (Input, Textarea, Label, FormField)
- `react-hook-form` + `zod` for client-side validation (consistent with auth forms)

## 5. Middleware Updates

**Modified file:** `apps/mirror/middleware.ts`

### Current Flow

```
1. Authenticated + on auth page → redirect to /@rick-rubin
2. Unauthenticated + on protected page → redirect to /sign-in
```

### New Flow

```
1. Authenticated + on auth page → redirect to /onboarding
2. Unauthenticated + on protected page → redirect to /sign-in
3. Everything else → pass through
```

**Key decision: Option B (onboarding page handles redirect).**

Middleware runs on the edge and can only read session cookies — it cannot query Convex for profile completion state. Rather than adding complexity (custom cookies, JWT claims), the onboarding page itself handles the routing logic:

- Query `users.getCurrentProfile` on mount
- If `onboardingComplete === true` → redirect to `/@{username}`
- If `onboardingComplete === false` → show wizard at the appropriate step
- If no profile exists yet (trigger hasn't fired) → show loading, retry

This keeps middleware simple and avoids syncing state across two systems.

### Changes

| Constant/Logic | Before | After |
|---------------|--------|-------|
| `DEFAULT_AUTHENTICATED_REDIRECT` | `"/@rick-rubin"` | `"/onboarding"` |
| Public routes | `["/", "/sign-in", "/sign-up"]` | `["/", "/sign-in", "/sign-up"]` (unchanged) |
| Profile routes | `pathname.startsWith("/@")` is public | unchanged — profiles remain public |

## 6. Post-Auth Redirect Updates

### Auth Pages

**Modified files:**
- `apps/mirror/app/(auth)/sign-in/page.tsx`
- `apps/mirror/app/(auth)/sign-up/page.tsx`

Both currently use `MOCK_PROFILE.username` as the fallback redirect:
```typescript
const redirectTo = getSafeRedirectUrl(next, `/@${MOCK_PROFILE.username}`);
```

Change to:
```typescript
const redirectTo = getSafeRedirectUrl(next, "/onboarding");
```

Remove the `MOCK_PROFILE` import from both files.

### Onboarding Page Redirect Logic

```
On mount:
  1. Query users.getCurrentProfile
  2. If profile exists AND onboardingComplete === true:
       → router.replace(`/@${profile.username}`)
  3. If profile exists AND onboardingComplete === false:
       → Show wizard (determine step from profile state)
  4. If profile is null:
       → Show loading (trigger may not have fired yet), retry with short delay
```

## 7. Profile Route Updates

**Modified file:** `apps/mirror/app/[username]/layout.tsx` (and child pages)

### Current State

Profile pages use `MOCK_PROFILE` for all data. The `Profile` type is defined in `apps/mirror/features/profile/lib/mock-profile.ts`.

### Changes

1. Replace `MOCK_PROFILE` lookup with Convex query: `users.getByUsername(username)`
2. Extend the `Profile` type to include fields from the Convex user:
   ```
   Profile {
     userId: string
     username: string
     name: string
     bio: string
     avatarUrl: string | null    — resolved from avatarStorageId
     media: { video, poster }    — keep for backward compat, optional
   }
   ```
3. If query returns `null` → 404 page
4. Determine ownership: compare `session.user.id` with `profile.authId`
5. Owner sees edit controls; visitors see read-only profile

### Migration Path

Keep `MOCK_PROFILE` as a fallback during development. Remove once real profiles are working end-to-end.

## 8. Existing Code to Reuse

| Asset | Location | Usage |
|-------|----------|-------|
| Form components | `@feel-good/ui/primitives/form` | Onboarding wizard form fields |
| Redirect validation | `@feel-good/features/auth/utils/validate-redirect.ts` | `getSafeRedirectUrl` for post-auth redirects |
| Reserved usernames | `apps/mirror/lib/reserved-usernames.ts` | Username validation (add `"onboarding"` to the set) |
| Profile type | `apps/mirror/features/profile/lib/mock-profile.ts` | Extend for real profiles |
| Session hook | `packages/features/auth/hooks/use-session.ts` | `createUseSession` for auth state in onboarding |
| Auth component client | `packages/convex/convex/auth.ts` | `authComponent` for triggers and `getAuthUser` |

## 9. Key Technical Constraints

1. **Better Auth's `username` plugin requires password auth** — not compatible with magic-link/OTP flow. This is why we use an app-level table instead.
2. **No Convex schema exists yet** — `packages/convex/convex/schema.ts` must be created from scratch. Better Auth tables are managed by the component and do not appear in app schema.
3. **`@convex-dev/better-auth` triggers** (`onCreate`/`onUpdate`/`onDelete`) are the documented pattern for syncing auth events to app tables.
4. **Convex has no unique constraints** — username uniqueness is enforced via index + transactional mutation check (query `by_username` index, verify no match, then patch — all within one mutation).
5. **Convex file storage** uses a 3-step flow: generate upload URL → `POST` file to URL → save returned `storageId` to the document. Retrieve display URLs via `ctx.storage.getUrl(storageId)`.
6. **Middleware cannot query Convex** — it runs on the edge with only cookie access. Profile completion checks happen client-side on the onboarding page.

## 10. Files Created/Modified Summary

### New Files
| File | Purpose |
|------|---------|
| `packages/convex/convex/schema.ts` | Convex schema with `users` table |
| `packages/convex/convex/users.ts` | User queries and mutations |
| `apps/mirror/app/(protected)/onboarding/page.tsx` | Onboarding wizard page |
| `apps/mirror/features/onboarding/` | Onboarding feature module (components, hooks) |

### Modified Files
| File | Change |
|------|--------|
| `packages/convex/convex/auth.ts` | Add `onCreate`/`onUpdate`/`onDelete` triggers |
| `apps/mirror/middleware.ts` | Change redirect target to `/onboarding` |
| `apps/mirror/app/(auth)/sign-in/page.tsx` | Change fallback redirect to `/onboarding` |
| `apps/mirror/app/(auth)/sign-up/page.tsx` | Change fallback redirect to `/onboarding` |
| `apps/mirror/app/[username]/layout.tsx` | Replace mock profile with Convex query |
| `apps/mirror/lib/reserved-usernames.ts` | Add `"onboarding"` to reserved set |
| `apps/mirror/features/profile/lib/mock-profile.ts` | Extend `Profile` type for real data |

## 11. Out of Scope

- Profile editing after onboarding (separate feature)
- Social graph (followers/following)
- Profile SEO / Open Graph metadata
- Email change flow (username re-derivation)
- Account deletion UI
- Admin moderation of usernames
