/**
 * Profile root page — never reached.
 *
 * Visitors landing on `/@username` are redirected by the `@content/page.tsx`
 * parallel slot so the redirect can read the profile's saved default section.
 * This file exists because Next.js requires a `page.tsx` for the `[username]`
 * segment to be a routable URL, and because `[username]/layout.tsx`
 * deliberately discards `children` (parallel routes own the render tree).
 */
export default function ProfilePage() {
  return null;
}
