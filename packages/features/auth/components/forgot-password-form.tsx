"use client";

import { useState } from "react";
import { Button } from "@feel-good/ui/primitives/button";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import type { AuthClient } from "../client";
import { getAuthErrorMessage, type AuthStatus } from "../types";

interface ForgotPasswordFormProps {
  authClient: AuthClient;
  redirectURL?: string;
}

export function ForgotPasswordForm({
  authClient,
  redirectURL = "/reset-password",
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = authClient as any;
      const { error: resetError } = await client.forgetPassword({
        email,
        redirectTo: redirectURL,
      });

      if (resetError) {
        setStatus("error");
        setError(getAuthErrorMessage(resetError.code));
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setError(getAuthErrorMessage("UNKNOWN"));
    }
  }

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
          <h3 className="font-medium text-green-800 dark:text-green-200">
            Check your email
          </h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            If an account exists for {email}, you will receive a password reset
            link.
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
