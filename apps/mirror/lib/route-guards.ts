import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

type ProfileForGate = {
  username?: string;
  onboardingComplete?: boolean;
} | null;

function hasFinishedOnboarding(profile: ProfileForGate): boolean {
  return !!(profile?.username && profile.onboardingComplete);
}

/**
 * Server-side gate: if the request has an authenticated session but the user
 * has not finished onboarding (no username yet OR `onboardingComplete` still
 * false after step 1), redirects to `/onboarding`. Unauthenticated requests
 * pass through silently — other gates (middleware, page-level auth checks)
 * handle them.
 *
 * Callers that have already fetched `getCurrentProfile` (and already know
 * the session is authenticated) should pass it in via `preloadedProfile` to
 * avoid a second Convex round-trip and guarantee the gate decides against
 * the same profile snapshot the caller saw.
 *
 * Single source of truth for the "not-onboarded → onboarding" rule (NFR-07).
 */
export async function enforceOnboardingGate(
  preloadedProfile?: ProfileForGate
): Promise<void> {
  if (preloadedProfile !== undefined) {
    if (!hasFinishedOnboarding(preloadedProfile)) redirect("/onboarding");
    return;
  }

  if (!(await isAuthenticated())) return;

  const profile = await fetchAuthQuery(
    api.users.queries.getCurrentProfile,
    {}
  );

  if (!hasFinishedOnboarding(profile)) {
    redirect("/onboarding");
  }
}
