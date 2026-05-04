import { redirect } from "next/navigation";
import { NewArticleEditor } from "@/features/articles/components/new-article-editor";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

// Owner-only. Anyone can be authenticated, but only the matching profile's
// owner can create an article under that handle. We check the same way the
// existing edit page does — fetch the current profile and compare its
// username to the URL param.
export default async function NewArticleContentPage({
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
    redirect(`/@${username}/articles`);
  }

  return <NewArticleEditor username={username} />;
}
