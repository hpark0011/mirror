---
id: FG_019
title: "Onboarding wizard step 2 supports avatar upload and bio"
date: 2026-02-24
type: feature
status: to-do
priority: p1
description: "Add step 2 to the onboarding wizard with avatar upload via Convex file storage (3-step flow: generate URL, POST file, save storageId) and optional bio textarea. Complete button saves profile, marks onboarding complete, and redirects to /@{username}. Skip option calls completeOnboarding without bio/avatar."
dependencies:
  - FG_016
  - FG_018
parent_plan_id: docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md
acceptance_criteria:
  - "Step 2 renders after username is set, showing avatar upload circle and bio textarea"
  - "Avatar upload follows Convex 3-step flow: generateAvatarUploadUrl → POST file → setAvatar with storageId"
  - "Avatar upload accepts only image/jpeg, image/png, image/webp and rejects files over 5 MB"
  - "Complete button calls updateProfile (bio), then completeOnboarding, then redirects to `/@{username}`"
  - "Skip button calls completeOnboarding without saving bio/avatar and redirects to `/@{username}`"
  - "`pnpm build --filter=@feel-good/mirror` succeeds with no type errors"
owner_agent: "React Frontend Engineer"
---

# Onboarding wizard step 2 supports avatar upload and bio

## Context

Step 1 (FG_018) handles username selection. Step 2 collects optional profile details: avatar image and bio text. The avatar uses Convex file storage, which requires a 3-step upload flow documented in `.claude/rules/convex.md`.

Backend mutations from FG_016:
- `users.generateAvatarUploadUrl` — returns a signed upload URL
- `users.setAvatar` — saves the storageId to the user row
- `users.updateProfile` — saves bio and/or name
- `users.completeOnboarding` — marks `onboardingComplete = true`

## Goal

Users can optionally upload an avatar and write a bio before completing onboarding. The step is skippable — users who don't want to customize can proceed directly to their profile.

## Scope

- Create `apps/mirror/features/onboarding/components/profile-step.tsx` — step 2 UI
- Create `apps/mirror/features/onboarding/hooks/use-avatar-upload.ts` — encapsulates the 3-step Convex file upload
- Wire step 2 into the existing `onboarding-wizard.tsx` from FG_018
- Bio textarea with 280-character limit
- Skip functionality

## Out of Scope

- Image cropping or resizing (upload as-is)
- Drag-and-drop upload (click-to-upload only)
- Avatar removal (only set or replace)
- Profile editing after onboarding (separate feature)

## Approach

The avatar upload hook encapsulates the 3-step Convex storage flow:
1. Call `users.generateAvatarUploadUrl` mutation to get a signed URL
2. `POST` the file to that URL (returns a `storageId` in the response)
3. Call `users.setAvatar` with the `storageId`

The UI shows a circular placeholder that opens a file picker on click. After upload, show the image preview in the circle. Bio is a simple textarea with character count.

The "Complete" button sequence: `updateProfile({ bio })` → `completeOnboarding()` → `router.replace(\`/@${username}\`)`. The "Skip" button: `completeOnboarding()` → redirect.

- **Effort:** Medium
- **Risk:** Medium — Convex file storage upload flow needs to handle errors (upload failure, invalid file type)

## Implementation Steps

1. Create `apps/mirror/features/onboarding/hooks/use-avatar-upload.ts` — hook that manages upload state (idle/uploading/done/error) and exposes `upload(file)` function
2. Create `apps/mirror/features/onboarding/components/profile-step.tsx` — avatar circle with file input, bio textarea, complete + skip buttons
3. Wire profile-step into `onboarding-wizard.tsx` as step 2 (rendered when username exists but `onboardingComplete` is false)
4. Add file type validation (accept attribute + JS check for `image/jpeg`, `image/png`, `image/webp`)
5. Add file size validation (reject > 5 MB with error message)
6. Handle the complete flow: save bio → mark complete → redirect
7. Handle the skip flow: mark complete → redirect (no bio/avatar save)
8. Run `pnpm build --filter=@feel-good/mirror`

## Constraints

- Avatar upload must use the Convex 3-step pattern (no direct storage writes from client)
- File size limit: 5 MB
- Accepted types: `image/jpeg`, `image/png`, `image/webp`
- Bio max length: 280 characters
- Follow existing form patterns (react-hook-form + zod for bio validation)
- Feature files go in `apps/mirror/features/onboarding/`

## Resources

- PRD: `docs/plans/2026-02-24-feat-user-profile-onboarding-prd.md` (Section 4.3)
- Convex file storage: `.claude/rules/convex.md` (File storage guidelines)
- Onboarding wizard: `apps/mirror/features/onboarding/components/onboarding-wizard.tsx` (from FG_018)
