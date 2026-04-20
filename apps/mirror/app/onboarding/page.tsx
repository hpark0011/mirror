import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { OnboardingWizard } from "@/features/onboarding";

export default async function OnboardingPage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/sign-in");

  const profile = await fetchAuthQuery(
    api.users.queries.getCurrentProfile,
    {}
  );

  if (profile?.username && profile.onboardingComplete) {
    redirect(`/@${profile.username}`);
  }

  return <OnboardingWizard />;
}
