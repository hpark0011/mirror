"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";

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

    if (password.length < 8) {
      setError(getAuthErrorMessage("PASSWORD_TOO_SHORT"));
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
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
          setTimeout(() => router.push(redirectTo), 2000);
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
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
          <h3 className="font-medium text-green-800 dark:text-green-200">
            Password reset successful
          </h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            Your password has been reset. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
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
          minLength={8}
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
