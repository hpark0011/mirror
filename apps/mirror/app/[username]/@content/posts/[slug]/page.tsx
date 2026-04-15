import { notFound } from "next/navigation";
import { PostDetailConnector } from "@/features/posts";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

export default async function PostContentPage({
  params,
}: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;

  // Server-side check: 404 for non-owners viewing drafts
  const post = await fetchAuthQuery(api.posts.queries.getBySlug, {
    username,
    slug,
  });
  if (!post) notFound();

  // Preload for reactive client subscription (status updates after publish/unpublish)
  const preloadedPost = await preloadAuthQuery(api.posts.queries.getBySlug, {
    username,
    slug,
  });

  return (
    <PostDetailConnector preloadedPost={preloadedPost} username={username} />
  );
}
