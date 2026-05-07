---
id: PLAN_006
slug: rename-users-bio-to-tagline
title: "Rename users.bio → users.tagline"
date: 2026-05-06
type: migration
status: completed
branch: chore/rename-users-bio-to-tagline
worktree: null
scope: "Rename the profile-level one-liner field from bio to tagline across schema, Convex queries/mutations, the clone-chat system prompt, and every Mirror UI consumer. Backfill existing rows. No changes to bioEntries (structured Bio tab data)."
apps: [mirror]
packages: [convex]
verification_tier: 5
---

> **Predecessor of:** `feature-bio-pull-up` — that branch's e2e is currently blocked by this naming collision; rebase + re-run after this lands.

## Why

`feature-bio-pull-up` adds an `openBio` agent tool that opens the structured Bio tab in the visitor's right panel. The e2e for it fails because the system prompt also injects `users.bio` (a freeform one-liner) as `Bio: <text>`, giving the LLM the answer in context — when the visitor says "show me your bio", the model rephrases the inline one-liner instead of calling `openBio`. The two are conceptually different ("profile tagline" vs "structured CV-style entries on a tab") but share the same name.

This plan resolves the collision at the schema level. After the rename:
- The system prompt injects `Tagline: <text>` (or whatever label we pick — see Step 5b).
- The `openBio` tool is the only "bio"-named verb in the system, with no competing in-context content.
- `bioEntries` keeps its name (it's accurate — these *are* bio entries; the conflict was always with `users.bio`).

A debugging session in worktree `feature-bio-pull-up` walked three iterations of prompt-strengthening and one RAG-bio-filter fix and confirmed the inline `users.bio` is the remaining content path the LLM uses to defeat `openBio`. Investigator transcript referenced in `workspace/plans/2026-05-06-bio-agent-parity-plan.md` § Where we are.

---

## Migration approach: widen → backfill → narrow inside ONE PR

The user chose "in-place rename." In Convex this practically means **two commits inside one PR** because schema validation rejects either the old field on rows after a strict rename, or the new field before backfill. The two commits stay close together so reviewers see them as one logical change.

**Why not literally one commit:** if commit 1 removes `bio` from the schema in the same step that adds `tagline`, the deploy fails — existing rows have `bio` and the schema validator rejects them. Convex offers `schemaValidation: false` to bypass, but that's a sharp tool we don't need.

**Two-commit shape:**

| Commit | What | Deploy state |
|---|---|---|
| C1 — widen + switch | Add `tagline: v.optional(v.string())` alongside existing `bio: v.optional(v.string())` in schema; backfill copies `bio` → `tagline` for every user; ALL read sites switch to `tagline`; the `bio` field stays in schema but is no longer read. | Both fields exist; new field is the source of truth. |
| C2 — narrow | Remove `bio` from schema; add a one-shot mutation that clears any remaining `bio` values (so the schema-validation drop step succeeds). | Only `tagline` remains. |

The PR is mergeable after C2. C1 can be deployed independently for safety; C2 follows after backfill is confirmed clean.

---

## Touch surface (verified via grep on `feature-bio-pull-up` worktree, 2026-05-06)

**Convex backend (8 files):**

| File | What it does | Change |
|---|---|---|
| `packages/convex/convex/users/schema.ts:9` | `bio: v.optional(v.string())` | C1: add `tagline` alongside. C2: remove `bio`. |
| `packages/convex/convex/users/helpers.ts:21,44` | Two validator shapes that include `bio` (likely `userPublicProfileValidator` + a sibling) | C1: add `tagline` field to both, keep `bio` (so existing callers don't break mid-deploy). C2: drop `bio`. |
| `packages/convex/convex/users/queries.ts:38,67` | Returns `bio: appUser.bio` in two queries (`getByUsername` + `getViewer`-style) | C1: return BOTH `bio` and `tagline` (compat). C2: drop `bio`. |
| `packages/convex/convex/users/mutations.ts:63,71` | `updateProfile` args validator + patch | C1: add `tagline` arg, switch patch logic to write `tagline` (still accept `bio` as a deprecated alias if needed). C2: drop `bio`. Verify the existing callers in `profile-info.tsx` switch in C1. |
| `packages/convex/convex/chat/helpers.ts:157,192-194,285` | `composeSystemPrompt`'s `bio?` option + the inline injection + the `loadStreamingContext` caller | C1: rename option to `tagline`; injection becomes `Tagline: <text>` (final wording — see Step 5b). |
| `packages/convex/convex/chat/__tests__/helpers.test.ts` (lines that pin "One-line summary about you:") | Test assertions on the injection label | C1: update to whatever label we pick. |
| `packages/convex/convex/users/__tests__/queries.test.ts` and `…/mutations.test.ts` | Validator + return-shape assertions | C1: extend with `tagline` cases. C2: drop `bio` cases. |
| (NEW) `packages/convex/convex/users/migrations.ts` (or `users/backfill.ts`) | One-shot `internalMutation` `backfillTaglineFromBio` | C1: created. C2: removed (or left as harmless no-op). |

**Mirror app (~9 files):**

| File | What it does | Change |
|---|---|---|
| `apps/mirror/app/[username]/layout.tsx:31,75` | Page metadata `description = profile.bio \|\| ...` + profile data passing | C1: switch to `profile.tagline`. |
| `apps/mirror/features/profile/types.ts:20` | `bio: string` field on the local Profile type | C1: rename to `tagline`. |
| `apps/mirror/features/profile/components/profile-info.tsx` (6 references) | Form schema, optimistic update, render — `profile.bio`, `EditableBio bio={...}` | C1: rename throughout, including the form field name (RHF cares about field names). Update the optimistic-update payload shape. |
| `apps/mirror/features/profile/components/editable-bio.tsx` | The component with `bio` prop | C1: rename file → `editable-tagline.tsx`, rename component → `EditableTagline`, rename prop. Update import in `profile-info.tsx`. |
| `apps/mirror/features/profile/hooks/use-profile-data.ts:25` | `bio: reactiveProfile.bio ?? ""` | C1: rename to `tagline`. |
| `apps/mirror/features/profile/index.ts` | Barrel exports | C1: re-export `EditableTagline` instead of `EditableBio` (if it's exported — verify via grep; today only `ProfileInfo` is exported, so this may be a no-op). |
| Form schema file (if separate) — `apps/mirror/features/profile/lib/schemas/*` | Zod schema for profile edit form | C1: rename field. |
| `apps/mirror/app/(protected)/onboarding/...` (if it sets bio) | Onboarding profile setup | C1: pre-flight `grep -rn "\\.bio\b" apps/mirror/app/` to confirm whether onboarding writes this field. If yes, rename. |
| `apps/mirror/e2e/...` specs that exercise the profile field | E2E coverage | C1: rename test fixtures + assertions. |

**Tests & seeds:**
- `packages/convex/convex/seed.ts` — `ensureRickRubinUser` sets `bio: "Rick Rubin has been a singular..."` at line ~200. C1: rename to `tagline`. (Re-seeding rick-rubin after C1 deploy is a one-line CLI invocation.)
- Any test that asserts `profile.bio` as a return shape.

**Pre-flight check before starting:** the touch list above was generated from `feature-bio-pull-up`'s tree on 2026-05-06. Re-run these greps from `main` at branch-start to catch any drift:

```bash
grep -rn "\.bio\b\|users\.bio\|user\.bio\|bio: v\.\|bio?:" packages/convex/convex/ apps/mirror/ \
  | grep -v "node_modules\|_generated\|\.test\.\|bioEntries\|test-results\|\.next\|dist/"
```

Also `grep -rn "EditableBio\|profile\.bio\|reactiveProfile\.bio" apps/mirror/`.

---

## Implementation steps

### Step 1 — Branch from main, run the pre-flight grep

```bash
git checkout main && git pull
git checkout -b chore/rename-users-bio-to-tagline
# Run the greps above; if they find files NOT in the touch list, expand the list.
```

If the touch surface drifted (e.g., a new feature in main also reads `users.bio`), surface those callers in the PR description.

### Step 2 — Commit 1: widen schema + backfill + switch reads

Order within the commit (do all of these together so the deploy is atomic):

**2a. Schema** (`packages/convex/convex/users/schema.ts:9`)

```ts
// Before
bio: v.optional(v.string()),

// After (C1)
bio: v.optional(v.string()),       // deprecated; removed in C2 once backfill confirmed
tagline: v.optional(v.string()),   // new — profile-level one-liner used as persona signal
```

Add a comment line above `tagline`:

```ts
// Profile-level one-line description. Distinct from the structured
// `bioEntries` table (the Bio tab in the content panel). The clone-chat
// system prompt injects this verbatim as the persona-voice signal; the
// agent's `openBio` tool is what surfaces the bio panel for visitors.
// See `chat/helpers.ts:composeSystemPrompt` and `.claude/rules/embeddings.md`.
tagline: v.optional(v.string()),
```

**2b. Helpers / validators** (`packages/convex/convex/users/helpers.ts:21,44`)

Add `tagline: v.optional(v.string())` to both validator shapes. Keep `bio` for now.

**2c. Queries** (`packages/convex/convex/users/queries.ts:38,67`)

Both query return shapes get `tagline: appUser.tagline`. Keep `bio: appUser.bio` for the C1 commit so any in-flight client cached query stays valid for one deploy. Drop `bio` in C2.

**2d. Mutations** (`packages/convex/convex/users/mutations.ts:63,71`)

```ts
// args validator
args: {
  name: v.optional(v.string()),
  bio: v.optional(v.string()),       // deprecated alias; remove in C2
  tagline: v.optional(v.string()),
  // ... others
}

// handler — write `tagline`; if a legacy client still sends `bio`, treat it as tagline
const taglineToWrite = args.tagline ?? args.bio;
await ctx.db.patch(appUser._id, {
  ...(args.name !== undefined ? { name: args.name } : {}),
  ...(taglineToWrite !== undefined ? { tagline: taglineToWrite } : {}),
  // ... others
});
```

The dual-acceptance is purely for the C1 deploy window. C2 drops the `bio` arg.

**2e. Backfill mutation** (NEW: `packages/convex/convex/users/migrations.ts`)

```ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * One-shot backfill: copy every user's `bio` value into `tagline`. Idempotent —
 * if `tagline` is already set, leave it alone and don't overwrite from `bio`.
 * Run once after C1 deploys; safe to re-run.
 *
 * Removed (or left as a no-op) in C2 once `bio` is dropped from the schema.
 */
export const backfillTaglineFromBio = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    let skipped = 0;
    for (const u of users) {
      if (u.tagline !== undefined && u.tagline !== null && u.tagline !== "") {
        skipped++;
        continue;
      }
      if (u.bio === undefined || u.bio === null || u.bio === "") {
        skipped++;
        continue;
      }
      await ctx.db.patch(u._id, { tagline: u.bio });
      updated++;
    }
    return { updated, skipped };
  },
});
```

After C1 deploys, run:

```bash
cd packages/convex && npx convex run users.migrations.backfillTaglineFromBio
```

Confirm `{ updated: <N>, skipped: 0 }` (or skipped only for empty-bio users).

**2f. Chat helpers** (`packages/convex/convex/chat/helpers.ts`)

```ts
// composeSystemPrompt opts (line 157)
// Before:
bio?: string | null;
// After:
tagline?: string | null;

// Inline injection (lines 192-194). Pick label:
//   - "Tagline: ${tagline}"          — neutral, matches schema field name
//   - "About this person: ${tagline}" — more conversational
// RECOMMENDATION: "Tagline: …" — tightest mapping to schema; the LLM
// won't conflate it with "show me your bio" since the word changed.
if (opts.tagline) {
  truncatable.push(`Tagline: ${opts.tagline}`);
}

// Caller in loadStreamingContext (line 285):
// Before:
bio: profileOwner.bio,
// After:
tagline: profileOwner.tagline ?? profileOwner.bio ?? null, // C1 fallback for any pre-backfill row
```

The fallback `?? profileOwner.bio` is a one-deploy safety net; remove in C2.

Update `chat/__tests__/helpers.test.ts` line 46 + line 245 to match the new label literal — they currently pin "One-line summary about you:" (set by a debug fix-iter in `feature-bio-pull-up`); update to "Tagline:".

**2g. Mirror app — type + hook** (`apps/mirror/features/profile/types.ts:20`, `…/use-profile-data.ts:25`)

```ts
// types.ts
type Profile = {
  // ...
  tagline: string;  // was: bio
};

// use-profile-data.ts
tagline: reactiveProfile.tagline ?? "",
```

**2h. Mirror app — profile-info form** (`apps/mirror/features/profile/components/profile-info.tsx`)

Six references (73, 87, 94, 96, 125, 173). Rename throughout:
- Form default values: `tagline: profile.tagline ?? ""`.
- Form reset: `form.reset({ name: profile.name ?? "", tagline: profile.tagline ?? "" })`.
- Optimistic update: `tagline: args.tagline ?? current.tagline`.
- Submit: `tagline: data.tagline`.
- Render: `<EditableTagline isEditing={isEditing} tagline={profile.tagline} />`.

Update Zod schema if it's defined inline (likely is — `react-hook-form` + `zodResolver` per `.claude/rules/forms.md`). The form field name change requires updating the Zod object key too.

**2i. Rename `editable-bio.tsx` → `editable-tagline.tsx`**

```bash
git mv apps/mirror/features/profile/components/editable-bio.tsx \
       apps/mirror/features/profile/components/editable-tagline.tsx
```

Inside the file: rename component + prop:
- `EditableBio` → `EditableTagline`
- `bio` prop → `tagline`
- `EditableBioProps` → `EditableTaglineProps`
- Update the import in `profile-info.tsx`.

**2j. Mirror app — layout** (`apps/mirror/app/[username]/layout.tsx:31,75`)

```ts
// line 31
const description = profile.tagline || `${displayName}'s profile on Mirror`;

// line 75
tagline: convexProfile.tagline ?? convexProfile.bio ?? "",  // C1 fallback; drop bio in C2
```

**2k. Seed** (`packages/convex/convex/seed.ts:200`)

```ts
return await ctx.db.insert("users", {
  // ...
  tagline: "Rick Rubin has been a singular, transformative creative muse for artists across genres and generations — from the Beastie Boys to Johnny Cash, from Public Enemy to the Red Hot Chili Peppers, from Adele to Jay-Z.",
  // bio field removed
  // ...
});
```

**2l. E2E specs**

Run `grep -rn "\\bbio\\b" apps/mirror/e2e/` to find any test that fills "bio" form fields or asserts profile.bio in the API response. Rename. Don't rename `bioEntries`-related specs (those are the Bio tab — separate concept).

**2m. Verify C1**

```bash
pnpm --filter=@feel-good/convex test       # all Convex tests pass
pnpm build --filter=@feel-good/mirror      # type-check Mirror
pnpm lint --filter=@feel-good/mirror       # lint Mirror

# Deploy to dev (convex dev should auto-push during edits, but explicit is safer)
cd packages/convex && npx convex dev --once

# Run backfill
cd packages/convex && npx convex run users.migrations.backfillTaglineFromBio
# Expected: { updated: N, skipped: 0 } where N is the number of users with bio set
```

### Step 3 — Commit 2: drop the deprecated `bio` field

After C1 has been deployed and backfill confirmed:

**3a. Schema** — remove `bio` from `users/schema.ts`. Keep `tagline`.

**3b. Helpers + validators** — remove `bio` from validator shapes in `users/helpers.ts`.

**3c. Queries + mutations** — drop the `bio` field from query returns; drop the `bio` arg from `updateProfile`; drop the `taglineToWrite = args.tagline ?? args.bio` fallback.

**3d. Chat helpers** — remove the `?? profileOwner.bio` fallback in `loadStreamingContext`.

**3e. Layout** — remove the `?? convexProfile.bio` fallback.

**3f. Backfill mutation** — leave the file but clear the body:

```ts
export const backfillTaglineFromBio = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), skipped: v.number() }),
  handler: async () => {
    // Backfill complete; bio field removed from schema in C2.
    return { updated: 0, skipped: 0 };
  },
});
```

Or delete the file entirely — depends on whether you want a paper trail. The history captures the intent; deletion is fine.

**3g. Schema-deploy guard**

If any user row STILL has `bio` set when C2 deploys, schema validation fails. Pre-flight check from the dashboard or CLI:

```bash
cd packages/convex && npx convex run --watch=false users.migrations.assertNoBioRemaining 2>&1
```

Add a small assertion mutation if you want to gate the C2 deploy mechanically. Or just inspect the dashboard.

**3h. Verify C2**

```bash
pnpm --filter=@feel-good/convex test
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
```

All green. Schema deploys cleanly.

---

## Hard verification

### E2E — Playwright CLI (per `.claude/rules/verification.md` § E2E Tests)

The rename is a refactor — no new feature surface — so the verification is **regression coverage on the profile read/write paths**, not a new spec.

**Pre-step: re-seed dev**

```bash
pnpm --filter=@feel-good/convex seed:rick-rubin
```

Confirms the renamed seed wires through.

**Main spec run: full Mirror e2e**

```bash
pnpm --filter=@feel-good/mirror test:e2e
```

All currently-green specs must stay green. Specs that exercise the profile flow (any spec that fills the bio form, asserts profile metadata, or checks the chat agent's tagline-derived behavior):

- `apps/mirror/e2e/onboarding.authenticated.spec.ts` (probable — onboarding sets the field)
- `apps/mirror/e2e/profile-content-panel-toggle.spec.ts`
- `apps/mirror/e2e/profile-root-default-open.spec.ts`
- Any `*.authenticated.spec.ts` that loads `/@username` and asserts the rendered description.

**New targeted regression spec** — `apps/mirror/e2e/profile-tagline-rename.authenticated.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Profile tagline (renamed from bio) — read/write regression", () => {
  test("rendered profile description uses tagline, not the old bio field", async ({ page }) => {
    await page.goto("/@rick-rubin");
    // Page metadata description is built from profile.tagline.
    // The seeded value contains "transformative creative muse" — pin to that.
    const meta = page.locator('meta[name="description"]');
    await expect(meta).toHaveAttribute("content", /transformative creative muse/);
  });

  test("profile-info edit form persists tagline through Convex", async ({ authenticatedPage: page }) => {
    // Visit own profile, edit tagline, save, reload, confirm persisted.
    await page.goto("/@test-user");
    // Click edit toggle, fill tagline input, save.
    // Form field should be `tagline` (renamed from `bio`).
    await page.getByTestId("profile-edit-toggle").click();
    const input = page.getByLabel(/Tagline/i);
    await input.fill("Renamed-by-rename-test tagline value");
    await page.getByTestId("profile-edit-save").click();
    // Reload to drop optimistic state and re-fetch from Convex.
    await page.reload();
    await expect(page.getByText("Renamed-by-rename-test tagline value")).toBeVisible();
  });
});
```

Pin the form-field selector to `getByLabel(/Tagline/i)` — that's the load-bearing user-facing rename. If a future refactor reverts the field name, this spec catches it.

**Pass criteria:**
- Full e2e suite green.
- New regression spec green.
- No spec asserts the old "Bio" label in the profile form (the rename should have caught these in C1; this is the safety net).

### Convex tests

```bash
pnpm --filter=@feel-good/convex test
```

Every test must pass. New cases to add:

- `users/__tests__/queries.test.ts` — `getByUsername` returns `tagline`, not `bio`.
- `users/__tests__/mutations.test.ts` — `updateProfile` writes `tagline`. (C1 also accepts `bio` arg as alias for backwards compat; C2 rejects it. Add a "rejects bio arg post-narrow" test in C2.)
- `users/__tests__/migrations.test.ts` (NEW) — `backfillTaglineFromBio` copies `bio` → `tagline`, is idempotent, leaves users with no bio untouched, leaves users with existing tagline untouched.
- `chat/__tests__/helpers.test.ts` — assertions on `Tagline: ` label (replacing the existing `Bio: ` / `One-line summary about you: ` literals).

### Build + lint

```bash
pnpm build --filter=@feel-good/mirror
pnpm build --filter=@feel-good/convex
pnpm lint --filter=@feel-good/mirror
```

All exit 0.

### Manual smoke (optional, after e2e green)

1. `pnpm dev --filter=@feel-good/mirror` + `convex dev`.
2. Open `/@rick-rubin?chat=1`.
3. Send "tell me about yourself" — agent should reply in conversational prose using the tagline as voice context (regression: pre-rename behavior).
4. Confirm own-profile editor shows the renamed "Tagline" label.

---

## Constraints & non-goals

**In scope:**
- Schema rename `users.bio` → `users.tagline`.
- All Convex callers (queries, mutations, helpers, chat system prompt).
- All Mirror UI callers (form, render, metadata, hooks, types, component file rename).
- Backfill of existing rows.
- Test updates + one new regression spec.
- Two commits in one PR (widen + switch, then narrow).

**Explicitly out of scope:**
- **No changes to `bioEntries` table or the Bio tab feature.** That table keeps its name — these *are* bio entries, conceptually distinct from a tagline.
- **No changes to `feature-bio-pull-up` branch.** That branch stays paused. After this PR merges to main, rebase `feature-bio-pull-up` onto main; the rebase will conflict on `chat/helpers.ts` (because that branch's debug iterations renamed the label) — resolve in favor of THIS branch's `Tagline:` literal. Re-run the bio-pull-up e2e; it should pass without further changes (verified via the agent-investigator transcript: removing the inline `bio`/`tagline` content path eliminates the LLM short-circuit).
- **No prompt-engineering tweaks** to the clone-chat system prompt other than the field-name change.
- **No agent-tool changes.** `openBio` lives on `feature-bio-pull-up`; this branch doesn't touch it.
- **No Convex schema-validation toggling.** We use widen → backfill → narrow specifically to avoid `schemaValidation: false`.
- **No public API renames** beyond the field — function names like `getByUsername`, `updateProfile` keep their names.
- **No deprecation period beyond the C1 commit window.** The `bio` arg alias on `updateProfile` exists for one deploy only. Any external client we don't control that posts `bio` will break in C2 — verify there's no such consumer (`grep -rn "\"bio\":" apps/mirror/` and check the `mirror.ts` SDK if one exists).

**Risks accepted:**
- Schema-validation deploy ordering: C2 fails if any user row still has `bio` set. Mitigation: explicit pre-flight check before deploying C2 (Step 3g).
- React Hook Form field name change is breaking: any open editor session holding draft state with key `bio` loses that draft. Acceptable — the form is a transient inline editor with no long-lived session.
- Page metadata cache: Next.js may cache the old `description` for one revalidation cycle. Acceptable — descriptions update on the next request.
- The `feature-bio-pull-up` branch's seed (`ensureRickRubinBioEntries`) is independent of this rename and won't conflict on rebase.
- Component file rename (`editable-bio.tsx` → `editable-tagline.tsx`) breaks any open editor's symbol search until the rename is committed. Acceptable.

---

## Coordination with `feature-bio-pull-up`

That branch currently has:
- 9 implementation files green (tool, dispatcher, watcher, tests, seed, e2e spec).
- 2 Convex helper files with debug-iteration changes (RAG bio filter + label rename to "One-line summary about you:").
- E2e gate red because of the naming collision this branch resolves.

After THIS PR (`chore/rename-users-bio-to-tagline`) merges:

```bash
git checkout feature-bio-pull-up
git fetch origin
git rebase origin/main
# Conflicts expected in:
#   - packages/convex/convex/chat/helpers.ts (TOOLS_VOCABULARY + label)
#   - packages/convex/convex/chat/__tests__/helpers.test.ts
#   - packages/convex/convex/seed.ts (rick-rubin user.bio → user.tagline; bio entries unchanged)
# Resolve in favor of main's "Tagline:" label and "tagline" field everywhere.
# Keep feature-bio-pull-up's openBio tool, dispatcher, watcher, tests, seed-bio-entries.
```

After rebase:

```bash
pnpm --filter=@feel-good/convex seed:rick-rubin
pnpm --filter=@feel-good/mirror test:e2e bio/bio-agent-pulls-up.authenticated.spec.ts
```

Both bio-pull-up tests should pass — the LLM no longer has the inline tagline conflicting with the `openBio` tool. If the positive path still fails, the issue is something we missed; investigate via the same `bio-investigator` agent-prompt pattern documented in the bio-parity plan.

The RAG-bio filter from `feature-bio-pull-up`'s fix-iter-3 (in `chat/actions.ts` and `embeddings/queries.ts`) is independent of this rename and remains valid — keep it during the rebase. It's defense-in-depth even after the inline-tagline conflict is resolved.
