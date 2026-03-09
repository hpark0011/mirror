import { preloadAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { PostWorkspaceProvider } from "@/features/posts";

export default async function PostsContentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const preloadedPosts = await preloadAuthQuery(api.posts.queries.getByUsername, {
    username,
  });

  return (
    <PostWorkspaceProvider preloadedPosts={preloadedPosts} username={username}>
      {children}
    </PostWorkspaceProvider>
  );
}
