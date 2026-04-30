---
paths:
  - "packages/convex/convex/**/*.ts"
  - "apps/*/features/**/*.ts"
  - "apps/*/features/**/*.tsx"
---

# Identifier Normalization Rule

User-controllable fields that become **URL components**, **index keys**, or
**lookup keys** (slugs, handles, usernames, room codes, etc.) MUST pass through
a single canonical normalizer at the mutation boundary, regardless of what the
client sent. Convex `v.string()` only checks type, not shape — the
mutation handler is the trust boundary.

## Rules

1. **One canonical normalizer per identifier kind.** No parallel client/server
   sanitizers. The current ones live in `packages/convex/convex/content/slug.ts`
   and are exported as `generateSlug`, `isValidSlug`, `assertValidSlug`.
2. **Normalizers must be idempotent.** Calling `generateSlug(generateSlug(x))`
   must equal `generateSlug(x)`. This is what lets the mutation safely call it
   on every input — including pre-normalized client values — without surprising
   the user.
3. **Always normalize at the mutation boundary.** Pattern:
   ```ts
   const slug = generateSlug(args.slug ?? args.title);
   ```
   Never `args.slug || generateSlug(args.title)` — that bypasses the normalizer
   when the client supplied a value, which is exactly the case where you don't
   trust them.
4. **Defense in depth with an assertion.** After normalization, call
   `assertValidSlug(slug)` before the `ctx.db.insert`/`ctx.db.patch`. If a
   future code path forgets to normalize, the assertion fails loudly instead of
   writing a malformed identifier to the DB.
5. **Clients import the same module, not a parallel implementation.** Markdown
   parsers, form schemas, etc. import from `@feel-good/convex/convex/content/slug`.
   If you find yourself writing `.replace(/[^a-z0-9]/g, ...)` in a feature
   module, stop — import the canonical helper.

## Why

Three slug bugs (one DB row with `?` in the slug, two divergent sanitizers, a
mutation that trusted client-supplied slugs) all came from violating these
rules. Convex schema validators won't catch this — only the conventions above
will.

## Adding a new identifier kind

When introducing a new identifier (e.g., a "room code"), add a sibling file
next to `content/slug.ts` (e.g., `content/room-code.ts`) exporting at minimum:

- A `generate<Kind>(input)` normalizer (idempotent, throws on empty)
- A `<KIND>_PATTERN` regex
- An `isValid<Kind>(value)` predicate
- An `assert<Valid|Kind>(value)` boundary check

Wire it through the package `exports` map so client and server share it.
