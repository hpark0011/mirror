import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { waitlistRateLimiter } from "./rateLimits";

type LimitName = "waitlistSubmitPerEmail" | "waitlistSubmitGlobal";

/**
 * Narrow wrapper around `waitlistRateLimiter.limit` that converts a rejection
 * into a structured `ConvexError` the browser can discriminate on via
 * `err.data.code` (FR-03, NFR-02). `retryAfter` from `@convex-dev/rate-limiter`
 * is already in milliseconds and is passed through unchanged.
 *
 * Ordering note: `waitlistSubmitPerEmail` is called before
 * `waitlistSubmitGlobal`. Per the verified `@convex-dev/rate-limiter@0.3.2`
 * semantics (see `chat/mutations.ts::enforceLimit`), a failed rate-limit
 * check does NOT consume a token, so a per-email rejection leaves the
 * global bucket untouched.
 */
async function enforceLimit(
  // The rate limiter accepts any query/mutation/action context. Using a loose
  // type here avoids fighting the generic component-client parameter type.
  ctx: Parameters<typeof waitlistRateLimiter.limit>[0],
  name: LimitName,
  key: string | undefined,
): Promise<void> {
  const result = await waitlistRateLimiter.limit(ctx, name, {
    ...(key !== undefined ? { key } : {}),
    throws: false,
  });
  if (!result.ok) {
    throw new ConvexError({
      code: "RATE_LIMIT" as const,
      retryAfterMs: result.retryAfter,
    });
  }
}

/**
 * Server-side sanity check for an already-normalized (trimmed + lowercased)
 * email (FR-04). Deliberately NOT a clone of Zod's `.email()` — authoritative
 * validation lives on the client. This only catches obviously-garbage input
 * that bypasses the client (direct RPC calls from a malicious caller).
 */
function isStructurallyValidEmail(email: string): boolean {
  if (email.length === 0) return false;
  const atIndex = email.indexOf("@");
  // Exactly one "@"
  if (atIndex === -1 || atIndex !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (local.length === 0 || domain.length === 0) return false;
  // Domain must contain a "."
  if (!domain.includes(".")) return false;
  return true;
}

/**
 * Public waitlist submission. Called directly from the unauthenticated
 * browser client over the Convex WebSocket.
 *
 *  - Normalizes `email` to trimmed+lowercased form.
 *  - Rejects obviously-invalid emails with `ConvexError({ code: "INVALID_EMAIL" })`.
 *  - Enforces per-email then global rate limits, throwing
 *    `ConvexError({ code: "RATE_LIMIT", retryAfterMs })` on rejection.
 *  - Idempotent: a second submission of the same email returns
 *    `{ alreadyOnList: true }` without inserting a duplicate row.
 *  - On first successful submission: inserts exactly one row and returns
 *    `{ alreadyOnList: false }`.
 */
export const submit = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({ alreadyOnList: v.boolean() }),
  handler: async (ctx, args) => {
    // 1. Normalize input. Client Zod already does this, but re-normalize on
    //    the server to keep the `by_email` index queried against the canonical
    //    form even when called via direct RPC.
    const normalized = args.email.trim().toLowerCase();

    // 2. Defense-in-depth structural check (FR-04).
    if (!isStructurallyValidEmail(normalized)) {
      throw new ConvexError({ code: "INVALID_EMAIL" as const });
    }

    // 3. Per-email rate limit — runs first. Cheap, obvious, and does not
    //    consume the global bucket on rejection.
    await enforceLimit(ctx, "waitlistSubmitPerEmail", normalized);

    // 4. Global rate limit — backstop against email rotation attacks.
    await enforceLimit(ctx, "waitlistSubmitGlobal", undefined);

    // 5. Idempotent insert. Single indexed lookup + at most one insert per
    //    call (NFR-01).
    const existing = await ctx.db
      .query("waitlistRequests")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing !== null) {
      return { alreadyOnList: true };
    }

    await ctx.db.insert("waitlistRequests", {
      email: normalized,
      submittedAt: Date.now(),
    });
    return { alreadyOnList: false };
  },
});
