import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Profile } from "@/features/profile";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/auth-server";
import { enforceOnboardingGate } from "@/lib/route-guards";
import { api } from "@feel-good/convex/convex/_generated/api";
import { ProfileRouteDataProvider } from "./_providers/profile-route-data-context";
import { ChatRouteController } from "./_providers/chat-route-controller";
import { WorkspaceShell } from "./_components/workspace-shell";

// Per-request memoized so generateMetadata and the layout body share one fetch.
const getProfileByUsername = cache((username: string) =>
  fetchAuthQuery(api.users.queries.getByUsername, { username }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  if (isReservedUsername(username)) return {};

  const profile = await getProfileByUsername(username);
  if (!profile) return {};

  const displayName = profile.name || `@${profile.username ?? username}`;
  const description = profile.bio || `${displayName}'s profile on Mirror`;

  return {
    title: { default: displayName, template: `%s | ${displayName}` },
    description,
    openGraph: {
      title: displayName,
      description,
      ...(profile.avatarUrl && { images: [{ url: profile.avatarUrl }] }),
    },
  };
}

export default async function ProfileLayout({
  children: _children,
  content,
  interaction,
  params,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  interaction: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  void _children;
  const { username } = await params;
  if (isReservedUsername(username)) notFound();

  await enforceOnboardingGate();

  const [convexProfile, preloadedProfile, currentAuthUser] =
    await Promise.all([
      getProfileByUsername(username),
      preloadAuthQuery(api.users.queries.getByUsername, { username }),
      fetchAuthQuery(api.auth.queries.getCurrentUser, {}),
    ]);

  if (!convexProfile) notFound();

  const profileData: Profile = {
    _id: convexProfile._id,
    authId: convexProfile.authId,
    username: convexProfile.username ?? username,
    name: convexProfile.name ?? "",
    bio: convexProfile.bio ?? "",
    avatarUrl: convexProfile.avatarUrl,
    ...(convexProfile.username === "rick-rubin" && {
      media: { video: "/portrait-video.mp4", poster: "/rr.webp" },
    }),
  };
  const isOwner =
    !!currentAuthUser &&
    !!profileData.authId &&
    currentAuthUser._id === profileData.authId;

  return (
    <ProfileRouteDataProvider
      profile={profileData}
      preloadedProfile={preloadedProfile}
      isOwner={isOwner}
    >
      <ChatRouteController>
        <WorkspaceShell interaction={interaction} content={content} />
      </ChatRouteController>
    </ProfileRouteDataProvider>
  );
}
