import { redirect } from "next/navigation";
import { NewPostEditor } from "@/features/posts/components/editor/new-post-editor";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

// Owner-only. Anyone can be authenticated, but only the matching profile's
// owner can create a post under that handle. Mirrors the matching article
// route (`@content/articles/new/page.tsx`).
export default async function NewPostContentPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  if (!(await isAuthenticated())) {
    redirect("/sign-in");
  }

  const profile = await fetchAuthQuery(
    api.users.queries.getCurrentProfile,
    {},
  );
  if (!profile || profile.username !== username) {
    redirect(`/@${username}/posts`);
  }

  return <NewPostEditor username={username} />;
}
