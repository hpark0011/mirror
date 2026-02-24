import { notFound } from "next/navigation";
import { MOCK_PROFILE } from "@/features/profile";
import type { Profile } from "@/features/profile";
import { MOCK_ARTICLES } from "@/features/articles";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
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

  const convexProfile = await fetchAuthQuery(api.users.getByUsername, { username });

  let profileData: Profile;

  if (!convexProfile) {
    if (username === MOCK_PROFILE.username) {
      profileData = MOCK_PROFILE;
    } else {
      notFound();
    }
  } else {
    profileData = {
      userId: convexProfile._id,
      authId: convexProfile.authId,
      username: convexProfile.username ?? username,
      name: convexProfile.name ?? "",
      bio: convexProfile.bio ?? "",
      avatarUrl: convexProfile.avatarUrl,
    };
  }

  const currentAuthUser = await fetchAuthQuery(api.auth.getCurrentUser, {});
  const isOwner =
    !!currentAuthUser &&
    !!profileData.authId &&
    currentAuthUser._id === profileData.authId;

  const articles = isOwner
    ? MOCK_ARTICLES
    : MOCK_ARTICLES.filter((a) => a.status === "published");

  return (
    <ProfileShell profile={profileData} isOwner={isOwner} articles={articles}>
      {children}
    </ProfileShell>
  );
}
