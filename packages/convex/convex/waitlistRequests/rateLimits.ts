import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Two-layer rate limit for the public waitlist `submit` mutation (FR-03).
 *
 *  - `waitlistSubmitPerEmail`: fixed window, 3 submissions / hour, keyed by
 *    the lowercased email. Prevents an individual inbox from being used to
 *    spam the form.
 *  - `waitlistSubmitGlobal`: token bucket, 200/hour sustained with 50-burst
 *    capacity, un-keyed. Backstop against an attacker rotating emails —
 *    accepted DoS trade-off documented in the spec's edge-cases section.
 *
 * Per-email check runs before the global check at the callsite. The
 * `@convex-dev/rate-limiter@0.3.2` component does NOT consume a token on
 * rejection (verified in `chat/mutations.ts`'s `enforceLimit` note), so a
 * per-email rejection leaves the global bucket untouched.
 */
export const waitlistRateLimiter = new RateLimiter(components.rateLimiter, {
  waitlistSubmitPerEmail: {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },
  waitlistSubmitGlobal: {
    kind: "token bucket",
    rate: 200,
    period: HOUR,
    capacity: 50,
  },
});
