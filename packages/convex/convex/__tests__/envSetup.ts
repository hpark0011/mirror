// Vitest setup — runs before any test file's top-level imports.
//
// `convex/env.ts` validates required env vars at module-load time and
// throws otherwise. Every test file that transitively imports the
// schema/auth/etc. layer would need the same five lines of `process.env.X
// = process.env.X ?? "..."` at the top, which is exactly the duplication
// that broke when `BETTER_AUTH_SECRET` was added to the required set
// (28 test files would have needed editing).
//
// Putting the fallbacks here means a new required env var is a one-line
// change in two places (`env.ts` + this file) instead of N test files.
// Tests that need a specific value can still override at the top of the
// file before the import — `process.env.X = ...` with no `??` wins.

process.env.SITE_URL = process.env.SITE_URL ?? "https://test.local";
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";
// 32+ chars to satisfy the zod min-length on the real schema. The value
// itself is irrelevant in tests — Better Auth tokens are not encrypted in
// the test runtime because `account.encryptOAuthTokens` stays off (its
// flip is gated on the production OAuth spike, see PLAN_015).
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  "test-better-auth-secret-not-used-for-encryption";
