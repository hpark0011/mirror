import { notFound } from "next/navigation";
import { MOCK_PROFILE } from "@/features/profile";
import { MOCK_ARTICLES } from "@/features/articles";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { isAuthenticated } from "@/lib/auth-server";
import { ProfileShell } from "./_components/profile-shell";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (isReservedUsername(username)) notFound();
  if (username !== MOCK_PROFILE.username) notFound();

  // TODO: SECURITY — isAuthenticated() only checks session presence, not profile ownership.
  // When real profiles replace MOCK_PROFILE, change to:
  //   const currentUser = await fetchAuthQuery(api.auth.getCurrentUser);
  //   const isOwner = currentUser?._id === profile.userId;
  const isOwner = await isAuthenticated();
  const articles = isOwner
    ? MOCK_ARTICLES
    : MOCK_ARTICLES.filter((a) => a.status === "published");

  return (
    <ProfileShell profile={MOCK_PROFILE} isOwner={isOwner} articles={articles}>
      {children}
    </ProfileShell>
  );
}
