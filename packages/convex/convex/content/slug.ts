// Canonical slug normalizer + shape check.
//
// IMPORTANT: This is the single source of truth for slug shape across the repo.
// Do NOT inline a parallel implementation on the client — import from here via
// `@feel-good/convex/convex/content/slug`. See `.claude/rules/identifiers.md`.
//
// Pure module: no Convex runtime imports, so it is safe to import from both
// the Convex backend and the Next.js client.

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function generateSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Cannot generate slug from the given input");
  }

  return slug;
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function assertValidSlug(slug: string, field = "Slug"): void {
  if (!isValidSlug(slug)) {
    throw new Error(
      `${field} "${slug}" is not a valid slug — must match ${SLUG_PATTERN}`,
    );
  }
}
