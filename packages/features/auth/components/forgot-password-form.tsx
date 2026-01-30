"use client";

import { useState } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";
import { getSafeRedirectUrl } from "../utils/validate-redirect";

interface ForgotPasswordFormProps {
  authClient: AuthClient;
  redirectTo?: string;
}

export function ForgotPasswordForm({
  authClient,
  redirectTo = "/reset-password",
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const safeRedirectTo = getSafeRedirectUrl(redirectTo, "/reset-password");

    await authClient.requestPasswordReset(
      { email, redirectTo: safeRedirectTo },
      {
        onSuccess: () => {
          setStatus("success");
        },
        onError: (ctx) => {
          setStatus("error");
          setError(getAuthErrorMessage(ctx.error.code ?? "UNKNOWN"));
        },
      },
    );
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <FormSuccess
          title="Check your email"
          message={`If an account exists for ${email}, you will receive a password reset link.`}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
