/**
 * Profile root page — never reached.
 *
 * Visitors landing on `/@username` are redirected to the default content kind
 * (e.g. `/@username/posts`) by `apps/mirror/middleware.ts` before this route
 * resolves. The file exists because Next.js requires a `page.tsx` for the
 * `[username]` segment to be a routable URL, and because `[username]/layout.tsx`
 * deliberately discards `children` (parallel routes own the render tree).
 */
export default function ProfilePage() {
  return null;
}
