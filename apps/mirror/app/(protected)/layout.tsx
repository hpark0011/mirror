import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { enforceOnboardingGate } from "@/lib/route-guards";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) redirect("/sign-in");
  await enforceOnboardingGate();
  return <main className="h-screen">{children}</main>;
}
