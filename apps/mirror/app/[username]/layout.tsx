import { notFound } from "next/navigation";
import type { Profile } from "@/features/profile";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { ProfileRouteDataProvider } from "./_providers/profile-route-data-context";
import { ChatRouteController } from "./_providers/chat-route-controller";
import { WorkspaceShell } from "./_components/workspace-shell";

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

  const [convexProfile, preloadedProfile, currentAuthUser] =
    await Promise.all([
      fetchAuthQuery(api.users.queries.getByUsername, { username }),
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
