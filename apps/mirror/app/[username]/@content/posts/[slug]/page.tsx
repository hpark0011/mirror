import { notFound } from "next/navigation";
import { PostDetail, PostDetailToolbar } from "@/features/posts";
import type { PostWithBody } from "@/features/posts";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default async function PostContentPage({
  params,
}: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const post = await fetchAuthQuery(api.posts.queries.getBySlug, {
    username,
    slug,
  });
  if (!post) notFound();

  return (
    <>
      <WorkspaceToolbar>
        <PostDetailToolbar username={username} />
      </WorkspaceToolbar>
      <PostDetail post={post as PostWithBody} />
    </>
  );
}
