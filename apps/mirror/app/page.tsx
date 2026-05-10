import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import {
  buildProfileSectionHref,
  DEFAULT_PROFILE_SECTION,
} from "@feel-good/convex/convex/content/href";
import { WaitlistLanding } from "@/features/waitlist";
import { enforceOnboardingGate } from "@/lib/route-guards";

export default async function HomePage() {
  const authed = await isAuthenticated();

  if (!authed) {
    return (
      <main className="mx-auto min-h-screen">
        <WaitlistLanding />
      </main>
    );
  }

  const profile = await fetchAuthQuery(api.users.queries.getCurrentProfile, {});

  if (profile?.username && profile.onboardingComplete) {
    redirect(
      buildProfileSectionHref(
        profile.username,
        profile.defaultProfileSection ?? DEFAULT_PROFILE_SECTION,
      ),
    );
  }

  await enforceOnboardingGate(profile);
}
