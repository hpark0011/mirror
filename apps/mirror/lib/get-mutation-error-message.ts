export const GENERIC_FALLBACK = "Something went wrong. Please try again.";

const INTERNAL_ONLY_MESSAGES = new Set([
  "Not authenticated",
  "Unauthenticated",
  "App user not found",
]);

/**
 * Extracts a user-facing message from an unknown Convex mutation rejection.
 * ConvexError instances carry useful product copy for validation failures, but
 * FG_170 identified a few auth/session internals that should stay hidden.
 */
export function getMutationErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return GENERIC_FALLBACK;
  if (INTERNAL_ONLY_MESSAGES.has(err.message)) return GENERIC_FALLBACK;
  return err.message;
}
