import { notFound, redirect } from "next/navigation";
import { PostEditor } from "@/features/posts/components/post-editor";
import type { PostSummary } from "@/features/posts/types";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

// Edit pages are owner-only. `getBySlug` hides drafts from non-owners, but a
// published post can be read by anyone — we still need a stricter "current
// user is the owner" gate before rendering the editor. We fetch the current
// profile and compare its `_id` to `post.userId`.
//
// On a missing session we redirect to /sign-in. On a session-without-ownership
// we redirect back to the read view (being signed-in as the wrong user is not
// a sign-in failure).
export default async function PostEditContentPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  if (!(await isAuthenticated())) {
    redirect("/sign-in");
  }

  const [post, profile] = await Promise.all([
    fetchAuthQuery(api.posts.queries.getBySlug, { username, slug }),
    fetchAuthQuery(api.users.queries.getCurrentProfile, {}),
  ]);

  if (!post) notFound();

  if (!profile || profile._id !== post.userId) {
    redirect(`/@${username}/posts/${slug}`);
  }

  return (
    <PostEditor post={post as PostSummary} username={username} slug={slug} />
  );
}
