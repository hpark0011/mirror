/**
 * Profile root page — never reached.
 *
 * Visitors landing on `/@username` are redirected to Articles at the request
 * boundary, with `@content/page.tsx` providing a server-route fallback.
 * This file exists because Next.js requires a `page.tsx` for the `[username]`
 * segment to be a routable URL, and because `[username]/layout.tsx`
 * deliberately discards `children` (parallel routes own the render tree).
 */
export default function ProfilePage() {
  return null;
}
