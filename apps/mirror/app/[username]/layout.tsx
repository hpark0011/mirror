import { notFound } from "next/navigation";
import { MOCK_PROFILE } from "@/features/profile";
import { isReservedUsername } from "@/lib/reserved-usernames";
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
  return (
    <ProfileShell profile={MOCK_PROFILE}>
      {children}
    </ProfileShell>
  );
}
