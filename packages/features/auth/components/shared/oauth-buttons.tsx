"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleIcon } from "@feel-good/icons";
import { Button } from "@feel-good/ui/primitives/button";
import { type AuthClient } from "../../client";
import { type AuthError } from "../../types";
import { getSafeRedirectUrl } from "../../utils/validate-redirect";

export interface OAuthButtonsProps {
  authClient: AuthClient;
  label?: string;
  variant?: "outline" | "secondary";
  size?: "default" | "lg";
  redirectTo?: string;
  disabled?: boolean;
  onError?: (error: AuthError) => void;
}

export function OAuthButtons({
  authClient,
  label = "Continue with Google",
  variant = "outline",
  size = "lg",
  redirectTo,
  disabled = false,
  onError,
}: OAuthButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleGoogleSignIn() {
    setIsLoading(true);

    try {
      const callbackURL = redirectTo
        ? getSafeRedirectUrl(redirectTo, undefined)
        : undefined;

      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      // If we reach here without redirect, reset loading after timeout
      // OAuth might open popup that user closes
      timeoutRef.current = setTimeout(() => setIsLoading(false), 5000);
    } catch {
      setIsLoading(false);
      onError?.({
        code: "OAUTH_ERROR",
        message: "Unable to sign in with Google. Please try again.",
      });
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={isLoading || disabled}
      aria-busy={isLoading}
      data-testid="auth.oauth.google-btn"
    >
      <GoogleIcon className="text-primary size-4" aria-hidden="true" />
      {isLoading ? "Redirecting..." : label}
    </Button>
  );
}
