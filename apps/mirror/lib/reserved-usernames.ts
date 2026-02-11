/**
 * Route segments and system names that cannot be used as usernames.
 * Prevents /@username rewrites from colliding with static routes.
 */
export const RESERVED_USERNAMES = new Set([
  "api",
  "admin",
  "dashboard",
  "settings",
  "sign-in",
  "sign-up",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
