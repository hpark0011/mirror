"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { Spinner } from "@feel-good/ui/primitives/spinner";
import { ProfileStep } from "./profile-step";
import { UsernameStep } from "./username-step";

export function OnboardingWizard() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const ensureProfile = useMutation(api.users.ensureProfile);
  const ensuredRef = useRef(false);

  // Backfill: if authenticated but no app user record, create one.
  // This handles users created before the onCreate trigger existed.
  useEffect(() => {
    if (profile === null && !ensuredRef.current) {
      ensuredRef.current = true;
      ensureProfile().catch(() => {
        // Auth not ready yet — reset so we retry on next render cycle
        ensuredRef.current = false;
      });
    }
  }, [profile, ensureProfile]);

  useEffect(() => {
    if (profile && profile.onboardingComplete && profile.username) {
      router.replace(`/@${profile.username}`);
    }
  }, [profile, router]);

  // Still loading — profile is undefined (Convex query in flight)
  if (profile === undefined) {
    return <OnboardingLoading />;
  }

  // Profile record hasn't been created yet by the Convex trigger
  if (profile === null) {
    return <OnboardingLoading message="Setting up your account..." />;
  }

  // Onboarding is already complete — redirect is handled in useEffect,
  // show loading while it processes
  if (profile.onboardingComplete) {
    return <OnboardingLoading />;
  }

  // Has a username but hasn't completed onboarding — show step 2
  if (profile.username) {
    return (
      <ProfileStep
        username={profile.username}
        onComplete={() => {
          // Convex will reactively update the profile query.
          // The useEffect above will handle redirecting to /@username.
        }}
      />
    );
  }

  // No username yet — show step 1
  return (
    <UsernameStep
      onComplete={() => {
        // After username is set, Convex will reactively update the profile query.
        // The useEffect above will handle redirecting once onboarding is complete,
        // or re-render will show step 2 if more steps remain.
      }}
    />
  );
}

type OnboardingLoadingProps = {
  message?: string;
};

function OnboardingLoading({ message }: OnboardingLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
