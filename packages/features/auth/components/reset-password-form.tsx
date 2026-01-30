"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import {
  getAuthErrorMessage,
  PASSWORD_MIN_LENGTH,
  validatePassword,
  type AuthStatus,
} from "../types";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";
import { getSafeRedirectUrl } from "../utils/validate-redirect";

interface ResetPasswordFormProps {
  authClient: AuthClient;
  redirectTo?: string;
}

export function ResetPasswordForm({
  authClient,
  redirectTo = "/sign-in",
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(getAuthErrorMessage(passwordError));
      return;
    }

    if (password !== confirmPassword) {
      setError(getAuthErrorMessage("PASSWORDS_DONT_MATCH"));
      return;
    }

    if (!token) {
      setError(getAuthErrorMessage("INVALID_TOKEN"));
      return;
    }

    setStatus("loading");

    await authClient.resetPassword(
      { newPassword: password, token },
      {
        onSuccess: () => {
          setStatus("success");
          const safeRedirectTo = getSafeRedirectUrl(redirectTo, "/sign-in");
          setTimeout(() => router.push(safeRedirectTo), 2000);
        },
        onError: (ctx) => {
          setStatus("error");
          setError(getAuthErrorMessage(ctx.error.code ?? "UNKNOWN"));
        },
      }
    );
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  if (!token) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-center">
        <p className="text-sm text-destructive">
          Invalid or missing reset token. Please request a new password reset
          link.
        </p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <FormSuccess
          title="Password reset successful"
          message="Your password has been reset. Redirecting to sign in..."
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm Password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
