import { notFound } from "next/navigation";
import { api } from "@feel-good/convex/convex/_generated/api";
import { SettingsPanel } from "@/features/settings";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [currentAuthUser, profileData] = await Promise.all([
    fetchAuthQuery(api.auth.queries.getCurrentUser, {}),
    fetchAuthQuery(api.users.queries.getByUsername, { username }),
  ]);

  const isOwner =
    !!currentAuthUser &&
    !!profileData?.authId &&
    currentAuthUser._id === profileData.authId;

  if (!isOwner) notFound();

  return <SettingsPanel />;
}
