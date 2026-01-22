"use client";

import { Button } from "@/components/ui/button";
import { AUTH_PROVIDERS } from "@/config/auth.config";
import { getSupabaseBrowserClient } from "@/utils/supabase/client/supabase-client";
import { Chrome } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

interface SocialAuthProps {
  mode: "sign-in" | "sign-up";
}

export function SocialAuth({ mode }: SocialAuthProps) {
  const [pending, startTransition] = useTransition();

  const handleGoogleAuth = async () => {
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Get origin for redirect URL
        const origin = window.location.origin;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${origin}/auth/callback`,
          },
        });

        if (error) {
          throw error;
        }

        // Browser will redirect to Google OAuth
      } catch (error) {
        toast.error("Failed to authenticate with Google.");
        console.error(error);
      }
    });
  };

  if (!AUTH_PROVIDERS.google.enabled) {
    return null;
  }

  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='outline'
        size='lg'
        className='w-full'
        onClick={handleGoogleAuth}
        disabled={pending}
        data-slot='social-auth-button'
      >
        <Chrome className='mr-2 h-4 w-4' />
        {mode === "sign-in" ? "Sign in" : "Sign up"} with{" "}
        {AUTH_PROVIDERS.google.name}
      </Button>
    </div>
  );
}
