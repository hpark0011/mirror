import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/sign-in");
  }

  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {});
  if (profile?.username) {
    redirect(`/@${profile.username}`);
  }

  return <main className="h-screen">{children}</main>;
}
