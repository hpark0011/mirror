import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { OnboardingWizard } from "@/features/onboarding";

export default async function OnboardingPage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/sign-in");
  return <OnboardingWizard />;
}
