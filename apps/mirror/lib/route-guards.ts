import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";

/**
 * Server-side gate: if the request has an authenticated session but the user
 * has no username yet, redirects to `/onboarding`. Unauthenticated requests
 * pass through silently — other gates (middleware, page-level auth checks)
 * handle them.
 *
 * Call this from any layout that must refuse to render for a no-username
 * authed user. Single source of truth for the "no-username → onboarding"
 * rule (NFR-07).
 */
export async function enforceOnboardingGate(): Promise<void> {
  if (!(await isAuthenticated())) return;

  const profile = await fetchAuthQuery(
    api.users.queries.getCurrentProfile,
    {}
  );

  if (!profile?.username) {
    redirect("/onboarding");
  }
}
