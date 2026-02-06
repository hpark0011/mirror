"use client";

import Link from "next/link";
import type { AuthClient } from "../client";
import { OTPLoginForm } from "../components/forms/otp-login-form";
import { OAuthButtons } from "../components/shared/oauth-buttons";
import type { AuthError } from "../types";
import { AuthDivider } from "./shared/auth-divider";

export interface LoginBlockProps {
  authClient: AuthClient;
  signUpHref?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

export function LoginBlock({
  authClient,
  signUpHref = "/sign-up",
  redirectTo,
  onSuccess,
  onError,
}: LoginBlockProps) {
  return (
    <div className="mx-auto w-full max-w-sm px-8 relative space-y-6 pb-10">
      {/* OTP Login */}
      <OTPLoginForm
        authClient={authClient}
        redirectTo={redirectTo}
        onSuccess={onSuccess}
        onError={onError}
      />

      <AuthDivider>or</AuthDivider>

      {/* OAuth Section */}
      <OAuthButtons
        authClient={authClient}
        redirectTo={redirectTo}
        label="Continue with Google"
        onError={onError}
      />

      {/* Sign Up Link */}
      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href={signUpHref} className="hover:text-foreground underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
