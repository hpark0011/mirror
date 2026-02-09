import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAuthenticated();

  if (!authed) {
    redirect("/sign-in");
  }

  return (
    <>
      {children}
    </>
  );
}
