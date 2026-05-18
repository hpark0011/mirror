# Lessons Learned

## 2026-05-18

### Parallel sub-agents in a shared worktree must never run worktree-global git ops

- During a `/resolve-issue-tickets` wave, a FG_252 executor ran a `git stash`
  "build test" and a verifier later ran a `git clean`-class command in the
  SHARED worktree. `git stash` reverted the other three parallel executors'
  uncommitted **tracked** changes; the `git clean`-class op wiped the
  **untracked** ticket files and `workspace/tickets/to-do/` entirely. No code
  was lost only because the orchestrator could re-derive every change
  deterministically from verifier reports.
- Root causes, both compounding-fixable upstream:
  1. **Sub-agent prompts did not forbid worktree-global git** (`git stash`,
     `git checkout`, `git reset`, `git clean`, `git worktree`). Telling
     verifiers "don't run git stash" in prose was insufficient — one did it
     anyway. The executor/verifier prompt templates in
     `.claude/skills/resolve-issue-tickets/SKILL.md` must hard-prohibit these
     and offer a safe alternative for "compare against base" (read
     `git show main:<path>`, never check out).
  2. **Ticket files were untracked.** `generate-issue-tickets` Writes the file
     but never `git add`s it; `mark-completed.sh` `git mv` on an untracked
     file is not a tracked rename. Untracked + shared worktree + any
     `git clean` = silent total loss. Newly generated tickets should be
     `git add`ed (intent-to-add at minimum) so they survive a clean.
  3. **"No commits" + parallel git-capable sub-agents is unsafe.** Without a
     per-wave commit (Phase 4e) there is no rollback point; the only recovery
     is the orchestrator's context. If the user declines commits, the
     orchestrator must snapshot the worktree (filesystem copy) before each
     wave, not rely on prompt discipline alone.
- Detection signal: a sub-agent reporting it did a "stash test" / "stash to
  compare against base" / "git clean" is a P0 process flag — stop the wave and
  reconcile filesystem + `git status` before dispatching anything else.

### Duplicate "twin" components: verify rendered outcome, not class strings

- When a change must be applied to two near-identical components
  (`post-list-item.tsx` / `post-detail.tsx`), DOM-verifying the class string
  on each is not enough. The two had already drifted: same `gap-0` class but
  one renders the body via `ContentBody` (direct-child `<p>`, first-child
  margin reset works) and the other via `RichTextViewer` (Tiptap
  `.ProseMirror` wrapper → `<p>` is a grandchild, reset never applied) — so
  identical classes produced a 16px misalignment. Verify the *measured
  rendered result* (e.g. body-first-line vs metadata-first-line top delta) is
  identical across both, not just that the markup matches.
- Having to hand-apply the same fix to two files is itself the bug signal.
  Surface the duplication and propose extracting one shared presentational
  component instead of dual-patching (the compounding option). Connector →
  pure-UI separation being clean does NOT mean the UI layer is DRY.

## 2026-05-15

### `convex codegen` (1.37) is not offline — it pushes to a deployment

- `convex codegen` was assumed (from memory) to be a purely-local generator
  safe to wire into `pnpm lint` and CI. Verified on the installed version
  (1.37): with no creds it hard-fails `✖ No CONVEX_DEPLOYMENT set`, and with
  a deployment it **uploads functions to that deployment** ("Uploading
  functions to Convex…") to derive accurate `_generated/api.d.ts` types.
- Consequences: (1) it cannot be a `lint` side-effect — lint would mutate
  the worktree's dev deployment and hard-fail without credentials; (2) it is
  not a drop-in CI gate — CI has no Convex deployment. It belongs as a
  deliberate pre-commit step in a provisioned worktree (which always has
  `CONVEX_DEPLOYMENT`). A true CI codegen gate needs an ephemeral
  deployment — separate, larger work.
- Reinforces the existing rule: verify CLI behavior on the **installed
  version** by running it, not by pattern-matching the tool's name. A
  recommendation that calls something a "cheap CI gate" must be falsified
  against the real binary before the cheapness claim is made.

### Test URL envs should tolerate trailing slashes

- Convex HTTP routes do not normalize doubled path slashes. When app code or a
  test helper reads `NEXT_PUBLIC_CONVEX_URL` or
  `NEXT_PUBLIC_CONVEX_SITE_URL`, strip trailing slashes before appending paths
  or constructing clients; otherwise a valid deployment URL ending in `/`
  becomes `//...` and can return empty/error responses.

### Agent batch mutations must defer destructive storage cleanup

- If an owner-write agent tool advertises an all-or-nothing batch, every
  operation that can throw must run before any `ctx.storage.delete(...)`.
  Queue cover/blob IDs during the batch, then clean them after validation and
  database writes have succeeded.
- Uploaded chat images are single-use cover inputs unless deletion is
  reference-aware. Reject multiple "use uploaded image" operations in one tool
  call, or prove the cleanup path preserves blobs that remain referenced.

## 2026-05-13

### Agent modes need immutable conversation boundaries

- When a chat feature introduces multiple agent modes, store the mode on the
  conversation at creation time and treat it as immutable. A single agent
  thread must not mix system prompts or tool surfaces across modes, so
  send/retry paths should reject any request where the existing conversation's
  mode differs from the incoming mode.

### Owner-only agent tools need send-boundary authorization too

- Tool-level `viewerId === profileOwnerId` checks are necessary but not
  sufficient for owner-only agent modes. Creation of the owner-only
  conversation itself must require an authenticated app user matching the
  profile owner and should insert `viewerId: profileOwnerId`; otherwise
  unauthorized rows can exist even if later tool calls fail.

### LLM-callable URL fetchers need a full network threat model

- Any URL-fetching tool exposed to an agent should specify DNS/IP blocklists,
  redirect re-resolution, redirect/body/time/content-type caps, no ambient
  credentials, a fixed user agent, and per-conversation rate limits before
  implementation starts. "SSRF guards" is too vague for a tool the model can
  call with arbitrary URLs.

### Fresh worktree E2E needs Convex functions pushed first

- After provisioning a worktree-local Convex deployment, `pnpm --filter=@feel-good/convex generate`
  is not enough for authenticated Playwright. Push functions with
  `pnpm --filter=@feel-good/convex exec convex dev --once --run seed:seedRickRubinDemo`
  before running e2e specs; otherwise `/api/test/session` can hit an old
  deployment shape and fail at the Better Auth OTP route.

## 2026-05-12

### Worktree rules should delegate enforced invariants to scripts

- Once `provision-worktree-convex.sh` constructs the full
  `team:project:dev/<namespace>/<branch>` ref and uses `--type dev`, docs do
  not need to repeatedly explain that no separate Convex project is created.
  Keep rules focused on operator choices and recovery paths.

### Worktree Convex setup must converge on the deterministic deployment ref

- A worktree-local `packages/convex/.env.local` can be a stale regular file
  copied from another worktree, not only a symlink to main. Provisioning should
  remove any existing selection and create-or-select the expected
  `team:project:dev/<namespace>/<worktree>` ref instead of trusting any
  arbitrary `dev:*` deployment.

### Worktree root discovery should use Git common-dir, not branch state

- `git worktree list --porcelain` only reports the branch currently checked out
  in each worktree. If the primary checkout has switched from `main` to a
  feature branch, matching `branch refs/heads/main` fails even though the
  canonical checkout is present. Use `git rev-parse --git-common-dir` to find
  the primary checkout, and keep branch scanning as a fallback only.

## 2026-05-11

### Optional titles still need an explicit slug invariant

- For slug-addressed content, making `title` optional means every create
  path must either receive a non-empty slug or have a separate slug source.
  Move the user-facing validation from `title` to `slug` instead of letting
  `generateSlug("")` surface as a generic mutation failure.

### Storage-heavy e2e specs need explicit cleanup hooks

- Tests that upload to Convex Storage must track every storage ID or owning
  fixture slug they create and clean it in `afterEach`. Relying on the next
  fixture reset or the 24-hour orphan sweep lets large blobs accumulate across
  local retries and persistent worktree deployments.
- Rejection-path tests are not exempt: a server-side action may be intended to
  delete before failing, but the test should still register the uploaded ID for
  best-effort cleanup after assertion failure or timeout.
- Cleanup helpers must treat missing storage as already cleaned. Convex throws
  if `ctx.storage.delete` receives a missing ID, so check `_storage` first and
  still remove any stale ownership row.
- Dev storage cleanup should default to dry-run and report bytes before
  deletion. Include an explicit flag for referenced test fixture media, because
  those blobs are not orphans and a generic orphan sweep will correctly preserve
  them.

## 2026-05-10

### Registry helpers need explicit type predicates for narrowed lookups

- When a registry stores both enabled and disabled capability variants, checking
  `entry.capability.enabled ? entry : null` may not narrow enough once the entry
  came from indexed object lookup. Reuse the registry's type-predicate helper
  (`isNavigableSource(source) ? source : null`) so TypeScript carries the
  narrowed variant through exported lookup helpers.

### Static Playwright report specs should avoid ESM-only helpers

- In `apps/mirror/e2e`, a spec that imported Node built-ins and used
  `import.meta.url` hit `ReferenceError: require is not defined` during
  Playwright's TypeScript transform, even though regular app specs loaded
  normally. For simple static artifact checks, derive repo paths from
  `process.cwd()` and keep the spec shaped like the existing Playwright files.
- Table row labels rendered with `<th>` are row headers, not role `cell`; assert
  visible text or row/header roles instead of `getByRole("cell", { name })`.

### Convex schema checks need data drift cleanup, not permanent dead fields

- `convex dev --once` can fail even when local typecheck/build pass if the
  target deployment has rows with fields the current validator has already
  narrowed away. The fix is widen-migrate-narrow: temporarily allow the legacy
  field, run a one-shot cleanup mutation against the affected deployment, then
  remove the temporary validator again and rerun `convex dev --once`.
- Do not leave unused legacy fields in `schema.ts` just to satisfy one dirty
  worktree deployment. The final successful schema push should happen after the
  data cleanup with the intended narrow schema.
- If the local Convex CLI account cannot access the selected deployment, use
  the deployment's existing test-secret-gated HTTP surface as the cleanup
  bridge: push a temporary widened schema plus guarded cleanup route, call it
  once, then remove the route and narrow the schema again.

### Convex mutations cannot delete storage and then throw

- A `ctx.storage.delete(...)` inside a mutation is rolled back when that
  mutation throws. If a reject path must both fail the caller and commit blob
  cleanup, put the validation/delete/throw boundary in an action, then use an
  internal mutation only for the successful database write.
- Unit tests against `convex-test` can miss this because they often pin only
  the thrown error/no-row contract. A live `convex dev --once` deployment plus
  focused e2e is the right check for storage side effects.

### Convex tests should isolate scheduled embedding side effects

- CRUD/tool tests that schedule embedding cleanup or generation through
  `ctx.scheduler.runAfter(0, ...)` should use a shared `convex-test` module map
  that replaces embedding functions with no-op shims. That keeps tests focused
  on the behavior under assertion instead of accidentally exercising the RAG
  pipeline.
- For scheduled cleanup specifically, the test-only `deleteBySource` shim must
  resolve as an internal action, not an internal mutation. `convex-test` can
  print a rollback stderr line for immediately scheduled mutations after the
  parent mutation commits, even when the scheduled mutation is intentionally
  empty. RAG/embedding tests should opt into the real modules explicitly.

### Review fixes should patch the class, not only the flagged line

- When a PR review flags raw PII in an operational log, search the adjacent
  auth/profile path for the same pattern before calling it done. Removing
  `email=...` from one backfill log while leaving the matching missing-profile
  warning log would preserve the privacy footgun under a different branch.
- If a UI review asks for i18n but the app has no resource files yet, use
  `react-i18next` translation keys with `defaultValue` fallbacks rather than
  inventing a one-off resource architecture in the review-fix commit. That
  keeps visible copy stable while making the new surface ready for real
  resources.

### OAuth proxy callbacks use Convex `SITE_URL`, not just the Next dev URL

- In worktrees, Google OAuth can bounce back to a dead localhost port even when
  the Mirror dev server started on the correct allocated port. The decisive
  value is Convex deployment env `SITE_URL`; Better Auth's OAuth proxy uses it
  as `currentURL`, so a stale `SITE_URL=http://localhost:3001` sends the final
  callback to 3001 regardless of the app process port.
- `pnpm dev:safe` now runs `scripts/ensure-local-auth-url.mjs` before Turbo so
  Convex `SITE_URL` and `AUTH_ALLOWED_HOSTS` are aligned with
  `scripts/with-worktree-port.mjs`. For manual package-level dev runs, verify
  `pnpm --filter=@feel-good/convex exec convex env list | rg '^SITE_URL='`
  before debugging OAuth internals.

### Agent owner-write tools need viewer authorization

- Agent write tools need two separate guards: the closure-bound
  `profileOwnerId` scopes which rows a tool can touch, and the server-derived
  conversation `viewerId` proves the current visitor is allowed to mutate
  them. For publish/unpublish/delete tools, require
  `viewerId === profileOwnerId` before any read or write, and only advertise
  those verbs in the system prompt for owner conversations.

### Best-effort storage cleanup should keep reclaim handles

- When eager storage cleanup is best-effort, do not delete the ownership row
  after a failed blob delete. Keep the row as the reclaim handle so later
  orphan cleanup or sweeps can still find the leaked storage object.

### Chat-agent e2e specs need clean clone owners

- Authenticated chat specs that use the canonical `test-user` profile can
  inherit old conversations from previous local runs because the chat route
  auto-selects the latest conversation when `?chat=1` has no conversation id.
  For retrieval/navigation regressions, seed a dedicated test owner and chat
  with that profile as the authenticated visitor so the conversation list
  starts empty and assertions target the new exchange.
- Cold-route compiles can take longer than the shared `openChat` helper's
  10-second textarea wait. A focused spec may need a local helper with a
  longer wait when it creates a brand-new profile route during setup.

## 2026-05-08

### Temporary blob previews need an explicit ownership handoff

- A child picker may need a temporary `blob:` URL for immediate preview, while
  the parent hook owns the post-upload URL used by the rest of the form. Do not
  let a generic "keep blob previews" sync guard preserve the child URL forever:
  when upload settles, re-sync from parent props and revoke only the temporary
  preview URL.
- Regression shape: MP4 cover upload succeeds, tests that only assert the
  `<video>` element exists stay green, but the preview can hold a revoked or
  stale local URL. Add a regression test that checks the preview `src` actually
  hands off to the parent-owned URL after upload.

### Idempotent setup scripts must verify post-conditions, not trust subshell exit codes

- `sync-worktree-convex-secrets.sh` ran a `convex run` mutation inside `(...)`
  with `set -e` to auto-allowlist the worktree owner. The subshell silently
  swallowed the failure, the script printed "Allowlisted: …" and exited 0, but
  the row was never written — the user only learned about it minutes later
  when Google OAuth redirected back with the opaque
  `?error=unable_to_create_user`.
- Two patches lock this down: (1) run the mutation outside any subshell with
  an explicit `if !` failure check, and (2) immediately re-query
  `betaAllowlist/queries:isEmailAllowed` and fail loudly if it returns
  anything other than `true`. The second check also catches the "wrote to a
  different deployment" mode (stale `CONVEX_DEPLOYMENT`, CLI auth drift) that
  exit-code checks can never detect.
- Pattern beyond this script: any setup step that mutates remote state and
  reports success should re-read its own write before exiting. Exit codes
  prove "the call returned" — they do not prove "the row landed where I think
  it did."

## 2026-05-07

### RHF migrations must preserve every former state write

- When replacing local `useState` fields with React Hook Form, audit every old
  setter call and preserve its semantic equivalent. A mutation path that used
  to call `setStatus(nextStatus)` after a successful publish toggle must now
  call `form.setValue("status", nextStatus)`; otherwise watched UI state and
  later submit payloads can silently fall back to the stale pre-submit value.

### Claude-to-agents skill sync must preserve Convex symlink targets

- `.claude/skills/convex*` entries are symlinks back to tracked real
  directories under `.agents/skills/convex*`. When syncing `.claude` to
  `.agents`, do not copy those symlinks onto their own targets; exclude them
  from blanket rsync and preserve/restore the tracked `.agents` directories.

## 2026-05-06

### Codex worktree setup must support single-checkout clones

- Setup scripts cannot assume `git worktree list` includes a `main` worktree.
  Codex review checkouts and fresh single-worktree clones are often checked out
  directly on the feature branch, so environment setup must fall back to the
  current checkout for dependency installation. Keep canonical `.env.local`
  checks strict for secondary worktree creation, but do not block standalone
  installs before the user has a chance to seed local env files.

### PR hygiene — keep cosmetic tweaks out of feat/refactor PRs

- Cosmetic/visual tweaks (e.g. a `py-12 → py-10` swap on `post-list-item`)
  must ship in their own commit and PR. Bundling them into a `feat`/
  `refactor` PR pollutes the bisect history (a future investigation of a
  post-list spacing regression will land on a "feat(articles): add Edit
  button" commit and waste investigation time) and breaks the trust that
  PR titles summarize the change set.
- Surfaced by FG_158 after PR #39 silently included a `py-12 → py-10`
  change on `apps/mirror/features/posts/components/list/post-list-item.tsx`
  alongside the article Edit button + back-button refactor commits.

## 2026-05-05

### Convex client-auth race in authenticated Playwright specs

- `ConvexBetterAuthProvider` installs the JWT in an `useEffect` AFTER mount: read Better Auth session → `await authClient.convex.token()` → `client.setAuth(...)`. Any `useMutation(...)` fired during those microtasks (e.g. an inline-image upload-URL generator triggered by the FIRST paste in an authenticated spec) hits `Unauthenticated` even though the session cookie is already on the browser. Pre-warming `/api/auth/convex/token` does not help — the gap is the client effect, not the network round-trip.
- The deterministic signal is `<ConvexAuthProbe>` (`apps/mirror/providers/convex-auth-probe.tsx`) — an inert `<span data-testid="convex-auth-state" data-authenticated="true">` that flips only after `client.setAuth`'s onChange callback fires. The probe is mounted globally via `apps/mirror/providers/convex-provider.tsx` and is ~zero cost in production.
- **Authenticated-spec rule:** every authenticated Playwright spec MUST call `await waitForAuthReady(page)` (from `apps/mirror/e2e/fixtures/auth.ts`) AFTER `page.goto(...)` and BEFORE the first interaction that triggers a Convex mutation (paste, drop, save, dialog submit). Do NOT copy-paste the wait logic per spec — the helper is the single source of truth so future regressions are one fixture edit away from re-fixing every consumer.
- The fixture file's docstring carries the same root-cause writeup co-located with the helper itself for fast discovery from the call site.
- Agent tool flows that need "lookup, then act" require an explicit AI SDK
  step budget (`stopWhen: stepCountIs(...)`). The default one-step loop can
  execute the lookup tool and stop before the action tool is ever called.
- "Latest published" content must order by `publishedAt`, not row creation
  time. Drafts can be created long before they are published, so use an index
  that includes the semantic publish timestamp whenever UI or agent language
  says "latest".

### Authenticated Playwright specs need a deterministic ConvexAuth-ready signal

`ConvexBetterAuthProvider` installs the JWT in a _post-mount_ effect:
`authClient.useSession()` resolves → `fetchAccessToken()` round-trips
`/api/auth/convex/token` → `client.setAuth(...)` flips
`useConvexAuth().isAuthenticated` to `true`. Any `useMutation(...)` fired
during those microtasks (the inline-image upload-URL generator, the
post-create mutation, etc.) hits `Unauthenticated` even though the
session cookie is already set on the browser. Pre-warming
`/api/auth/convex/token` via `app/api/test/session` does NOT help — the
cookie is already present; the gap is the client-side effect, not the
network.

The fix is one inert probe + one fixture helper, applied uniformly:

- `apps/mirror/providers/convex-auth-probe.tsx` mounts a hidden `<span
data-testid="convex-auth-state" data-authenticated="…">` that mirrors
  `useConvexAuth()`. It's `aria-hidden` and `display:none` so the
  production cost is one tiny element render.
- `apps/mirror/e2e/fixtures/auth.ts` exports `waitForAuthReady(page)`,
  which waits for `[data-authenticated="true"]` to attach. Authenticated
  specs call it AFTER `page.goto(...)` and BEFORE the first interaction
  that triggers a `useMutation(...)` (paste, drop, save, dialog submit).

When you add a new authenticated spec that interacts with a Convex
mutation: import `waitForAuthReady` from `./fixtures/auth`, call it once
per page navigation, and you're safe. Don't try to re-derive readiness
from network requests — the token cookie may already be set, so no
second `/api/auth/convex/token` request fires; the only deterministic
signal is the `useConvexAuth` boolean mirrored into the DOM.

## 2026-05-03

- For Convex env sync helpers, preserve the CLI's round-trip format instead
  of parsing `convex env list` line by line. Convex 1.33+ intentionally
  supports `convex env list > file` plus `convex env set --force < file`,
  which keeps multi-line secrets intact and avoids bespoke parser drift.
- Inline storage cascade deletes must prove a blob is globally unreferenced after the write lands, not merely removed from the current body. Same-owner copy/paste can leave the same `storageId` in another article or post, so immediate cleanup needs a current article/post/user reference scan before `ctx.storage.delete`.
- When a hook records a result in React state and the caller must branch on it immediately, return the result as well. Relying on just-set state from the connector can race the close/reset path and hide user-visible import failures.
- "Always Choose the Compounding Option" means _less error-prone over time_, not _abstractly cleaner architecture_. Following the framework's idiom (e.g. the convex CLI's per-package `.env.local` auto-write) compounds; fighting it with custom config (`--env-file`, version pins, relative-path coupling) accumulates bespoke complexity even when it eliminates duplication. Single-source-of-truth appeal is real but it's a tradeoff, not a trump card — ask whether the proposed shape stays on the well-trodden path that future framework releases will keep working without intervention.
- When fixing a symptom, also patch the **class** upstream. The "`convex dev` prompts every new worktree" symptom was solved by re-seeding one file; the class — `new-worktree.sh` silently producing a half-configured worktree if any required `.env.local` is missing in main — was solved by adding a `REQUIRED_ENVS` assertion at the top of the script with per-file seed hints. Patching the script means the next missing-canonical-file (a future package's `.env.local`) can't repeat the same surprise.
- Verify CLI flag behavior on the **installed version**, not the latest changelog. `convex 1.32` ships `--env-file` but the 1.33 changelog patches it for "more reliability" — translation: there's a known bug in 1.32. Recommending a flag-based fix without checking the installed version's reliability history nearly shipped a broken solution.

## 2026-04-29

### `[username]/page.tsx` body is never executed — put bare-profile redirects in middleware

- `app/[username]/layout.tsx` deliberately discards `children` (`children: _children` + `void _children`) so the parallel-route slots (`@content`, `@interaction`) own the render tree. **Side effect:** Next.js 16 / Turbopack does NOT execute `page.tsx` for `/[username]` — its body never runs, so `redirect()` or `throw` in there is a silent no-op. The pre-existing mobile-only redirect block in page.tsx was dead code for this reason and was never actually firing.
- Verified empirically: `throw new Error(...)` in `page.tsx` returns 200 (not 500); rendering `{_children}` somewhere in the layout flips that back to 500. So the layout's "discard children" pattern fully suppresses the page render.
- **Where to put bare `/@username` → `/@username/<tab>` redirects:** `apps/mirror/middleware.ts`, not page.tsx. Middleware runs before the parallel-route system. Match `^/@[^/]+/?$` to scope to the bare profile path. Forward `request.nextUrl.search` to preserve query strings.
- **Always verify redirects in the browser/curl, not just by reading code.** If the redirect call sits in a route Next.js never renders, type-checking and lint pass clean while the URL silently stays put.

## 2026-02-24

### Auth integration requires end-to-end browser verification

- **Build passing is not verification for auth/data flows.** `tsc --noEmit` and `pnpm build` cannot detect that a Convex provider isn't passing auth tokens. Always load the page in a browser and confirm the actual user-visible behavior.
- **Trace the full data flow before declaring a fix.** For auth-dependent pages: Browser → Provider (token fetch) → Convex query → DB lookup. Check each hop, not just the code you changed.
- **Start debugging from the user's perspective.** Screenshot/observe the page first, then reason about code. Going code-first led to three rounds of investigation instead of one.
- **`convex data <table>` is the fastest way to diagnose null-query issues.** Use it immediately when a Convex query returns unexpected nulls.

### Data migration is a first-class concern

- When adding triggers/hooks that create records on entity creation, always ask: "What about entities that already exist?" Build a backfill path (e.g., `ensureProfile` mutation) alongside the trigger.
- Dead code is a red flag. If a null guard can never execute because the preceding call throws, the function's contract is wrong.

### Convex + Better Auth client setup

- `ConvexProvider` (plain) does NOT pass auth tokens. Must use `ConvexBetterAuthProvider` from `@convex-dev/better-auth/react` with the `authClient` to bridge Better Auth sessions into Convex auth context.
- `getAuthUser` throws `ConvexError("Unauthenticated")` — use `safeGetAuthUser` in queries that need to gracefully handle unauthenticated state. Keep `getAuthUser` in mutations that require auth.

## 2026-02-13

- If a transition bug reproduces only at extreme scroll positions (top works, bottom fails), treat it as a scroll-state/timing issue first (`useLayoutEffect` + `ViewTransition` + `scrollTo` ordering), not as static toolbar styling/geometry.
- Before patching visual styles, validate the hypothesis against the reported repro axis (e.g., scroll position dependence). If a proposed fix would affect all scroll positions equally, it is likely the wrong root cause for a bottom-only bug.

## 2026-02-12

- When a model has both `published_at` and `created_at`, do not assume one generic date filter; confirm whether each date needs its own submenu and separate owner-visibility rules.
- For toolbar filter UIs, default root "filter by..." search to narrowing dropdown options only unless the user explicitly wants it to affect the list query.

## 2026-02-09

- When using `@feel-good/ui/primitives/drawer`, every `DrawerContent` must include a `DrawerTitle` (can be hidden with `sr-only` via `DrawerHeader`) to satisfy Radix Dialog accessibility requirements and avoid runtime accessibility errors.
