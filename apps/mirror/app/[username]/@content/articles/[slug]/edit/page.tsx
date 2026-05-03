import { notFound, redirect } from "next/navigation";
import { ArticleEditor } from "@/features/articles/components/article-editor";
import { type ArticleWithBody } from "@/features/articles/types";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

// Edit pages are owner-only. The article-detail query (`getBySlug`) already
// hides drafts from non-owners, but anyone authenticated can read a published
// article — so we still need a stricter "current user is the owner" gate
// before rendering the editor. We fetch the current profile and compare its
// `_id` to `article.userId` (the article's owner reference).
//
// On a missing session we send to /sign-in. On a session-without-ownership we
// send the user back to the read view rather than /sign-in, since being
// signed-in as the wrong user is not a sign-in failure.
export default async function ArticleEditContentPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  if (!(await isAuthenticated())) {
    redirect("/sign-in");
  }

  const [article, profile] = await Promise.all([
    fetchAuthQuery(api.articles.queries.getBySlug, { username, slug }),
    fetchAuthQuery(api.users.queries.getCurrentProfile, {}),
  ]);

  if (!article) notFound();

  // Owner-check: profile._id must match article.userId. Both are
  // Id<"users">, so we compare strings directly.
  if (!profile || profile._id !== article.userId) {
    redirect(`/@${username}/articles/${slug}`);
  }

  return (
    <ArticleEditor
      article={article as ArticleWithBody}
      username={username}
      slug={slug}
    />
  );
}
